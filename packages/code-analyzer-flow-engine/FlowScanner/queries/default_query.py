"""Default Queries to be run for Security Review of Flows

    BETA - Under testing but not ready for production

"""
from __future__ import annotations

import logging
from typing import TypeAlias

import public.custom_parser as CP
from flow_scanner.flow_result import DEFAULT_HELP_URL
from public import parse_utils
from public.contracts import FlowParser, State, Query
from public.data_obj import InfluenceStatement, QueryResult
from public.data_obj import QueryDescription
from public.enums import Severity, QueryAction, RunMode

El: TypeAlias = CP.ET.Element
logger = logging.getLogger(__name__)




QUERIES = {
    'PreventPassingUserDataIntoElementWithoutSharing': 'User Data DML in System Mode Without Sharing',
    'PreventPassingUserDataIntoElementWithSharing': 'User Data DML in System Mode Without Sharing'
}

class PreventPassingUserDataIntoElementWithoutSharing(Query):

    query_id = 'PreventPassingUserDataIntoElementWithoutSharing'
    query_name = 'User Data DML in System Mode Without Sharing'

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=(
                "User controlled data is sent to a DB Element (RecordLookups, RecordCreates, RecordUpdates, RecordDeletes) "
                "in System context without sharing. This can result in privilege escalation if the user does "
                "not have permission to access the underlying record."),
            query_version="1.0",
            severity=Severity.Flow_High_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=True
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.process_elem]

    def execute(self, state=None, crawler=None, all_states=None) -> list[QueryResult] | None:
        if state is None:
            return None
        if state.get_parser().get_effective_run_mode() != RunMode.SystemModeWithoutSharing:
            return None
        return process_element(self.query_id, state.get_current_elem(), state)



class PreventPassingUserDataIntoElementWithSharing(Query):

    query_id = 'PreventPassingUserDataIntoElementWithSharing'
    query_name = 'User Data DML in System Mode With Sharing'

    @classmethod
    def get_query_description(cls) -> QueryDescription:
         return QueryDescription(
            query_id = cls.query_id,
            query_name= cls.query_name,
            query_description=("User controlled data is sent to a DB Element (RecordLookups, RecordCreates, RecordUpdates, RecordDeletes) "
                               "in System context with sharing. This can result in privilege escalation if the user does "
                               "not have permission to access the underlying record."),
            query_version="1.0",
            severity=Severity.Flow_Moderate_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=True
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.process_elem]

    def execute(self, state=None, crawler=None, all_states=None) -> list[QueryResult] | None:
        if state.get_parser().get_effective_run_mode() != RunMode.SystemModeWithSharing:
            return None
        if state is None:
            return None
        return process_element(self.query_id, state.get_current_elem(), state)



def process_element(query_id, elem: El, state: State) -> list[QueryResult] | None:
    """Looks for CRUD influencers from sources (input fields or input variables)

        Searches the xml element looking for tainted variables that are selector or data influencers.

        If sources of taint are found, calls
        the `process_influencers` method that queries the state for vulnerable flows and generates reports.

        Args:
            query_id ():
            state: BranchState
            elem: element being searched

        Returns:
            None
    """
    elem_type = parse_utils.get_tag(elem)
    parser = state.get_parser()
    sources = parser.get_tainted_inputs()

    # sinks are define here
    if elem_type in ["recordUpdates", "recordLookups", "recordCreates", "recordDeletes"]:

        # Look for filter selection criteria (influences *which records* are returned)
        filter_influencers = parse_utils.get_field_op_values_from_elem(elem, 'filters')

        # Look for input assignment which influences *what values* are updated or created
        input_influencers = parse_utils.get_field_op_values_from_elem(elem, 'inputAssignments')

        # Look for bulk operators:
        bulk_ref = parse_utils.get_by_tag(elem, 'inputReference')

        if len(bulk_ref) == 1:
            bulk_el = bulk_ref[0]
            bulk_var = bulk_el.text

            # for bulk operations, we say the influenced elem is the Flow Element itself.
            elem_name = state.get_current_elem_name()

            if elem_type in ['recordLookups', 'recordDeletes']:
                filter_influencers.append((elem_name, None, bulk_var))
            else:
                input_influencers.append((elem_name, None, bulk_var))

        res = process_influencers(query_id, sources, state, elem, filter_influencers,
                                       input_influencers, elem_type, parser)
        if res is None:
            return None
        # validate
        for x in res:
            assert x.paths is not None
        return res

    # fall through, as we are not in a sink
    return None

def process_influencers(query_id: str,
                        sources: set[tuple[str, str]],
                        state: State, current_elem: El,
                        filter_influencers: list[tuple[str, str | None, str]],
                        input_influencers: list[tuple[str, str | None, str]],
                        elem_type: str,
                        parser: FlowParser) -> list[QueryResult] | None:
    """Given a list of variables that flow into sinks, search if these are tainted,
    and if so, add the tainted flow to the result object.

    Before adding the tainted
    flow, an additional statement is appended for readability, show how the tainted
    value affects the specific Flow element.

    Args:
        query_id (): string, name of query
        sources (): set of tuple path, var_name
        state: current state field
        current_elem: xml element being processed
        filter_influencers: influencers for record selection/filter
        input_influencers: influencers that modify record data
        elem_type: Whether this is an update/delete/create/lookup
        parser: Parser instance provided by runtime

    Returns:
       list of QueryResults

    """
    to_return = []
    flow_path = parser.get_filename()
    run_mode = parser.get_effective_run_mode()
    flow_type = parser.get_flow_type()

    for x in filter_influencers + input_influencers:
        a_field, op, influencer_var = x
        # surgery that deals with string or dataInfluencePaths happens in get_tainted_flows()
        tainted_flows = state.get_flows_from_sources(influenced_var=influencer_var,
                                                     source_vars=sources)
        if tainted_flows is not None and len(tainted_flows) > 0:
            """
            query_id: id

            influence_statement: DataInfluenceStatement
        
            paths: set[DataInfluencePath]
            """
            curr_name = parse_utils.get_name(current_elem)

            # SystemModeWithoutSharing User Influenced Record Update
            sink_stmt = InfluenceStatement(a_field, influencer_var, curr_name,
                                           comment=f"flow into {elem_type} via influence over {a_field}"
                                                       f" in run mode {run_mode.name}",
                                           line_no=current_elem.sourceline, # noqa
                                           source_text=parse_utils.get_elem_string(current_elem),
                                           flow_path=flow_path,
                                           source_path=flow_path
                                           )
            to_return.append(QueryResult(query_id=query_id,
                                         flow_type=flow_type,
                                         influence_statement=sink_stmt,
                                         paths=frozenset(tainted_flows)))

    if len(to_return) > 0:
        return to_return
    else:
        return None
