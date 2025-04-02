"""Serializes results and interacts with
   third party report processors

    @author: rsussland@salesforce.com
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime
from typing import TextIO

sys.modules['_elementtree'] = None
from public.custom_parser import ET, clean_string
import public.custom_parser as CP

from flowtest import ESAPI
from flowtest import flow_metrics
from flowtest.version import __version__
from public.data_obj import QueryResult, Preset, InfluenceStatementEncoder

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
        self.stored_results: [QueryResult] = []

        # dictionary of results sorted by query_name
        self.results_dict: {str: {}} = None

        # xml report string
        self.report_xml: str | None = None

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
                    start_path = statements[0].flow_path
                    counter = flow_result["counter"]

                    result_str += (f'<Result NodeId="{counter}" '
                                   f'FileName="{ESAPI.html_encode(start_path)}">'
                                   f'<Path SimilarityId="{counter}FT">')
                    for index, node in enumerate(statements):
                        filename = node.flow_path
                        line = node.line_no
                        code = ESAPI.html_encode(clean_string(node.source_text))
                        result_str += f"<PathNode><FileName>{ESAPI.html_encode(filename)}</FileName>"
                        result_str += f"<Line>{line}</Line>"
                        # TODO: currently we hardcode but should get real columns
                        result_str += f"<Column>1</Column>"
                        result_str += f"<NodeId>{index}</NodeId>"
                        result_str += f"<Name>{ESAPI.html_encode(node.influenced_var)}</Name>"

                        # Add Snippet
                        result_str += f"<Snippet><Line><Number>{line}</Number>"
                        result_str += f"<Code>{code}</Code></Line></Snippet></PathNode>"
                    # End Loop over histories (nodes within a path)
                    result_str += "</Path>"
                    result_str += "</Result>"
                # End loop over results (paths)
                result_str += "</Query>"
        # End all loops
        result_str += "</CxXMLResults>"

        self.report_xml = _validate_and_prettify_xml(result_str)

        return self.report_xml

    def add_results(self, query_results: [QueryResult]) -> None:
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
        else:
            self.stored_results = _merge_results(
                self.stored_results + query_results
            )

    def gen_result_dict(self) -> {str: {str: str}}:
        """Sorts results into query buckets

        Used internally to generate popcrab compatible
        xml and html report formats.
        
        Also useful for testing

        Returns:
            dictionary of the form::

              query_id -> {flow: tuple of DataInfluenceStatements,
                             query_name: (human_readable),
                             counter: (fake similarity id),
                             elem: source code of element
                             elem_name: name of Flow Element
                             field: name of influenced variable}

        """

        query_results = self.stored_results
        accum = {}
        if query_results is None or len(query_results) == 0:
            return {}

        for query_result in query_results:
            query_desc = self._get_query_desc_from_id(query_result.query_id)
            end_stmt = query_result.influence_statement

            query_path = query_result.query_id

            # Initialize
            if query_path not in accum:
                accum[query_path] = []

            if query_result.paths is None:
                statements = [end_stmt]

            else:
                statements = [x.history + (end_stmt,) for x in query_result.paths]

            for stmt in statements:
                accum[query_path].append({"flow": stmt,
                                          "query_name": query_desc.query_name,
                                          "severity": str(query_desc.severity),
                                          "description": query_desc.query_description,
                                          "counter": self.counter,
                                          "elem": clean_string(end_stmt.source_text),
                                          "elem_name": end_stmt.element_name,
                                          "field": end_stmt.influenced_var})

                # TODO: this is a placeholder for real similarity analysis, if needed.
                self.counter += 1
        self.results_dict = accum
        return accum

    def _make_query_id_to_path_dict(self) -> {str: str}:
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
                      "flowtest_version": __version__,
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


def _merge_results(results: list[QueryResult]) -> [QueryResult]:
    """Return new list with consolidated paths

        The crawler necessarily visits the same Flow element
        a few times (because of loops, goto statements, etc.)

        This can create duplicate results. We want to remove
        these using set addition.

        .. Note:: For this to work, we need to avoid putting comments
                  in influence statements such as "done in step X" as this
                  will make them be different statements and not consolidated.


    Args:
        results: list of QueryResult objects

    Returns:
        deduplicated list. Incoming list is not altered.
    """
    # This function is not in the mood for garbage
    assert results is not None and len(results) > 0

    # instead of merging in place, we return a new list
    # and mark with skips those elements that have been merged.

    new_list = []  # accumulator for results
    r_indices = list(range(len(results)))  # indices of result

    while len(r_indices) > 0:
        qr = results[r_indices.pop(0)]

        new_paths = set(list(qr.paths))

        candidates = [x for x in r_indices]  # make a copy for iteration

        for i in candidates:
            working = results[i]
            if _is_match(qr, working) is True:
                assert working.paths is not None
                new_paths.update(working.paths)
                r_indices.remove(i)

        new_list.append(QueryResult(
            query_id=qr.query_id,
            influence_statement=qr.influence_statement,
            paths=frozenset(new_paths)
            )
        )

    return new_list


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
            logger.error(f"ERROR: an null query result was included in the result list"
                         f" {qr_list}")
            to_skip.add(index)
        if qr.query_id is None:
            logger.error(f"ERROR: received a query result without a query: {qr}")
            to_skip.add(index)
        if qr.influence_statement is None:
            logger.error(f"ERROR: received a query result without "
                         f"an influence statement: {qr}")
            to_skip.add(index)
        if qr.paths is None:
            logger.error(f"ERROR: received a query result without paths: {qr}")
            to_skip.add(qr)

    if len(to_skip) == 0:
        return qr_list
    else:
        to_return = [qr_list[i] for i in range(len(qr_list)) if i not in to_skip]
        if len(to_return) == 0:
            return None
        else:
            return to_return


def _is_match(qr_a: QueryResult, qr_b: QueryResult) -> bool:
    """ Are these results pointing to the same result?

    Args:
        qr_a: QueryResult
        qr_b: QueryResult

    Returns:
        True if they have paths which can be consolidated
    """

    # both the actual query and the influence statement must match
    # ..then the paths can be combined
    return (qr_a.query_id == qr_b.query_id and
            qr_a.influence_statement == qr_b.influence_statement)
