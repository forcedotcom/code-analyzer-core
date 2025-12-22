"""Python module for parsing XML result file and generating HTML reports.

This module handles parsing of XML scan results and generation of HTML reports
for flow scanner results. It reads query descriptions from the package data.
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
# Compatibility:
#   Python 3 doesn't have a 'Unicode' function
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
    """Add query descriptions to module-level config file if not present.

    Call after loading any queries from disk. Must pass objects of type
    public.data_obj.QueryDescription.

    Args:
        list_of_desc: List of QueryDescription objects to add to config.

    Raises:
        ValueError: If query descriptions are already present in config.
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
        if desc.is_security:
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


def load_query_desc_from_config(path: str | None) -> None:
    """Load query descriptions from a config file.

    Args:
        path: Path to config file. If None, uses DEFAULT_DESC_CONFIG_PATH.
    """
    if path is None:
        path = DEFAULT_DESC_CONFIG_PATH
    if not os.path.exists(path):
        return None
    else:
        global QUERY_DESC
        QUERY_DESC.read_string(
            pkgutil.get_data(__name__, os.path.join("data", path)).decode()
        )
        return None


def add_to_presets(presets: list[str], preset_name: str) -> None:
    """Add a preset to the software presets dictionary.

    Args:
        presets: List of query names in the preset.
        preset_name: Name of the preset to add.
    """
    global SOFTWARE_PRESETS
    SOFTWARE_PRESETS[preset_name] = presets
    pass


def get_software_presets(preset_name: str) -> list[str]:
    """Get a software preset by name.

    Args:
        preset_name: Name of preset to retrieve.

    Returns:
        List of query names in this preset, or empty list if not found.
    """
    return dict.get(SOFTWARE_PRESETS, preset_name, [])


def serialize(portion: str | None, elem) -> str:
    """Serialize element from iterparse to string representation.

    .. note::
        iterparse returns bytestrings, not code points. This is true for events,
        tags, etc. Because we are using Unicode literals, decoding will occur.
        Decoding automatically occurs when concatenating a string with a Unicode
        code point.

    Args:
        portion: Portion to serialize ('start', 'end', or None).
        elem: XML Element to serialize.

    Returns:
        Serialized string representation of the element.

    Raises:
        RuntimeError: If portion is invalid.
    """

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


def escape(msg: str) -> str:
    """Escape HTML special characters in a string.

    Args:
        msg: String to escape.

    Returns:
        Escaped string with HTML entities.
    """
    msg = msg.replace("<", "&lt;")
    msg = msg.replace(">", "&gt;")
    msg = msg.replace("&", "&amp;")
    msg = msg.replace("\"", "&quot;")
    return msg


def normalize_query_path(s: str) -> str:
    """Normalize a query path string.

    Removes version information and normalizes path separators and spaces.

    Args:
        s: Query path string to normalize.

    Returns:
        Normalized query path.
    """
    index = s.rfind('Version:')
    if index > 1:
        t = s[:s.find('Version:')].strip()
    else:
        t = s.split(':')[0].strip()
    return t.replace('\\', '.').replace(' ', '_')


def _get_fallback_query(s: str) -> str | None:
    """Get default query in case no exact match found.

    If we override a query, the path changes, e.g. from::

        'Apex.Cx.General.SOQL_SOSL_Injection'

    to::

        'Apex.Corp.General.SOQL_SOSL_Injection'

    but we don't want to make a new query description entry. So we look
    through the description file to see if there is an existing description
    with the same short name.

    Args:
        s: The normalized query path found.

    Returns:
        Original normalized query path if found, None otherwise.
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


def get_query_for_config(path: str) -> str:
    """Get query path for config lookup, using fallback if needed.

    Args:
        path: Original query path.

    Returns:
        Query path to use for config lookup (original or fallback).
    """
    original_query = normalize_query_path(path)
    fallback = _get_fallback_query(original_query)
    if fallback is None:
        query_path = original_query
    else:
        query_path = fallback
    return query_path


def normalize_time(s: str | None) -> str | None:
    """Normalize a timestamp string.

    Args:
        s: Timestamp string to normalize.

    Returns:
        Normalized timestamp string, or None if input is None.
    """
    if s is not None and 'Z' in s:
        return s.replace('T', ' ').replace('Z', '')[:-4]
    else:
        return s


def truncate(msg: str, size: int = 40) -> str:
    """Truncate a string to a maximum length.

    Args:
        msg: String to truncate.
        size: Maximum length before truncation. Defaults to 40.

    Returns:
        Truncated string with "..." appended if truncated, original string otherwise.
    """
    return (msg[:size] + "...") if len(msg) > size else msg


def _make_scanner_help(help_url: str | None) -> str:
    """Generate HTML help message for scanner reports.

    Args:
        help_url: Optional URL to scanner help page.

    Returns:
        HTML string with help message.
    """
    if help_url is not None:
        msg = ('<div class="row"><div class="col-xs-10">'
               'For any questions about this service, please consult the scanner help page at'
               f'<a href="{help_url}">{help_url}</a></div></div>')
    else:
        msg = ('<div class="row"><div class="col-xs-10">'
               'Please verify and then address all security issues in this report</div></div>')
    return msg


def reverse_map(vuln_map: dict) -> dict:
    """Reverse a vulnerability mapping dictionary.

    Converts from a dict of field names to vulnerability name lists,
    to a dict of vulnerability names to field name lists.

    Args:
        vuln_map: Dictionary mapping field names to lists of vulnerability names.

    Returns:
        Dictionary mapping vulnerability names to lists of field names.
    """
    rev_map = {}
    for key in vuln_map:
        for val in vuln_map[key]:
            if val not in rev_map:
                rev_map[val] = []
                rev_map[val].append(key)
    return rev_map


def _bail(msg: str, exception: type[Exception] = Exception) -> None:
    """Log a critical error and raise an exception.

    Args:
        msg: Error message.
        exception: Exception class to raise. Defaults to Exception.

    Raises:
        exception: Always raises the specified exception type.
    """
    logger.critical(PARSE_ERROR + msg)
    raise exception(msg)


def _safe_append(fp, data: str) -> bool:
    """Safely append Unicode data to a file pointer.

    Does not throw exceptions - logs errors instead.

    Args:
        fp: File pointer to write to.
        data: Unicode string data to append.

    Returns:
        True if write succeeded, False otherwise.
    """
    # TODO: email exception?
    try:
        fp.write(data)
        return True
    except:
        logger.critical('Error writing data ' + str(data) + ' to file pointer '
                        + repr(fp) + " " + traceback.format_exc())
        return False


def _safe_prepend(filepath: str, data: str) -> bool:
    """Safely prepend data to a file.

    Does not throw exceptions - logs errors instead.

    Args:
        filepath: Path to file to prepend to.
        data: String data to prepend.

    Returns:
        True if prepend succeeded, False otherwise.
    """
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


def count_issues(scan_results) -> tuple[int, int]:
    """Count security and quality issues from scan results.

    Args:
        scan_results: List of QueryData objects from scan.

    Returns:
        Tuple of (security_issues_count, quality_issues_count).
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
    """Stores metadata about a scan job.

    Attributes:
        email_add: Email address for the scan.
        friendly_name: Friendly name/description of the scan.
        job_type: Type of job (e.g., 'Portal').
        preset: Preset name used for the scan.
        scan_start: Scan start timestamp.
        scan_end: Scan end timestamp.
        result_id: Scan result ID.
        cx_version: Checkmarx version.
        service_version: Service version string.
        lightning_api_version: Lightning API version if applicable.
        lightning_api_too_low: Whether Lightning API version is too low.
        help_url: URL to help documentation.
    """

    def __init__(self,
                 email_add: str | None,
                 friendly_name: str | None,
                 job_type: str | None,
                 preset: str | None,
                 scan_start: str | None,
                 scan_end: str | None,
                 result_id: str | None,
                 service_version: str,
                 lightning_api_version: str | None = None,
                 lightning_api_too_low: bool = False,
                 help_url: str | None = None):

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

    def update(self) -> None:
        """Populate missing parameters with default values.

        Attempts to populate params from root XML element attributes.
        Sets default values for any None attributes.
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

    def make_html(self, scan_results) -> str:
        """Generate HTML report metadata section.

        Args:
            scan_results: List of QueryData objects from scan.

        Returns:
            HTML string containing report metadata.
        """
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
    """Stores data about a query and its results.

    Attributes:
        query_path: Normalized query path.
        success: Whether query executed successfully.
        tallies: Number of issues found.
        name: Query name from config.
        group: Query group/severity from config.
        references: Reference URLs from config.
        security: Whether this is a security query ('1') or quality ('0').
        help_name: Short name for help lookup.
    """

    def __init__(self, path: str):
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

    def get_name(self) -> str:
        """Get formatted query name.

        Returns:
            Query name with underscores replaced by spaces.
        """
        # TODO: Have a real dictionary, but currently we get rid of underscores only
        return self.name.replace('_', ' ')

    def get_group(self) -> str:
        """Get formatted query group.

        Returns:
            Query group with underscores replaced by spaces.
        """
        # TODO: Have a real dictionary as above
        return self.group.replace('_', ' ')

    def found_issues(self) -> int:
        """Check if query found issues.

        Returns:
            0 if issues found, 1 otherwise (for sorting).
        """
        if self.success and (int(self.tallies) > 0):
            return 0
        else:
            return 1

    def isSecurity(self) -> bool:
        """Check if this is a security query.

        Returns:
            True if security query, False if quality query.
        """
        return self.security == '1'


def _report_append(element, report_fp, tallies: int | None = None) -> None:
    """Convert element to appropriate HTML report line.

    In the future, should use XSLT, but currently our transforms are very
    simple and on a streaming per-element basis, so there is not a lot of
    structure to the tag transforms that happen.

    Args:
        element: XML Element to convert.
        report_fp: File pointer to write HTML to.
        tallies: Optional tally count for path elements.
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

        source = None
        snippet = element.find('Snippet')
        if snippet is not None:
            source = snippet.find('Line').find('Code').text.strip()

        filename = element.find('FileName').text
        flow_type = element.find('FlowType').text
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
    return None


def _append_overflow(report_fp, max_results: int) -> None:
    """Append overflow message to report when results are truncated.

    Args:
        report_fp: File pointer to write to.
        max_results: Maximum number of results shown.
    """
    data = ('<div class = "row">'
            '<div class = "col-xs-9 col-xs-offset-2">'
            '<strong>Only the first ' + str(max_results) +
            ' results have been shown</strong>'
            '</div></div>'
            )
    _safe_append(report_fp, data)


def _add_source(source_dir: str, filename: str, target_line_no: int, obj_name: str) -> tuple[int, str | None]:
    """Add source line from file (OBSOLETE).

    .. deprecated::
        This function is obsolete and may be removed in future versions.

    Adds line from source if possible. As the XML line number has off-by-one
    errors, we first look for the object in the provided line, and if not
    present, we look for the object in the previous line.

    Args:
        source_dir: Directory containing source files.
        filename: Name of source file.
        target_line_no: Target line number to extract.
        obj_name: Object name to search for in line.

    Returns:
        Tuple of (line_number, source_line). Returns (-1, None) on error.
    """

    try:
        if os.sep != u'\\':
            # we are running on Linux/Mac
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


def _update_results(scan_results, failed_scans: list[str] | None, preset: str):
    """Update scan results with failed and missing queries.

    Newer versions of CX omit <Query> nodes in the XML file when the query
    succeeds and no issues are found or when the query fails. This function
    patches the results to include these missing queries.

    Args:
        scan_results: Results from the (reduced) XML file (set of QueryData).
        failed_scans: List of QueryPaths from logfile, or None.
        preset: Name of the preset used.

    Returns:
        Enlarged scan_results set with additional failed QueryData or missing
        QueryData. This should be called to patch scan_results before report
        HTML table is generated.
    """
    keys = [q.query_path for q in scan_results]
    failed = []

    if failed_scans is not None:
        failed = [normalize_query_path(x) for x in failed_scans]
        failed_q = [QueryData(x) for x in failed if x not in keys]

        for q in failed_q:
            q.success = False
            scan_results.add(q)

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


def _make_query_desc(query_path: str) -> str:
    """Generate HTML description section for a query.

    Args:
        query_path: Query path to get description for.

    Returns:
        HTML string containing query description and references.
    """
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


def _make_header(scan_results, jobinfo: JobInfo) -> str:
    """Generate HTML header section for report.

    Args:
        scan_results: List of QueryData objects.
        jobinfo: JobInfo object with scan metadata.

    Returns:
        HTML string containing report header.
    """
    logger.debug("_make_header invoked with scan_results of length:" + str(len(scan_results)))
    # with open(os.path.join(FLOW_SCANNER_HOME, 'data', 'header.out'), mode='r', encoding="utf-8") as fp:
    #    data = fp.read()
    data = pkgutil.get_data(__name__, os.path.join('data', 'header.out')).decode()
    data += jobinfo.make_html(scan_results)
    data += _present_query_results(scan_results)
    return data


def _present_query_results(scan_results) -> str:
    """Build HTML table summarizing query results.

    Results are sorted on:
    - Security, Quality
    - Decreasing severity levels: Critical, Serious, Warning
    - Finally by number of issues

    Args:
        scan_results: List of QueryData objects.

    Returns:
        HTML string containing results table.
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


def _make_footer(report_fp) -> None:
    """Write footer to report file.

    Args:
        report_fp: File pointer to write footer to.

    Raises:
        Exception: If footer cannot be written.
    """
    report_path = os.path.join(FLOW_SCANNER_HOME, 'data', 'footer.out')
    # with codecs.open(report_path, 'r') as fp:
    #    data = fp.read()
    data = pkgutil.get_data(__name__, os.path.join('data', 'footer.out')).decode()
    if _safe_append(report_fp, data):
        return
    else:
        _bail('failed to write footer for report file at ' + report_path)


def _clean_up(element) -> None:
    """Clean up XML element to free memory.

    Args:
        element: XML Element to clean up.
    """
    if element is not None:
        element.clear()
        # while element.getprevious() is not None:
        #    del element.getparent()[0]


def _get_signature(element) -> tuple[str, str] | str | None:
    """Get signature from an XML element.

    Args:
        element: XML Element to extract signature from.

    Returns:
        For PathNode: (filename, line_no) tuple.
        For Path: SimilarityId string.
        None for other elements or on error.

    Raises:
        RuntimeError: If element is None.
    """
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
    return None


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
    """Parses XML results file and generates HTML report.

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
        xml_file: unicode path of XML file containing results
        xml_report_str: unicode str of XML report (if file not provided)
        report_path: (required for report gen) Unicode path where the
                     HTML report should be stored
        failed_queries: pulled from log file. list of query_paths that
                        failed.
        throttle: Boolean (whether to limit the number of issues found
                  per query)
        source_dir: unicode directory where source code is stored
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
    report_fp = None
    query_data = None

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

    jobinfo.update()
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
                    _report_append(element.getparent(), report_fp)

                if report_fp is not None:
                    _report_append(element, report_fp,
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


def get_issues_for_org(scan_results, vuln_map: dict) -> dict:
    """Count findings for each query by organization field.

    Args:
        scan_results: List of QueryData objects with found issues.
        vuln_map: Map of scan info fields to issue descriptions, e.g.
            vuln_map[StoredXSS] = [desc1, desc2, ...].

    Returns:
        Dictionary with keys = issue types in scan info and values = number
        of issues found, plus 'type' key set to SFDC_OBJECT_NAME.
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
