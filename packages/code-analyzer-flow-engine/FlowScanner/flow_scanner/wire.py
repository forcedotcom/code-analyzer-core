"""Performs dataflow wiring for flow elements.

Wiring Policy
-------------

1. When we encounter any variable defined or initialized in an element,
   we add that variable to the influence map.

2. When dataflows _out_ of an element to another element, we wire the flow.

   We do not presently wire flows _into_ the current element, as we don't support
   second order dataflow analysis.

   For example, user data may flow into the filter field of a Get Records,
   and the return value of the function may be assigned to another variable.
   Only the second dataflow is wired. If both flows were wired, we would have
   a second order flow, e.g. assuming that the inputs to a function are part
   of the same dataflow as the return values, which is rarely useful for
   dataflow analysis and generates misleading flows.

   If we are searching for dangerous flows *into* elements, this is done by
   the query processor, which does not wire anything, it only searches for
   the flows. This is why our dataflow results generally contain one missing
   step, which must be added by the QueryProcessor.

This allows us to know, at any point in program execution, which variables
have been initialized and also what the dataflow history of each variable is.
"""
import logging

import flow_parser.parse as parse
from flow_scanner.branch_state import BranchState
from public import parse_utils
from public.data_obj import InfluenceStatement
from public.parse_utils import ns
from enum import Enum
import public.custom_parser as CP

from typing import TypeAlias
El: TypeAlias = CP.ET.Element

#: module logger
logger = logging.getLogger(__name__)

class QueryResult(Enum):
    IsAutoStore = 10
    OutputReferenceEls = 20
    OutputParametersEls = 30
    OutputAssignmentsEls = 40


def initialize(state: BranchState, elem: El, elem_name: str) -> dict[QueryResult, bool | str | El]:
    """Add element name to influence map if it represents its own output data.

    Element name is passed in so we don't need to keep looking it up.

    Args:
        state: Current branch state.
        elem: Current XML element.
        elem_name: Element name.

    Returns:
        Dictionary mapping QueryResult enum values to initialization results.
    """
    tag = parse_utils.get_tag(elem)
    auto_store = parse_utils.is_auto_store(elem)
    result = {
        QueryResult.IsAutoStore: auto_store,
        QueryResult.OutputReferenceEls: parse_utils.get_by_tag(elem, 'outputReference'),
        QueryResult.OutputParametersEls: parse_utils.get_by_tag(elem, 'outputParameters'),
        QueryResult.OutputAssignmentsEls: parse_utils.get_by_tag(elem, 'outputAssignments')
     }

    # always store if auto-store
    if auto_store:
        state.get_or_make_vector(name=elem_name, store=True)

    # also store if this is an element that performs some action, because then there
    # will always be a created ref that evaluates to true if the action succeeds.
    elif tag not in ['start', 'startElementReference', 'subflows', 'decisions', 'assignments']:
        #TODO: need to audit this list for completeness
        state.get_or_make_vector(name=elem_name, store=True)

    return result

def wire(state: BranchState, elem: El) -> None:
    """Wires influence statements and variable initialization.

    When the value of one variable changes based on another.
    Once detected, this module extends the influence map by
    each statement.

    Args:
        state: current instance of Branch State
        elem: Flow Element to be wired

    Returns:
        None

    """
    if elem is None:
        return None

    el_type = parse.get_tag(elem)
    el_name = parse.get_name(elem)

    # handle <storeOutputAutomatically> here
    stored = initialize(state, elem, elem_name=el_name)

    if el_type == 'actionCalls':
        wire_action_calls(state, elem, el_name, stored)

    elif el_type == 'apexPluginCalls':
        wire_apex_plugin_calls(state, elem, el_name, stored)

    elif el_type == 'assignments':
        wire_assignment(state, elem, el_name)

    # loops and collection processors work with collection references
    elif el_type == 'collectionProcessors':
        wire_collection_processor(state, elem, el_name)

    elif el_type == 'dynamicChoiceSets':
        pass
        # Todo: audit if this is necessary
        # wire_dynamic_choice_sets(state, elem, el_name, stored)

    elif el_type == 'loops':
        wire_loop(state, elem, el_name)

    elif el_type == 'orchestratedStages':
        # Inside Orchestrated stages, stageSteps are wired as step_name.Outputs.var
        wire_orchestrated_stages(state, elem)

    elif el_type == 'recordCreates':
        # look for passing id to variable in create
        wire_record_creates(state, elem, el_name)

    elif el_type == 'recordDeletes':
        # these only auto-wired as the standard boolean (e.g. true if success)
        pass

    elif el_type == 'recordLookups':
        wire_record_lookups(state, elem, el_name, stored)

    elif el_type == 'recordUpdates':
        # record do hold values, they evaluate to true if the update
        # was successful, but only via the el name, so no wiring needed
        # beyond adding the element.
        pass

    elif el_type == 'screens':
        # TODO: need to handle output from screen to action or vice-versa
        # This should wait until we crawl actions separately
        wire_screens(state, elem, el_name)

    elif el_type == 'subflows':
        # subflow wiring is done in the executor
        # TODO: move the creation of the element here and wiring to local outputs
        # so the executor can focus on cross-flow wiring and we can handle
        # actions and subflows in the same way
        pass

    elif el_type == 'transforms':
        wire_transforms(state, elem, el_name)

    elif el_type == 'waits':
        wire_waits(state, elem)

    return None

def wire_waits(state: BranchState, elem: El) -> None:
    """Wire wait element events.

    Wait events can fire events on exit which is handled via output reference.

    Args:
        state: Current branch state.
        elem: Wait element to wire.
    """
    wait_events = parse_utils.get_by_tag(elem, 'waitEvents')
    for event in wait_events:
        event_name = parse_utils.get_name(event)
        if event_name is None:
            continue
        params = parse_utils.get_by_tag(event, 'outputParameters')
        state.get_or_make_vector(name=event_name, store=True)
        for param_el in params:
            influenced = parse_utils.get_text_of_tag(param_el,'assignToReference')
            influencer = parse_utils.get_text_of_tag(param_el, 'name')
            if influencer is not None and influenced is not None:
                fixed_influencer = f"{event_name}.{influencer}"
                wire_and_store(state, influencer=fixed_influencer, influenced=influenced,
                               el_name=event_name, elem=event, comment='event fired by wait element')



def wire_assignment(state: BranchState, elem: El, elem_name: str) -> None:
    """Wire assignment statements to influence map in state.

    Args:
        state: Current branch state.
        elem: Assignment element to be wired.
        elem_name: Element name passed in for convenience.
    """
    res = parse_utils.get_assignment_statement_dicts(elem)
    if res is None:
        logger.error(f"Could not obtain any assignments from element {elem_name} in flow {state.flow_path}")
        return

    flow_path = state.flow_path

    for (operator, entry) in res:
        # we could have just return a boolean, but maybe there will be more operators in the future
        is_assign = operator == 'Assign'

        # Be aware there is something sneaky going on here:
        # if the parse module detects a string literal, it sets
        # the influencer name to parse.STRING_LITERAL_TOKEN
        # which then the parser module picks up and assigns
        # a hardcoded variable type that is not any of the actual
        # flow variables, so that it will not appear as a sink
        #
        # But if you were to refactor this code and not
        # use the parse module, then there would be issues
        # as string literals might show up as variables.
        # Please keep this in mind when you write other
        # parse modules for other flow elements that can
        # accept stringLiteral types.
        #
        # Always assign a variable name equal to parse.STRING_LITERAL_TOKEN
        # to signify something is a literal value and not a variable.
        entry["flow_path"] = flow_path
        entry["source_path"] = flow_path

        stmt = InfluenceStatement(**entry)
        state.propagate_flows(statement=stmt,
                              assign=is_assign,
                              store=True)
        logger.debug(f"Propagated flow for {elem_name}: {entry}")


def wire_transforms(state: BranchState, elem: El, el_name: str) -> None:
    """Wire transform element influencers to outputs.

    Args:
        state: Current branch state.
        elem: Transform element to wire.
        el_name: Element name.
    """
    res = parse_utils.get_transform_influencers(elem)
    if res is None:
        return

    # First, de-dup
    seen = set()
    for (inf_type, output_var, influencer_var_tuple) in res:
        for influencer in influencer_var_tuple:
            seen.add((output_var, influencer))

    # Now handle output var and propagate
    for output_var, influencer in seen:
        if output_var is None:
            influenced_label = el_name
        else:
            influenced_label = f"{el_name}.{output_var}"

        wire_and_store(state=state, influencer=influencer,
                       influenced=influenced_label,
                       elem=elem, el_name=el_name,
                       comment='influence via transform element')

def wire_record_creates(state: BranchState, elem: El, el_name: str) -> None:
    """Wire record create element to assign record ID.

    Args:
        state: Current branch state.
        elem: Record create element to wire.
        el_name: Element name.
    """
    influenced = parse_utils.get_text_of_tag(elem, 'assignRecordIdToReference')
    if influenced is not None:
        wire_and_store(state=state, influencer=el_name, influenced=influenced,
                       el_name=el_name, elem=elem, comment='id from record Create')


def wire_record_lookups(state: BranchState, elem: El, el_name: str, stored: dict) -> None:
    """Wire record lookup element outputs.

    Args:
        state: Current branch state.
        elem: Record lookup element to wire.
        el_name: Element name.
        stored: Dictionary of stored query results from initialize().
    """
    assignments =  stored[QueryResult.OutputAssignmentsEls]
    for assignment in assignments:
        influenced = parse_utils.get_text_of_tag(assignment, 'assignToReference')
        influencer_field = parse_utils.get_text_of_tag(assignment, 'field')
        if influencer_field is not None and influenced is not None:
            influencer = f"{el_name}.{influencer_field}"
            wire_and_store(state=state, influencer=influencer, influenced=influenced,
                           el_name=el_name, elem=elem, comment='output of record Lookup')

    out_ref = parse_utils.get_text_of_tag(elem, 'outputReference')
    if out_ref is not None:
            wire_and_store(state=state, influencer=out_ref, influenced=el_name,
                            el_name=el_name, elem=elem, comment='output of record Lookup')


def wire_action_calls(state: BranchState, elem: El, el_name: str, stored: dict) -> None:
    """Wire action call element outputs.

    Args:
        state: Current branch state.
        elem: Action call element to wire.
        el_name: Element name.
        stored: Dictionary of stored query results from initialize().
    """
    if not stored[QueryResult.IsAutoStore]:
        # If auto-stored, then this will have already been autowired when initialized
        wire_apex_plugin_calls(state, elem, el_name, stored)



def wire_apex_plugin_calls(state: BranchState, elem: El, el_name: str, stored: dict) -> None:
    """Wire Apex plugin call element outputs.

    Args:
        state: Current branch state.
        elem: Apex plugin call element to wire.
        el_name: Element name.
        stored: Dictionary of stored query results from initialize().
    """
    output_params = stored[QueryResult.OutputParametersEls]
    for output in output_params:
        influenced = parse_utils.get_text_of_tag(output, 'assignToReference')
        influencer_field = parse_utils.get_text_of_tag(output, 'name')
        if influencer_field is not None and influenced is not None:
            influencer = f"{el_name}.{influencer_field}"
            wire_and_store(state=state, influencer=influencer, influenced=influenced,
                           el_name=el_name, elem=elem, comment="action output value")


"""
def wire_dynamic_choice_sets(state, elem, el_name, stored):
    #TODO: audit these
    pass
"""

def wire_orchestrated_stages(state: BranchState, elem: El) -> None:
    """Wire orchestrated stage element outputs.

    Args:
        state: Current branch state.
        elem: Orchestrated stage element to wire.
    """
    # Todo: update this with additional wiring after audit
    steps = parse_utils.get_by_tag(elem, 'stageSteps')
    for step in steps:
        step_name = parse_utils.get_name(step)
        if step_name is not None:
            fixed_name = f"{step_name}.Outputs"
            state.get_or_make_vector(name=fixed_name, store=True)


def wire_loop(state: BranchState, elem: El, elem_name: str) -> None:
    """Wire collection loop reference to loop variable.

    Args:
        state: Current branch state.
        elem: Loop element to be wired.
        elem_name: Element name passed in for convenience.
    """
    collection_ref_els = parse.get_by_tag(elem, tag_name='collectionReference')
    if len(collection_ref_els) != 1:
        logger.warning(f"Found Loop without a collection reference in {elem_name}")
        return
    else:
        collection_ref_el = collection_ref_els[0]

    collection_ref_var = collection_ref_el.text
    loop_var = elem_name
    wire_and_store(state, influencer=collection_ref_var, influenced=loop_var,
                   el_name=elem_name, elem=elem,comment='assign to loop variable')


def wire_collection_processor(state: BranchState, elem: El, elem_name: str) -> None:
    """Wire collection reference in collection processor to collection element.

    Args:
        state: Current branch state.
        elem: Collection processor element to be wired.
        elem_name: Element name passed in for convenience.
    """
    # every collectionProcessor must have a single collection ref
    subtype = parse.get_by_tag(elem, tag_name='elementSubtype')
    if len(subtype) == 1 and subtype[0].text == 'FilterCollectionProcessor':
        collection_el = parse.get_by_tag(elem, tag_name='collectionReference')[0]
    else:
        return
    collection_ref_var = collection_el.text
    collection_var = elem_name

    wire_and_store(state, influencer=collection_ref_var,
                   influenced=collection_var,
                   el_name=elem_name,
                   comment='collection filter',
                   elem=collection_el)


def wire_screens(state: BranchState, elem: El, el_name: str) -> None:
    """Wire screen element fields and actions.

    Args:
        state: Current branch state.
        elem: Screen element to wire.
        el_name: Element name.
    """
    parser = state.get_parser()
    stored_els = []

    # wire screen action output as action_name.Results.foo
    # Do this first
    action_els = parse_utils.get_by_tag(elem, 'actions')

    for action in action_els:
        action_name = parse_utils.get_name(action)
        assert action_name is not None
        fixed_name = f"{action_name}.Results"

        if fixed_name not in stored_els:
            state.get_or_make_vector(name=fixed_name, store=True)
            stored_els.append(fixed_name)


    # initialize all named fields
    fields = elem.findall(f'.//{ns}fields') # recurse

    for fld in fields:
        fld_type = parse_utils.get_text_of_tag(fld, 'fieldType')
        fld_name = parse_utils.get_text_of_tag(fld, 'name')
        if fld_type is None:
            continue

        # wire objectProvided
        elif fld_type == 'ObjectProvided':
            field_ref = parse_utils.get_text_of_tag(fld, 'objectFieldReference')

            if field_ref is not None:
                parent, member, v_type = parser.resolve_by_name(field_ref)
                fixed_influencer = f"{el_name}.{member}"

                wire_and_store(state, influencer=fixed_influencer, influenced=field_ref,
                               el_name=el_name, elem=elem,
                               comment="assignment to object from screen")

        if fld_name is None:
            continue

        # wire assignToReference
        output_param = parse_utils.get_by_tag(fld, 'outputParameters')

        if output_param:
            param_el = output_param[0]
            assign_to_ref = parse_utils.get_text_of_tag(param_el, 'assignToReference')
            influencer_fld = parse_utils.get_text_of_tag(param_el, 'name')

            if assign_to_ref is not None and influencer_fld is not None:

                if fld_name not in stored_els:
                    state.get_or_make_vector(name=fld_name, store=True)
                    stored_els.append(fld_name)

                influencer = f"{fld_name}.{influencer_fld}"
                wire_and_store(state, influencer=influencer, influenced=assign_to_ref,
                               el_name=fld_name, elem=fld, comment="output form screen field")
                continue


def wire_and_store(state: BranchState, influencer: str, influenced: str,
                   el_name: str, elem: El, comment: str) -> None:
    """Create an influence statement and propagate flows.

    Args:
        state: Current branch state.
        influencer: Variable or element doing the influencing.
        influenced: Variable or element being influenced.
        el_name: Element name where influence occurs.
        elem: XML element where influence occurs.
        comment: Human-readable comment explaining the influence.
    """
    stmt = InfluenceStatement(
        influenced_var=influenced,
        influencer_var=influencer,
        element_name=el_name,
        source_text=parse_utils.get_elem_string(elem),
        line_no=elem.sourceline,  # noqa
        comment=comment,
        flow_path=state.flow_path,
        source_path=state.flow_path
    )
    state.propagate_flows(statement=stmt, assign=True, store=True)