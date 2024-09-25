"""Default Queries to be run for Security Review of Flows

    BETA - Under testing but not ready for production

"""
from __future__ import annotations

from typing import TYPE_CHECKING
import logging

if TYPE_CHECKING:
    from lxml import etree as ET

from public import parse_utils
from public.data_obj import DataInfluenceStatement, QueryResult

from public.data_obj import QueryDescription, Preset
from public.enums import Severity
from public.contracts import QueryProcessor, FlowParser, State

logger = logging.getLogger(__name__)

default_preset = 'pentest'

presets = {'pentest': {'name': 'Penetration Testing',
                       'owner': 'rsussland@salesforce.com',
                       'queries': """FlowSecurity.SystemModeWithoutSharing.recordUpdates.data
FlowSecurity.SystemModeWithoutSharing.recordCreates.data
FlowSecurity.SystemModeWithoutSharing.recordUpdates.selector
FlowSecurity.SystemModeWithoutSharing.recordDeletes.selector
FlowSecurity.SystemModeWithoutSharing.recordLookups.selector
FlowSecurity.SystemModeWithSharing.recordCreates.data
FlowSecurity.SystemModeWithSharing.recordUpdates.data
FlowSecurity.SystemModeWithSharing.recordUpdates.selector
FlowSecurity.SystemModeWithSharing.recordDeletes.selector
FlowSecurity.SystemModeWithSharing.recordLookups.selector"""},
           'all': {'name': 'All',
                   'owner': 'rsussland@salesforce.com',
                   'queries': """FlowSecurity.SystemModeWithoutSharing.recordUpdates.data
FlowSecurity.SystemModeWithoutSharing.recordCreates.data
FlowSecurity.SystemModeWithoutSharing.recordUpdates.selector
FlowSecurity.SystemModeWithoutSharing.recordDeletes.selector
FlowSecurity.SystemModeWithoutSharing.recordLookups.selector
FlowSecurity.SystemModeWithSharing.recordUpdates.data
FlowSecurity.SystemModeWithSharing.recordCreates.data
FlowSecurity.SystemModeWithSharing.recordUpdates.selector
FlowSecurity.SystemModeWithSharing.recordDeletes.selector
FlowSecurity.SystemModeWithSharing.recordLookups.selector
FlowSecurity.DefaultMode.recordUpdates.data
FlowSecurity.DefaultMode.recordCreates.data
FlowSecurity.DefaultMode.recordUpdates.selector
FlowSecurity.DefaultMode.recordDeletes.selector
FlowSecurity.DefaultMode.recordLookups.selector"""
                   }
           }

QUERY_IDS = []


def build_preset(preset_name: str = default_preset):
    if preset_name is None:
        preset_name = default_preset

    if preset_name not in presets.keys():
        return None

    preset = presets[preset_name]
    pr_name = preset['name']
    pr_owner = preset['owner']
    query_ids = preset['queries'].split("\n")
    query_id_list = [x.strip() for x in query_ids]
    if len(QUERY_IDS) == 0:
        [QUERY_IDS.append(x.strip()) for x in query_ids if len(x) > 0]

    queries = {build_query_desc_from_id(x) for x in QUERY_IDS}

    return Preset(preset_name=pr_name,
                  preset_owner=pr_owner,
                  queries=queries)


class DefaultQueryProcessor(QueryProcessor):
    """Default queries to run if user does not load a query file

    """

    def __init__(self) -> None:
        #: preset selected by user
        self.preset: Preset | None = None

        #: taint sources are populated on flow enter
        self.sources: {(str, str)} = set()

        #: flow parser
        self.parser: FlowParser | None = None

        #: flow (xml) root
        self.root: ET._Element

        #: path of flow
        self.flow_paths: [str] = None

    def set_preset_name(self, preset_name: str | None) -> Preset | None:
        self.preset = build_preset(preset_name)
        return self.preset

    def handle_crawl_element(self, state: State) -> list[QueryResult] | None:
        return self.process_element(state.get_current_elem(), state)

    def handle_flow_enter(self, state: State) -> list[QueryResult] | None:
        # set current parser
        parser = state.get_parser()
        flow_path = parser.get_filename()

        if self.flow_paths is None:
            self.flow_paths = [flow_path]
            start = True
        else:
            start = False
        # always add to the list, so we collect sources in subflows and remember them
        parser_sources = get_sources(parser, start=start)

        self.sources.update(parser_sources)

        # can also do lexical queries here with parser
        # in which case we may want to return a result
        return None

    def handle_final(self, all_states: (State,)) -> list[QueryResult] | None:
        """Entry point for running queries after all scans are complete

        Args:
            all_states: tuple of states, one for all flows processed

        Returns:
            list of query results
        """
        # This would be appropriate for more advanced analysis that requires the full
        # dataflow graph of the entire fully executed program
        return None

    def process_element(self, elem: ET._Element, state: State) -> list[QueryResult] | None:
        """Looks for CRUD influencers from sources (input fields or input variables)

            Searches the xml element looking for tainted variables that are selector or data influencers.

            If sources of taint are found, calls
            the `process_influencers` method that queries the state for vulnerable flows and generates reports.

            Args:
                state: BranchState
                elem: element being searched

            Returns:
                None
        """
        elem_type = parse_utils.get_tag(elem)
        filter_influencers = []
        input_influencers = []
        parser = state.get_parser()

        # sinks are define here
        if elem_type in ["recordUpdates", "recordLookups", "recordCreates", "recordDeletes"]:

            # Look for filter selection criteria (influences *which records* are returned)
            filter_elems = parse_utils.get_filters(elem)
            if filter_elems is not None and len(filter_elems) > 0:
                filter_influencers = parse_utils.get_sinks_from_field_values(filter_elems)

            # Look for input assignment which influences *what values* are updated or created
            input_assignment_elems = parse_utils.get_input_assignments(elem)
            if input_assignment_elems is not None and len(input_assignment_elems) > 0:
                input_influencers = parse_utils.get_sinks_from_field_values(input_assignment_elems)

            # Look for bulk operators:
            bulk_ref = parse_utils.get_by_tag(elem, 'inputReference')

            if len(bulk_ref) == 1:
                bulk_el = bulk_ref[0]
                bulk_var = bulk_el.text

                # for bulk operations, we say the influenced elem is the Flow Element itself.
                elem_name = state.get_current_elem_name()

                if elem_type in ['recordLookups', 'recordDeletes']:
                    filter_influencers.append((elem_name, bulk_var))
                else:
                    input_influencers.append((elem_name, bulk_var))

            res = self.process_influencers(state, elem, filter_influencers,
                                           input_influencers, elem_type, parser)
            if res is None:
                return None
            # validate
            for x in res:
                assert x.paths is not None
            return res

    def process_influencers(self, state: State, current_elem: ET._Element,
                            filter_influencers: [str], input_influencers: [str],
                            elem_type: str,
                            parser: FlowParser) -> [QueryResult]:
        """Given a list of variables that flow into sinks, search if these are tainted,
        and if so, add the tainted flow to the result object.

        Before adding the tainted
        flow, an additional statement is appended for readability, show how the tainted
        value affects the specific Flow element.

        Args:
            state: current state field
            current_elem: xml element being processed
            filter_influencers: influencers for record selection/filter
            input_influencers: influencers that modify record data
            elem_type: Whether this is an update/delete/create/lookup
            parser: Parser instance provided by runtime

        Returns:
            None

        """
        to_return = []
        flow_path = parser.get_filename()
        run_mode = parser.get_effective_run_mode()

        for x in filter_influencers + input_influencers:
            if x in filter_influencers:
                check_label = "selector"
            else:
                check_label = "data"

            query_id = build_id(elem_type=elem_type,
                                check_labels_val=check_label,
                                run_mode=run_mode.name)
            if query_id is None:
                continue

            a_field, influencer_var = x
            # surgery that deals with string or dataInfluencePaths happens in get_tainted_flows()
            tainted_flows = state.get_flows_from_sources(influenced_var=influencer_var,
                                                         source_vars=self.sources)
            if tainted_flows is not None and len(tainted_flows) > 0:
                """
                query_id: id

                influence_statement: DataInfluenceStatement
            
                paths: set[DataInfluencePath]
                """
                curr_name = parse_utils.get_name(current_elem)

                # SystemModeWithoutSharing User Influenced Record Update
                sink_stmt = DataInfluenceStatement(a_field, influencer_var, curr_name,
                                                   comment=f"flow into {elem_type} via influence over {a_field}"
                                                           f" in run mode {run_mode.name}",
                                                   line_no=current_elem.sourceline,
                                                   source_text=parse_utils.ET.tounicode(current_elem),
                                                   flow_path=flow_path
                                                   )
                to_return.append(QueryResult(query_id=query_id,
                                             influence_statement=sink_stmt,
                                             paths=tainted_flows))

                msg = ("***Security Finding**"
                       f"in Flow Element {curr_name} of type {elem_type}"
                       f"User input can influence {a_field} via control over {check_label} fields"
                       f"Through the tainted flows:"
                       f"\ttn".join([str(x) for x in tainted_flows]) +
                       "*********************")
                logger.info(msg)

        if len(to_return) > 0:
            return to_return
        else:
            return None


def get_sources(parser: FlowParser, start=True) -> ((str, str),):
    """Looks for sources
    Args:
        parser: parser instance for flow
        start: whether this is the first flow being scanned

    Returns:
        ((path, varname), ) corresponding to sources of taint

    """

    flow_path = parser.get_filename()
    input_fields = list(parser.get_input_field_elems() or [])
    input_vars = list(parser.get_input_variables() or [])

    if input_fields is not None:
        input_field_tuples = [(flow_path, parse_utils.get_name(x)) for x in input_fields]
    else:
        input_field_tuples = []

    input_vars = input_vars or []

    if start is True:
        return input_field_tuples + input_vars
    else:
        return input_field_tuples


def build_query_desc_from_id(query_id: str) -> QueryDescription:
    [run_mode, elem_type, check_val] = query_id.split(".")[1:]

    return build_query_description(elem_type=elem_type, check_labels_val=check_val, run_mode=run_mode)


def build_id(elem_type, check_labels_val, run_mode) -> str | None:
    str_ = f"FlowSecurity.{run_mode}.{elem_type}.{check_labels_val}"
    if str_ in QUERY_IDS:
        return str_
    else:
        return None


def build_query_description(elem_type, check_labels_val, run_mode):
    query_description = (f"User controlled data flows into {elem_type} element {check_labels_val} in "
                         f"run mode: {run_mode}")
    query_name = f"Flow: {run_mode} {elem_type} {check_labels_val}"
    query_id = build_id(elem_type, check_labels_val, run_mode)

    if (run_mode == "SystemModeWithoutSharing"
            and elem_type in ["recordDeletes", "recordUpdates"]):
        severity = Severity.Flow_High_Severity

    elif run_mode == "SystemModeWithoutSharing":
        severity = Severity.Flow_Moderate_Severity

    elif run_mode == "SystemModeWithSharing":
        severity = Severity.Flow_Low_Severity

    else:
        severity = Severity.Flow_Informational

    return QueryDescription(query_id=query_id, query_name=query_name, severity=severity,
                            query_description=query_description)
