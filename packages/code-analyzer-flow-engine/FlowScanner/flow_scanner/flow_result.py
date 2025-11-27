"""Serializes results and interacts with
   third party report processors

    @author: rsussland@salesforce.com
"""
from __future__ import annotations

import copy
import dataclasses
import json
import logging
import sys
from datetime import datetime
from typing import TextIO

sys.modules['_elementtree'] = None
from public.custom_parser import ET, clean_string
import public.custom_parser as CP

from flow_scanner import ESAPI
from flow_scanner import flow_metrics
from flow_scanner.version import __version__
from public.data_obj import QueryResult, Preset, InfluenceStatementEncoder, InfluenceStatement
from public.enums import FlowType
DEFAULT_HELP_URL = "https://security.secure.force.com/security/tools/forcecom/scannerhelp"
DEFAULT_JOB_TYPE = "FlowSecurityCLI"

logger = logging.getLogger(__name__)




class ResultsProcessor(object):
    """Class storing all the information necessary for a report.

        This includes labelling information like the report requested,
        scan start time, etc., as well as the results of the findings.

        The class contains methods to take this information and generate
        json, xml and html reports.
    """

    def __init__(self, preset: Preset = None, requestor="System", report_label=None,
                 result_id="default", service_version=__version__, help_url=DEFAULT_HELP_URL):

        self.preset: Preset | None = preset
        self.help_url: str = help_url
        self.result_id: str = result_id  # Id to assign to scan result, appears in reports
        self.service_version: str = service_version  # Version of job management system running scan jobs
        self.email: str = requestor  # email address of result recipient

        if report_label is None:
            report_label = "flowscan run at %s" % str(datetime.now())[:-7]
        # report label is a human-readable label assigned to this scan
        self.friendly_name: str = report_label
        self.counter: int = 0
        self.scan_start: str = str(datetime.now())  # should be overriden
        self.scan_end: str = self.scan_start  # should be overridden

        # deduplicated stored query results
        self.stored_results: list[QueryResult] = []

        # dictionary of results sorted by query_name
        self.results_dict: dict[str, dict] | None = None

        # map from filepath to root element
        self.root_map: dict[str, ET.Element] | None = None

        # xml report string
        self.report_xml: str | None = None

    def get_root(self, filepath: str):
        if self.root_map is not None and filepath not in self.root_map:
            return self.root_map[filepath]
        else:
            try:
                root = CP.get_root(filepath)
                if self.root_map is None:
                    self.root_map = {filepath: root}
                else:
                    self.root_map[filepath] = root
                return root

            except:
                logger.error("Failed to get root element from %s" % filepath)
                return None

    def write_html(self, html_report_path: str):
        """Writes html report to disk

        Args:
            html_report_path: where to write html report

        Returns:
            metrics (results) of issues sorted and counted.

        """
        if self.report_xml is None:
            self.get_cx_xml_str()

        if (self.preset is None or self.preset.preset_name is None
                or len(self.preset.queries) == 0):
            raise RuntimeError("Cannot generate html as no valid preset is set")

        presets = [x.query_id.strip() for x in self.preset.queries]

        # Notify metrics of which queries were run
        flow_metrics.add_to_presets(preset_name=self.preset.preset_name,
                                    presets=presets)

        # Load query descriptions in metrics
        flow_metrics.add_to_query_config(list(self.preset.queries))

        # now generate report
        results = flow_metrics.parse_results(xml_report_str=self.report_xml,
                                             failed_queries=None,
                                             throttle=False,
                                             report_path=html_report_path,
                                             source_dir=None,
                                             email_add=self.email,
                                             friendly_name=self.friendly_name,
                                             scan_start=self.scan_start,
                                             scan_end=self.scan_end,
                                             preset=self.preset.preset_name,
                                             job_type=DEFAULT_JOB_TYPE,
                                             service_version=self.service_version or __version__,
                                             debug=False,
                                             result_id=self.result_id,
                                             help_url=self.help_url
                                             )
        return results

    def dump_json(self, fp: TextIO) -> None:
        """Write json string of results to file pointer

        Returns:
            None

        """
        job_result = self._make_job_result()
        json.dump(job_result, indent=4, fp=fp, cls=InfluenceStatementEncoder)

    def get_json_str(self) -> str:
        """get json result string

        Returns:
            string that serializes list of QueryResult objects

        """
        job_result = self._make_job_result()

        return json.dumps(job_result, indent=4, cls=InfluenceStatementEncoder)

    def get_cx_xml_str(self):
        """Converts results to popcrab compatible report format

        Returns:
            report xml string
        """

        id2path_dict = self._make_query_id_to_path_dict()
        if self.results_dict is None:
            self.gen_result_dict()

        result_dict = self.results_dict

        if result_dict is None or len(result_dict) == 0:
            self.report_xml = '<?xml version="1.0" encoding="utf-8"?><CxXMLResults></CxXMLResults>'
            return self.report_xml

        result_str = '<?xml version="1.0" encoding="utf-8"?><CxXMLResults>'
        for query_id in result_dict:
            results = result_dict[query_id]

            if len(results) > 0:
                query_path = ESAPI.html_encode(id2path_dict[query_id])
                query_name = ESAPI.html_encode(result_dict[query_id][0]['query_name'])
                result_str += f'<Query name="{query_name}" QueryPath="{query_path}">'
                for flow_result in results:
                    statements = flow_result["flow"]
                    var_name = flow_result["elem_name"]
                    code = flow_result["elem_code"]
                    line = flow_result["elem_line_no"]
                    filename = flow_result["filename"]
                    flow_type = flow_result["flow_type"]
                    counter = flow_result["counter"]
                    field = flow_result["field"]
                    if field is not None:
                        var_name = field

                    if statements is None:
                        # this is a lexical query, therefore
                        # the following are required
                        assert var_name is not None
                        assert code is not None
                        assert line is not None
                        assert filename is not None
                        result_str += make_path_node_header(filename=filename,
                                                            flow_type=flow_type,
                                                            similarity_id=counter)
                        result_str += render_html_pathnode(filename=filename,
                                                           flow_type=flow_type,
                                                           influenced_var=var_name,
                                                           code=code,
                                                           line=line,
                                                           node_id=counter)

                    elif len(statements) == 1 and code is not None:
                        # We have a single statement query with code provided in the
                        # top level, so we want to generate a two node report with the
                        # first node in the query result top level and the second node
                        # the influencer of the statement
                        assert var_name is not None or filename is not None or line is not None

                        result_str += make_path_node_header(filename=filename, flow_type=flow_type, similarity_id=counter)

                        # make the first node from the top level query result
                        result_str += render_html_pathnode(filename=filename,
                                                           flow_type=flow_type,
                                                           influenced_var=var_name,
                                                           line=line,
                                                           node_id=counter,
                                                           code=code)
                        # add second node from statement
                        result_str += render_normal_dataflow_html(statements, flow_type, start_node_id=1)


                    else:
                        start_path = statements[0].source_path

                        result_str += make_path_node_header(filename=start_path, flow_type=flow_type, similarity_id=counter)
                        result_str += render_normal_dataflow_html(statements, flow_type)

                    # End Loop over histories (nodes within a path)
                    result_str += "</Path>"
                    result_str += "</Result>"
                # End loop over results (paths)
                result_str += "</Query>"
        # End all loops
        result_str += "</CxXMLResults>"

        self.report_xml = _validate_and_prettify_xml(result_str)

        return self.report_xml

    def add_results(self, query_results: list[QueryResult]) -> None:
        """Add results to processor

        Stores results internally for simple de-duplication.
        All we do is use datapath equality, so please don't put
        unique comment strings containing things like step number
        or timestamps into influence statements, as they wont be
        de-duped.

        Args:
            query_results: list of Query-Result objects

        Returns:
            None
        """
        query_results = _validate_qr(query_results)

        if query_results is None:
            return
        if self.stored_results is None:
            self.stored_results = list(set(query_results))
        else:
            self.stored_results = list(set(self.stored_results + query_results))

    def gen_result_dict(self) -> dict[str, dict[str, str]]:
        """Sorts results into query buckets

        Used internally to generate popcrab compatible
        xml and html report formats.
        
        Also useful for testing

        Returns:
            dictionary of the form::

              query_id -> {flow: tuple of DataInfluenceStatements or None (in case this is a dataflow)
                           query_name: (human_readable),
                           counter: (fake similarity id),
                           elem: source code of element,
                           elem_name: name of Flow Element,
                           elem_code: source code of element,
                           elem_line_no: line number of element,
                           field: name of influenced variable (if any) within the element,
                          }

        """

        query_results = self.stored_results
        accum = {}
        if query_results is None or len(query_results) == 0:
            return {}

        for query_result in query_results:
            query_desc = self._get_query_desc_from_id(query_result.query_id)
            end_stmt = query_result.influence_statement

            query_path = query_result.query_id
            src_code = query_result.elem_code
            src_line = query_result.elem_line_no
            flow_type = query_result.flow_type.name
            file_name = query_result.filename
            elem_name = query_result.elem_name

            if end_stmt is not None:
                src_code = clean_string(end_stmt.source_text)
                elem_name = end_stmt.element_name
                field_end = end_stmt.influenced_var
                src_line = end_stmt.line_no
                file_name = end_stmt.flow_path

            else:
                src_code_end = None
                elem_name_end = None
                field_end = None

            # Initialize
            if query_path not in accum:
                accum[query_path] = []

            to_append = {"query_id": query_desc.query_id,
                         "query_name": query_desc.query_name,
                         "severity": str(query_desc.severity),
                         "description": query_desc.query_description,
                         "counter": self.counter,
                         "elem_name": elem_name,
                         "field": field_end or elem_name,
                         "elem_code": src_code,
                         "elem_line_no": src_line,
                         "filename": file_name,
                         "flow_type": flow_type}

            if query_result.paths is None or len(query_result.paths) == 0:
                if end_stmt is None:
                    # if there is no statement, this is a lexical query only and
                    # the data should be in the query top level structure.
                    assert (query_result.elem_name is not None and
                            query_result.elem_code is not None and
                            query_result.elem_line_no is not None and
                            query_result.filename is not None)

                    to_append["flow"] = None
                    accum[query_path].append(to_append)
                    self.counter += 1
                    # process the next query result
                    continue

                else:
                    # if there are no paths but there is a statement, then
                    # build the query result from the statement.
                    statements = [(end_stmt,)]


            else:
                # if there are paths in the query, then there must be
                # a query statement that contains the last portion of the path
                assert query_result.paths is not None and len(query_result.paths) > 0

                statements = []
                for path_ in query_result.paths:
                    pruned_history = tuple( [fix_names(x) for x in path_.history if x.source_text != "[builtin]"])

                    if end_stmt is not None:
                        if path_.history[-1] != end_stmt and end_stmt.source_text != "[builtin]":
                            statements.append(pruned_history + (end_stmt,))
                        else:
                            statements.append(pruned_history + (end_stmt,))
                    else:
                        statements.append(pruned_history)

            # Now we have our statements normalized and are prepared to render dataflows
            for path_ in statements:
                new_path = copy.deepcopy(to_append)
                new_path["flow"] = path_
                new_path["counter"] = self.counter
                accum[query_path].append(new_path)

            # TODO: this is a placeholder for real similarity analysis, if needed.
            self.counter += 1
        self.results_dict = accum
        return accum

    def _make_query_id_to_path_dict(self) -> dict[str, str]:
        """Generate a dictionary from query_id to query_path

        e.g. foo bar -> foo\\bar: Version X

        Returns:
            dictionary
        """
        return {x.query_id: x.query_id.strip().replace(".", "\\") + f" Version: {x.query_version.strip()}"
                for x in self.preset.queries}

    def _make_job_result(self):
        if self.results_dict is None:
            self.gen_result_dict()

        job_result = {"preset": self.preset.preset_name,
                      "help_url": self.help_url,
                      "result_id": self.result_id,
                      "service_version": self.service_version,
                      "flow_scanner_version": __version__,
                      "report_label": self.friendly_name,
                      "email": self.email,
                      "scan_start": self.scan_start,
                      "scan_end": self.scan_end,
                      "results": self.results_dict or {}
                      }
        return job_result

    def _get_query_desc_from_id(self, query_id: str):
        descriptions = self.preset.queries
        for x in descriptions:
            if x.query_id == query_id:
                return x
        raise ValueError(f"No query with id {query_id} is in the preset provided")


def _validate_and_prettify_xml(xml_str: str) -> str:
    """Pretty print and validate generated xml string

    Args:
        xml_str: string to validate

    Returns:
        validated/beautified xml_string
    """
    my_root = CP.get_root_from_string(bytes(xml_str, encoding='utf-8'))
    ET.indent(my_root)
    return CP.to_string(my_root)


def render_normal_dataflow_html(statements: tuple[InfluenceStatement, ...], flow_type: str, start_node_id: int = 0) -> str:
    result_str = ''
    for index, node in enumerate(statements, start=start_node_id):
        filename = node.source_path
        line = node.line_no
        code = clean_string(node.source_text)
        result_str += render_html_pathnode(filename=filename,
                                           flow_type=flow_type,
                                           influenced_var=node.influenced_var,
                                           line=line,
                                           node_id=index,
                                           code=code)
    return result_str


def render_html_pathnode(filename: str, flow_type: str, influenced_var: str, line: int, node_id: int, code: str) -> str:
    if influenced_var == '*':
        influenced_var = 'start'

    result_str = f"<PathNode><FileName>{ESAPI.html_encode(filename)}</FileName>"
    result_str += f"<FlowType>{flow_type}</FlowType>"
    result_str += f"<Line>{line}</Line>"
    result_str += f"<Column>1</Column>"
    result_str += f"<NodeId>{node_id}</NodeId>"
    result_str += f"<Name>{ESAPI.html_encode(influenced_var)}</Name>"
    result_str += f"<Snippet><Line><Number>{line}</Number>"
    result_str += f"<Code>{ESAPI.html_encode(code)}</Code></Line></Snippet></PathNode>"
    return result_str


def make_path_node_header(filename: str, flow_type: str, similarity_id: int = 0) -> str:
    return (f'<Result NodeId="{similarity_id}" FileName="{ESAPI.html_encode(filename)}" FlowType="{flow_type}">'
            f'<Path SimilarityId="{similarity_id}FT">')


def _validate_qr(qr_list: list[QueryResult]) -> list[QueryResult] | None:
    """Checks query result for correctness

    Args:
        qr_list: Query Result list to validate

    Returns:
        list of valid QueryResults with invalid results removed
        None if the list was None
    """
    if qr_list is None or len(qr_list) == 0:
        return None

    to_skip = set()
    for index, qr in enumerate(qr_list):
        if qr is None:
            logger.critical(f"ERROR: an null query result was included in the result list"
                         f" {qr_list}")
            to_skip.add(index)
        if qr.query_id is None:
            logger.critical(f"ERROR: received a query result without a query: {qr}")
            to_skip.add(index)
        if qr.influence_statement is None and qr.elem_code is None and qr.paths is None:
            logger.critical(f"ERROR: received a query result without "
                         f"an influence statement, query code, or paths: {qr}")
            to_skip.add(index)
        if qr.paths is not None and not isinstance(qr.paths, frozenset):
            to_skip.add(index)
            logger.critical(f"ERROR: received a query result with a non-frozenset paths field")

    if len(to_skip) == 0:
        return qr_list
    else:
        to_return = [qr_list[i] for i in range(len(qr_list)) if i not in to_skip]
        if len(to_return) == 0:
            return None
        else:
            return to_return


def fix_names(x: InfluenceStatement) -> InfluenceStatement:
    new_influenced = None
    new_influencer = None

    if x.influenced_var == '*':
        new_influenced = 'start'

    elif x.influenced_var == '*':
        new_influencer = 'start'

    return dataclasses.replace(x,
                               influencer_var=new_influencer or x.influencer_var,
                               influenced_var=new_influenced or x.influenced_var)


