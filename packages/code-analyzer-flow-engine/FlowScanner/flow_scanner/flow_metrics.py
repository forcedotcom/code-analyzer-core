"""
  Python module for parsing xml result file and generating html reports.
  @author: rsussland@salesforce.com

  This file will read from the package

"""

from __future__ import annotations

import configparser
import datetime
import io
import logging
import os
import pathlib
import pkgutil
import shutil
import traceback
from typing import TYPE_CHECKING

# noinspection PyUnresolvedReferences
import public.custom_parser as CP
from flow_scanner import version
from . import ESAPI

if TYPE_CHECKING:
    from public.data_obj import QueryDescription
# Compatability:
#   Python 3 doesn't have a 'unicode' function
#

# set up logging
logger = logging.getLogger(__name__)

# NB parent only works with lxml

SFDC_OBJECT_NAME = 'Scan_Info__c'
RESULT_ROOT_TAG = 'CxXMLResults'
PARSE_ERROR = 'XML Parse Error: '
QUERY_FAILED = 'Query Failed to Complete'
QUERY_TRUNCATED = 'Query Results Truncated'
DEFAULT_PRIORITY = -1
FLOW_SCANNER_HOME = pathlib.Path(__file__).parent.resolve()
MAX_RESULTS = 500

QUERY_DESC = configparser.ConfigParser()
DEFAULT_DESC_CONFIG_PATH = "flow_scanner_query_data.txt"
SOFTWARE_PRESETS = {}

# Query Sort dictionary
QUERY_GROUP_PRIORITY = {
    'Apex Critical Security Risk': 0,
    'Flow High Severity': 5,
    'JavaScript High Risk': 10,
    'Apex Serious Security Risk': 20,
    'Flow Moderate Severity': 21,
    'JavaScript Low Visibility': 30,
    'Apex Low Visibility': 40,
    'Flow Low Severity': 41,
    'Apex Code Quality': 50,
    'Apex ISV Quality Rules': 60,
    'Flow Informational': 65,
}


def add_to_query_config(list_of_desc: list[QueryDescription]) -> None:
    """Adds query descriptions to module-level config file if not present

    Call after loading any queries from disk. Must pass
    an object of type public.data_obj.QueryDescription

    Args:
        list_of_desc:

    Returns:
        None

    Raises:
        ValueError if query descriptions are already present

    """
    global QUERY_DESC
    if len(QUERY_DESC) == 1:
        # make sure we don't have any queries to load
        load_query_desc_from_config(path=None)

    # check if we are still empty..
    if len(QUERY_DESC) == 1:
        QUERY_DESC = configparser.ConfigParser()

    for desc in list_of_desc:
        query_name = desc.query_name.strip()
        key_name = desc.query_id
        raw_severity = desc.severity.name.strip()
        severity = raw_severity.replace("_", " ")
        if desc.is_security is True:
            security = "1"
        else:
            security = "0"

        if QUERY_DESC.has_section(key_name):
            logger.debug(f"Attempting to add a query {key_name} which is already defined! Skipping..")
            continue

        QUERY_DESC.add_section(key_name)
        QUERY_DESC.set(key_name, "name", query_name)
        QUERY_DESC.set(key_name, "group", severity)
        QUERY_DESC.set(key_name, "description", desc.query_description)
        QUERY_DESC.set(key_name, "cweId", "0")
        QUERY_DESC.set(key_name, "references", desc.help_url or "")
        QUERY_DESC.set(key_name, "security", security)


def load_query_desc_from_config(path: str | None):
    if path is None:
        path = DEFAULT_DESC_CONFIG_PATH
    if not os.path.exists(path):
        return None
    else:
        global QUERY_DESC
        QUERY_DESC.read_string(
            pkgutil.get_data(__name__, os.path.join("data", path)).decode()
        )


def add_to_presets(presets: list[str], preset_name: str) -> None:
    global SOFTWARE_PRESETS
    SOFTWARE_PRESETS[preset_name] = presets
    pass


def get_software_presets(preset_name: str) -> list[str]:
    """Returns empty list if no software presets found with this name

    Args:
        preset_name: name of preset to retrieve

    Returns:
        List of query names in this preset
    """
    return dict.get(SOFTWARE_PRESETS, preset_name, [])


def serialize(portion, elem):
    """ serializes element from iterparse.
        (N.B: iterparse returns bytestrings, not code points. This is true for events, tags, etc.
        Because we are using unicode literals, this means a decoding will occur. Decoding automatically
        occurs when concatenating a string with a unicode code point)
        """
    out = ''
    line_end = '\n'
    if os.name == 'nt':
        line_end = '\r' + line_end

    if portion == 'start':
        out = '<' + elem.tag + ' '
        for key in elem.keys():
            out += ' ' + key
            value = elem.attrib[key]
            if value is not None:
                out += '="' + escape(value) + '"'
            else:
                out += ' '
        out += '>' + line_end
        return out

    elif portion == 'end':
        return '</' + elem.tag + '>' + line_end

    elif portion is None:
        raw_str = CP.to_string(elem)
        return raw_str  # todo: pretty print


    else:
        raise RuntimeError('Called with invalid portion' + portion)


def escape(msg):
    msg = msg.replace("<", "&lt;")
    msg = msg.replace(">", "&gt;")
    msg = msg.replace("&", "&amp;")
    msg = msg.replace("\"", "&quot;")
    return msg


def normalize_query_path(s):
    index = s.rfind('Version:')
    if index > 1:
        t = s[:s.find('Version:')].strip()
    else:
        t = s.split(':')[0].strip()
    return t.replace('\\', '.').replace(' ', '_')


def _get_fallback_query(s):
    """Gets default query in case no match found

    If we override a query, the path changes, e.g. from::

        'Apex.Cx.General.SOQL_SOSL_Injection'

    to::

        'Apex.Corp.General.SOQL_SOSL_Injection'

    but we don't want to make a new query description entry
    so look through the description file to see if
    there is an existing description

    Args:
        s: the normalized corp query found

    Returns:
        original normalized cx query path

    """
    try:
        QUERY_DESC.get(s, 'name')
        return s
    except:
        short_name = s.split('.')[-1]
        candidates = [x for x in QUERY_DESC.sections() if x.endswith("." + short_name)]
        if len(candidates) > 0:
            return candidates[0]
        else:
            return None


def get_query_for_config(path):
    original_query = normalize_query_path(path)
    fallback = _get_fallback_query(original_query)
    if fallback is None:
        query_path = original_query
    else:
        query_path = fallback
    return query_path


def normalize_time(s):
    if s is not None and 'Z' in s:
        return s.replace('T', ' ').replace('Z', '')[:-4]
    else:
        return s


def truncate(msg, size=40):
    return (msg[:size] + "...") if len(msg) > size else msg


def _make_scanner_help(help_url):
    if help_url is not None:
        msg = ('<div class="row"><div class="col-xs-10">'
               'For any questions about this service, please consult the scanner help page at'
               f'<a href="{help_url}">{help_url}</a></div></div>')
    else:
        msg = ('<div class="row"><div class="col-xs-10">'
               'Please verify and then address all security issues in this report</div></div>')
    return msg


def reverse_map(vuln_map):
    """Go from 1) a dict of field names to vuln name list
    to 2) a dict of vuln names to field name lists
    """
    reverse_map = {}
    for key in vuln_map:
        for val in vuln_map[key]:
            if val not in reverse_map:
                reverse_map[val] = []
                reverse_map[val].append(key)
    return reverse_map


def _bail(msg, exception=Exception):
    logger.critical(PARSE_ERROR + msg)
    raise exception(msg)


def _safe_append(fp, data):
    """Accepts file pointer and unicode data to append. Does not throw exceptions."""
    # TODO: email exception?
    try:
        fp.write(data)
        return True
    except:
        logger.critical('Error writing data ' + str(data) + ' to file pointer '
                        + repr(fp) + " " + traceback.format_exc())
        return False


def _safe_prepend(filepath, data):
    """Accepts filepath and data to prepend. Does not throw exceptions."""
    # TODO: email exception?
    try:
        temp_file = filepath + "_tmp"
        with open(filepath, mode='r', encoding='utf-8') as fp:
            with open(temp_file, mode='w', encoding='utf-8') as tmp_fp:
                tmp_fp.write('%s\n' % data)
                for line in fp:
                    tmp_fp.write(line)

        os.remove(filepath)
        shutil.move(temp_file, filepath)
        return True

    except:
        logger.exception('Error prepending data ' + data + ' to path ' + filepath + ' ' + traceback.format_exc())
        return False


def count_issues(scan_results):
    """
    Args:
        scan_results: scan_results: List<QueryData>

    Returns:
        tuple: security issues, quality issues total counts from
        scan_results
    """

    sec_count = 0
    quality_count = 0

    for query_data in scan_results:
        if query_data.isSecurity():
            sec_count += query_data.tallies
        else:
            quality_count += query_data.tallies

    return sec_count, quality_count


# noinspection PyPep8
class JobInfo(object):
    def __init__(self,
                 email_add,
                 friendly_name,
                 job_type,
                 preset,
                 scan_start,
                 scan_end,
                 result_id,
                 service_version,
                 lightning_api_version=None,
                 lightning_api_too_low=False,
                 help_url=None):

        self.email_add = None if email_add is None else email_add
        self.friendly_name = None if friendly_name is None else friendly_name
        self.job_type = None if job_type is None else job_type
        self.preset = None if preset is None else preset
        self.scan_start = None if scan_start is None else scan_start
        self.scan_end = None if scan_end is None else scan_end
        self.result_id = None if result_id is None else result_id
        self.cx_version = version.__version__
        self.service_version = service_version
        self.lightning_api_version = lightning_api_version
        self.lightning_api_too_low = lightning_api_too_low
        self.help_url = help_url

    def update(self, root_elem):
        r"""Attempts to populate params from root xml element:

        <CxXMLResults
            InitiatorName="admin admin"
            Owner="admin@cx"
            ScanId="1000015"
            ProjectId="17"
            ProjectName="checkmarx_v1"
            TeamFullPathOnReportDate=r"CxServer\SP\Appexchange\Portal"
            DeepLink="http://SFM-APPSCAN-WS2/CxWebClient/ViewerMain.aspx?scanid=1000015&amp;projectid=17"
            ScanStart="Tuesday, September 13, 2016 2:11:28 AM"
            Preset="PortalSecurity"
            ScanTime="00h:02m:30s"
            LinesOfCodeScanned="10241"
            FilesScanned="283"
            ReportCreationTime="Tuesday, September 13, 2016 3:54:49 AM"
            Team="Portal"
            CheckmarxVersion="8.1.0"
            ScanComments=""
            ScanType="Full"
            SourceOrigin="LocalPath"
            Visibility="Public">

        JobInfo(
            email_add,
            friendly_name,
            job_type,
            preset,
            scan_start,
            scan_end,
            result_id
            )
        """
        if self.email_add is None:
            self.email_add = 'N/A'

        if self.friendly_name is None:
            self.friendly_name = 'N/A'

        if self.job_type is None:
            self.job_type = 'Portal'

        if self.preset is None:
            self.preset = "FlowSecurity"

        if self.scan_start is None:
            self.scan_start = str(datetime.datetime.now())

        if self.scan_end is None:
            self.scan_end = str(datetime.datetime.now())

        if self.result_id is None:
            self.result_id = "default"

    def make_html(self, scan_results):
        """Generates report metadata html"""
        security_count, quality_count = count_issues(scan_results)
        data = ('<div class = "container-fluid">'
                '  <div class = "row">'
                '    <div class = "col-xs-10 col-xs-offset-1">'  # panel contains cols and rows 
                '      <div class = "panel panel-primary">'
                '        <div class = "panel-heading" id="results_table"><h3>Flow Scanner Results</h3></div>'
                '        <div class = "panel-body">'
                '          <div class="row">'
                '            <div class = "col-xs-4 col-xs-offset-1"><strong>Job Type:</strong> '
                + truncate(ESAPI.html_encode(self.job_type)) + '</div>'
                                                               '            <div class = "col-xs-3"><strong>Preset:</strong> '
                + truncate(ESAPI.html_encode(self.preset)) + '</div>'
                                                             '            <div class = "col-xs-3"><span class="pull-right"><strong>Scan Id:</strong> '
                + truncate(ESAPI.html_encode(self.result_id)) + '</span></div>'
                                                                '          </div>'
                                                                '          <div class = "row">'
                                                                '            <div class = "col-xs-10 col-xs-offset-1">'
                                                                '<strong>Description:</strong> ' + truncate(
                    ESAPI.html_encode(self.friendly_name)) +
                '              <span class = "pull-right"><strong>Email Address:</strong> '
                + truncate(ESAPI.html_encode(self.email_add)) + '</span>'
                                                                '            </div>'
                                                                '          </div>'
                                                                '          <div class = "row">' +
                '            <div class = "col-xs-4 col-xs-offset-1"><strong>Security Issues: </strong>'
                + str(security_count) + '</div>'
                                        '            <div class = "col-xs-3"><strong>Service Version: </strong>'
                + truncate(ESAPI.html_encode(self.service_version)) + '</div>'
                                                                      '            <div class = "col-xs-3"><span class = "pull-right"><strong>Scan Start: </strong> '
                + truncate(ESAPI.html_encode(self.scan_start)) + '</span></div>'
                                                                 '          </div>'
                                                                 '          <div class = "row">'
                                                                 '            <div class = "col-xs-4 col-xs-offset-1"><strong>Quality Issues: </strong> '
                + str(quality_count) + '</div>'
                                       '            <div class = "col-xs-3"><strong>Scan Engine:</strong> '
                + truncate(ESAPI.html_encode(self.cx_version)) + '</div>'
                                                                 '            <div class = "col-xs-3"><span class = "pull-right"><strong>Scan End: </strong>'
                + truncate(ESAPI.html_encode(self.scan_end)) + '</span></div>'
                                                               '          </div>'
                                                               '        </div>'  # end panel-body
                                                               '      <div class = "panel-footer">'
                )
        data += _make_scanner_help(self.help_url)
        data += '      </div>'
        data += '    </div>'  # end panel footer and end panel
        data += '</div></div>'  # end (outer) col and row
        return data


class QueryData(object):
    def __init__(self, path):
        if len(QUERY_DESC) == 1:
            load_query_desc_from_config(path=None)

        self.query_path = get_query_for_config(path)
        self.success = True
        self.tallies = 0
        self.name = QUERY_DESC.get(self.query_path, 'name')
        self.group = QUERY_DESC.get(self.query_path, 'group')
        self.references = QUERY_DESC.get(self.query_path, 'references')
        self.security = QUERY_DESC.get(self.query_path, 'security')
        tmp = self.query_path.split('.')
        self.help_name = tmp[len(tmp) - 1]

    def get_name(self):
        # TODO: Have a real dictionary, but currently we get rid of underscores only
        return self.name.replace('_', ' ')

    def get_group(self):
        # TODO: Have a real dictionary as above
        return self.group.replace('_', ' ')

    def found_issues(self):
        if self.success and (int(self.tallies) > 0):
            return 0
        else:
            return 1

    def isSecurity(self):
        return self.security == '1'


def _report_append(element, report_fp, source_dir='None', tallies=None):
    """Converts element to appropriate HTML report line.
        In the future, should use XSLT, but currently our transforms are very simple, and on a streaming per-element
        basis so there is not a lot of structure to the tag transforms that happen.
    """
    logger.debug("_report_append invoked with element tag: " + element.tag)
    data = None

    if element.tag == "Result":

        # check to see if this is a null result
        if len(element.attrib) == 0:
            return ''

        else:
            parent = element.getparent()
            data = ('<div class = "row top-half">'
                    '<div class = "col-xs-10 col-xs-offset-1">'
                    '<h3><a name="query_path' + normalize_query_path(parent.attrib['QueryPath'])
                    + '" href="#results_table"> Query: '
                    + parent.attrib['name'].replace("_", " ")
                    + '</a></h3>\n</div></div>'
                    + _make_query_desc(get_query_for_config(parent.attrib['QueryPath']))
                    )

    if element.tag == "Path":
        if tallies is None:
            path_end = ":"
        else:
            path_end = " " + str(tallies) + ":"

        data = ('<div class = "row top-half"><div class = "col-xs-6 col-xs-offset-1"><h5>' +
                element.getparent().getparent().attrib['name'].replace("_", " ") +
                ' result path' + path_end + ' </h5></div><div class = "col-xs-3 col-xs-offset-1">' +
                '<span class="help-block"><small>Similarity Id: ' + str(element.attrib['SimilarityId']) +
                '</small></span></div></div>\n')

    if element.tag == "PathNode":
        node_data = {}
        source = None
        snippet = element.find('Snippet')
        if snippet is not None:
            source = snippet.find('Line').find('Code').text.strip()

        filename = element.find('FileName').text
        flow_type = element.find('FlowType').text
        node_id = str(element.find('NodeId').text)
        name = element.find('Name').text
        column = str(element.find('Column').text)
        line_no = str(element.find('Line').text)

        if source is None:
            data = ('<div class = "row"><div class = "col-xs-7 col-xs-offset-2">'
                    ' Object: <code>' + ESAPI.html_encode(truncate(name)) +
                    '</code></div></div>\n'
                    '<div class = "row"><div class = '
                    '"col-xs-9 col-xs-offset-2">'
                    '<pre>Path: ' + ESAPI.html_encode(
                        filename) + ''
                                    '  Line: ' + line_no + ' Col:' + column + '</pre></div></div>'
                    )

        else:
            data = ('<div class = "row"><div class = "col-xs-9 col-xs-offset-2">'
                    + '<div class = "help-block">Object: <code>'
                    + ESAPI.html_encode(truncate(name)) + '</code>'
                    +' in <code>' + flow_type + '</code> flow at: <code>' + ESAPI.html_encode(filename) +
                    '</code></div><div><pre>' + ESAPI.html_encode(source) + '</pre></div></div></div>\n')

    _safe_append(report_fp, data)


def _append_overflow(report_fp, max_results):
    data = ('<div class = "row">'
            '<div class = "col-xs-9 col-xs-offset-2">'
            '<strong>Only the first ' + str(max_results) +
            ' results have been shown</strong>'
            '</div></div>'
            )
    _safe_append(report_fp, data)


def _add_source(source_dir, filename, target_line_no, obj_name):
    """OBSOLETE:
    Adds line from source, if possible. As the Cx XML line no has off by one errors,
    we first look for the object in the provided line, and if not present, we look
    for the object in the previous line.

    If we still cannot find the object,
    we log the issue and return the original source line.

    The XML file is written on a windows server. While popcrab may be running on a
    windows OS, testing versions may not. But source_dir is the location of the
    staging version of the code which may be in unix format.

    Therefore we convert the FileName
    in the xml file to be suitable to the filename on the popcrab host.
    """

    source = None

    try:
        if os.sep != u'\\':
            # we are running on linux/mac
            normalized_path = os.path.join(source_dir, filename.replace(u'\\', u'/'))
        else:
            normalized_path = os.path.join(source_dir, filename)

        curr_source = prev_source = None

        with open(normalized_path, mode='r', encoding="utf-8") as source_fp:
            for line_no, source_line in enumerate(source_fp):
                if line_no == (target_line_no - 1):
                    prev_source = source_line
                if line_no == target_line_no:
                    curr_source = source_line

        if curr_source is None:
            raise Exception("Failed to find source!")

        # first look in provided line no:
        if obj_name.lower() in curr_source.lower():
            return target_line_no, curr_source
        elif prev_source is not None and obj_name.lower() in prev_source.lower():
            return target_line_no - 1, prev_source
        else:
            logger.debug('Failed to find object ' + obj_name +
                         ' in source line: ' + str(target_line_no))
            return -1, curr_source

    except:
        logger.exception("Failed to find source code line for source: " +
                         source_dir + '\tfilename: ' + filename
                         + 'line_no: ' + str(target_line_no) + traceback.format_exc()
                         )
        return -1, None


def _update_results(scan_results, failed_scans, preset):
    """Newer versions of CX omit <Query> nodes in the xml file when
    the query succeeds and no issues are found or when the query fails.

    Args:
        scan_results: are results from this (reduced) xml file (List<QueryData>)
        failed_scans: is a list of QueryPaths from logfile (may be None)
        preset: is the name of the preset used.

    Returns:
        an enlarged scan_results with additional failed QueryData or missing QueryData

    This should be called to patch scan_results before report html table is generated
    """
    keys = [q.query_path for q in scan_results]
    failed = []

    if failed_scans is not None:
        failed = [normalize_query_path(x) for x in failed_scans]
        failed_q = [QueryData(x) for x in failed if x not in keys]

        for q in failed_q:
            q.success = False
            scan_results.add(q)

    # Get all queries
    all_d = []
    # with codecs.open(os.path.join(FLOW_SCANNER_HOME, 'data', preset + '_preset.txt'), encoding='utf-8') as fp:
    #    all_d = [query_path.strip() for query_path in fp]
    disk_preset = os.path.join('data', preset + "_preset.txt")
    if os.path.exists(disk_preset):
        preset_str = pkgutil.get_data(__name__, os.path.join('data', preset + "_preset.txt")).decode().strip()
        disk_presets = [query_path.strip() for query_path in preset_str.split("\n")]
    else:
        disk_presets = []

    all_d = disk_presets + get_software_presets(preset_name=preset)

    remaining = [QueryData(x) for x in all_d if not (x in failed or x in keys)]

    scan_results.update(remaining)

    return scan_results


def _make_query_desc(query_path):
    description = QUERY_DESC.get(query_path, 'description')
    references = QUERY_DESC.get(query_path, 'references')
    data = ('<div class="row top-half"><div class="col-xs-10 col-xs-offset-1">'
            + description
            + '</div></div>')

    try:
        b_refs = references
    except:
        b_refs = None

    if b_refs is not None and len(b_refs) > 5:
        refs = b_refs.split(',')
        if len(refs) > 1:
            data += ('<div class="row top-half"><div class="col-xs-10 col-xs-offset-1">' +
                     '<strong>References:</strong></div></div>')

        if len(refs) == 1:
            data += ('<div class="row top-half"><div class="col-xs-10 col-xs-offset-1">' +
                     '<strong>Reference:</strong></div></div>')

        for ref in refs:
            data += ('<div class="row"><div class="col-xs-9 col-xs-offset-2">'
                     + '<a href="' + ref + '">' + ref + '</a></div></div>'
                     )

    data += '<div class="row bottom-half"></div>'
    logger.debug('writing query description: ' + data)
    return data


def _make_header(scan_results, jobinfo):
    """TODO: change to file builder"""
    logger.debug("_make_header invoked with scan_results of length:" + str(len(scan_results)))
    # with open(os.path.join(FLOW_SCANNER_HOME, 'data', 'header.out'), mode='r', encoding="utf-8") as fp:
    #    data = fp.read()
    data = pkgutil.get_data(__name__, os.path.join('data', 'header.out')).decode()
    data += jobinfo.make_html(scan_results)
    data += _present_query_results(scan_results)
    return data


def _present_query_results(scan_results):
    """Builds html table summarizing query results.

    Results are sorted on:
    Security, Quality with decreasing severity levels:
    Critical, Serious, Warning
    finally by number of issues

    Args:
        scan_results: List<QueryData>

    Returns:
        string (html file)

    """
    data = ('<div class="row"><div class="col-xs-10 col-xs-offset-1">'
            '<table class="table table-hover table-responsive">'
            '<tr><th>Query</th><th>Group</th><th>Issues</th></tr>'
            )

    for query_data in scan_results:
        if int(query_data.tallies) > 0:
            rel_start = '<a href="#query_path' + query_data.query_path + u'">'
            rel_end = '</a>'
        else:
            rel_start = rel_end = ''
        data += ('<tr>'
                 '<td>' + rel_start + query_data.get_name() + rel_end + '</td>'
                                                                        '<td>' + query_data.get_group() + '</td>'
                 )
        if query_data.success is False:
            data += '<td>Query Failed to Complete</td>'
        elif int(query_data.tallies) == 0:
            data += '<td>No Issues Found</td>'
        else:
            data += '<td>' + str(query_data.tallies) + '</td>'

        data += '</tr>\n'

    data += '</table></div></div>'
    logger.info('writing data: ' + data)
    return data


def _make_footer(report_fp):
    report_path = os.path.join(FLOW_SCANNER_HOME, 'data', 'footer.out')
    # with codecs.open(report_path, 'r') as fp:
    #    data = fp.read()
    data = pkgutil.get_data(__name__, os.path.join('data', 'footer.out')).decode()
    if _safe_append(report_fp, data):
        return
    else:
        _bail('failed to write footer for report file at ' + report_path)


def _clean_up(element):
    if element is not None:
        element.clear()
        # while element.getprevious() is not None:
        #    del element.getparent()[0]


def _get_signature(element):
    if element is None:
        raise RuntimeError('tried to get signature of None element')
    elif element.tag == 'PathNode':
        try:
            filename = element.find('FileName').text.strip()
            line_no = element.find('Line').text.strip()
        except AttributeError:
            return None, None
        return filename, line_no

    elif element.tag == 'Path':
        return element.attrib['SimilarityId']


def parse_results(xml_file=None,
                  xml_report_str=None,
                  report_path=None,
                  failed_queries=None,
                  throttle=True,
                  source_dir=None,
                  email_add=None,
                  friendly_name=None,
                  job_type=None,
                  preset=None,
                  scan_start=None,
                  scan_end=None,
                  result_id=None,
                  service_version='3.0',
                  debug=False,
                  min_api_version=40.0,
                  help_url=None
                  ):
    """Parses Cx xml results file and generates HTML report.

        Parsing policy:

        * HTML write: For query, result, and Path events, We write HTML at start.
        * For pathNode, we write HTML at end..
        * query_data is instantiated in start of Query tags
        * query_data is updated at start events of Result tags (we count the number if results)
        * clean up occurs at end events.
        * query_data is inserted into result at end of Query tags
        * The footer is written at the end of the root elem.

        Attributes set during start events but not tag contents.

    Args:
        xml_file: unicode path of xml file containing results
        xml_report_str: unicode str of xml report (if file not provided)
        report_path: (required for report gen) unicode path where the
                     HTML report should be stored
        failed_queries: pulled from log file. list of query_paths that
                        failed.
        throttle: Boolean (whether to limit the number of issues found
                  per query)
        source_dir: unicode directory where source code is stored (on
                    Cx)
        email_add: unicode email address to which report should be sent
        friendly_name: unicode friendly name of scan
        job_type: unicode job type (TZ, Portal)
        preset: preset used
        scan_start: unicode scan start time
        scan_end: unicode scan end time
        result_id: scan queue id (on security org)
        service_version: version of popcrab + queries running this scan
        debug: True or False (for logging/tracing)
        min_api_version: float (flag lightning bundles of an earlier
                         version)
        help_url: url where report viewers can get more help

    Returns:
        job_info, List<QueryData> scan_results

    """

    # stores QueryData objects.
    jobinfo = JobInfo(email_add, friendly_name, job_type, preset, scan_start, scan_end,
                      result_id, service_version, help_url)

    scan_results = set()
    query_data = None
    report_fp = None
    query_data = None
    context = None
    root = None  # reference

    if scan_start is not None:
        scan_start = normalize_time(scan_start)

    if scan_end is not None:
        scan_end = normalize_time(scan_end)

    if report_path is not None:
        report_fp = open(report_path, mode='a', encoding='utf-8')
        logger.info("opening " + report_path)

    if xml_file is None and xml_report_str is not None:
         xml_file = io.StringIO(xml_report_str)

    elif xml_report_str is None and xml_file is None:
        raise ValueError("no xml file passed into function")

    context = CP.ET.iterparse(xml_file, events=('end', 'start'))

    query_printed = False  # track whether we have rendered this query

    event, root = next(context)  # grab root. c.f. http://effbot.org/zone/element-iterparse.htm

    jobinfo.update(root)
    logger.debug('preset is: ' + jobinfo.preset)
    parent = root

    for event, element in context:

        if event == 'start':

            element.getparent = lambda p=parent: p
            parent = element

            if element.tag == 'Query':
                query_printed = False
                query_data = QueryData(element.attrib['QueryPath'])

            if element.tag == 'Path':
                query_data.tallies += 1

                # Only print the query name once per result-set
                if (query_data.tallies == 1 and
                        report_fp is not None and
                        query_printed is False):
                    # render parent (result) info
                    query_printed = True
                    _report_append(element.getparent(), report_fp, source_dir)

                if report_fp is not None:
                    _report_append(element, report_fp,
                                   source_dir,
                                   query_data.tallies)

        if event == 'end':
            if element != root:
                parent = element.getparent()

            if element.tag == 'Query':
                scan_results.add(query_data)
                _clean_up(element)

            if element.tag == 'PathNode':
                if report_fp is not None:
                    _report_append(element, report_fp, source_dir)  # output node
                _clean_up(element)

            if element.tag == 'Path':
                _clean_up(element)

            if element.tag == RESULT_ROOT_TAG:
                if report_fp is not None:
                    logger.info("making footer")
                    _make_footer(report_fp)

    if report_fp is not None:
        logger.info("closing report file pointer")
        # close file handle since we will open at beginning
        report_fp.close()

        # add queries with no results or that failed
        scan_results = _update_results(scan_results, failed_queries, jobinfo.preset)

        # gen summaries to go at front of report
        scan_results = sorted(scan_results,
                              key=lambda elem: (elem.found_issues(),
                                                QUERY_GROUP_PRIORITY.get(elem.group, DEFAULT_PRIORITY),
                                                0 if elem.success else 1)
                              )
        _safe_prepend(report_path, _make_header(scan_results, jobinfo))

    if context is not None:
        del context

    return jobinfo, scan_results


def get_issues_for_org(scan_results, vuln_map):
    """Counts findings for each query

    Args:
        scan_results: List<Query Data> list of found issues
        vuln_map: map of scan info fields to CX issues e.g.
                  vuln_map[StoredXSS]=[cx_desc1,cx_desc2,] etc.

    (A bit inefficient since we loop through all queries rather than
    removing already used queries, but this is not a concern here.)

    Returns:
        a dictionary with keys = issue types in scan info and number of
        issues found

    """
    d = dict()

    for field in vuln_map:
        d[field] = 0
        for query_data in scan_results:
            if query_data.help_name in vuln_map[field]:
                d[field] += query_data.tallies
    d['type'] = SFDC_OBJECT_NAME

    return d


if __name__ == "__main__":
    print("tests are in test/ and integration_tests/ directory")
