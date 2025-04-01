"""performs dataflow wiring for flow elements

    -------------
    Wiring Policy
    -------------

    Wiring policy for flow elements

        * <start> - Not wired.
        * <startElementReference> - Not wired.
        * <screens> - TBD. Screens are complex and deserving of a separate study. Presently we wire associated
                      Objects as well as input variables. But many screen components are not handled (order fulfillment)
        * <assignments> - wire assignment, target variable auto-added
        * <recordLookups> - (flow element should be added)
        * <recordCreates> - (flow element should be added)
        * <recordUpdates> - (flow element should be added)
        * <recordDeletes> - (flow element should be added)
        * <collectionProcessors> - (flow element name) should be added and collection variable wired to it (for filters)
        * <loops> - Loop variable (flow element name) should be added and collection variable wired to it
        * <decisions> - Not wired
        * <subflows> - Handled with custom methods in :mod:`flowtest.executor`

    The following flow elements represent data initialized at flow start
    and are handled by the parser, they are not wired

        * <choices>
        * <dynamicChoiceSets>
        * <textTemplates>
        * <formulas>
        * <constants>
        * <variables>

    The following are uncategorized

        * <stages> - TBD
        * <actionCalls> - TBD

"""
import logging

import flow_parser.parse as parse
from flowtest.branch_state import BranchState
from public import parse_utils
from public.data_obj import DataInfluenceStatement
from public.parse_utils import ET

#: module logger
logger = logging.getLogger(__name__)


def handle_auto_store(state: BranchState, elem: ET.Element, elem_name: str) -> None:
    """Add this element name to influence map if it represents its own output data

    (Element name is passed in so we don't need to keep looking it up)

    Args:
        state: current branch state
        elem: current xml elem
        elem_name: element name

    Returns:
        None

    """
    if parse_utils.is_auto_store(elem):
        state.get_or_make_vector(name=elem_name, store=True)

    ref = parse_utils.get_output_reference(elem)
    if ref is not None:
        state.get_or_make_vector(name=ref, store=True)


def wire(state: BranchState, elem: ET.Element):
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
    handle_auto_store(state, elem, elem_name=el_name)

    if el_type == 'assignments':
        wire_assignment(state, elem, el_name)

    # CRUD operations - currently we don't support second order flows,
    # but the implicit values, e.g. {!recordLookup} will already be
    # picked up in assignment statements. What we do *not* do is wire
    # the filters/selectors to the output, as this is what the
    # query_processor could do if it flips "store" to True as part
    # of a policy to propagate taint through object retrieval.
    if el_type == 'recordLookups':
        pass
    if el_type == 'recordCreates':
        # look for passing id to variable in create
        pass
    if el_type == 'recordUpdates':
        pass
    if el_type == 'recordDeletes':
        pass

    # loops and collection processors work with collection references
    if el_type == 'collectionProcessors':
        wire_collection_processor(state, elem, el_name)

    if el_type == 'loops':
        wire_loop(state, elem, el_name)

    if el_type == 'screens':
        # add elem to influence map
        input_elems = parse_utils.get_input_fields(elem)
        if input_elems is not None:
            for el in input_elems:
                state.get_or_make_vector(name=parse_utils.get_name(el), store=True)


def wire_assignment(state: BranchState, elem: ET.Element, elem_name: str):
    """Wires assignment statements to influence map in `state`

    Args:
        state: current Branch State
        elem: assignment element to be wired
        elem_name: element name passed in for convenience

    Returns:
        None

    """
    res = parse_utils.get_assignment_statement_dicts(elem)
    if res is None:
        logger.error(f"Could not obtain any assignments from element {elem_name}")
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
        stmt = DataInfluenceStatement(**entry)
        state.propagate_flows(statement=stmt,
                              assign=is_assign,
                              store=True)


def wire_loop(state: BranchState, elem: ET.Element, elem_name: str):
    """Wires collection loop is over to loop variable.

    Args:
        state: current Branch State
        elem: assignment element to be wired
        elem_name: element name passed in for convenience

    Returns:
        None

    """
    # every loop must have a single collection ref
    collection_ref_el = parse.get_by_tag(elem, tagname='collectionReference')[0]
    collection_ref_var = collection_ref_el.text
    loop_var = elem_name
    stmt = DataInfluenceStatement(
        influenced_var=loop_var,
        influencer_var=collection_ref_var,
        element_name=elem_name,
        source_text=parse.ET.tostring(collection_ref_el, encoding='unicode',
                                      default_namespace='http://soap.sforce.com/2006/04/metadata'),
        line_no=collection_ref_el.sourceline,
        comment='assign to loop variable',
        flow_path=state.flow_path
    )
    state.propagate_flows(statement=stmt, assign=True, store=True)


def wire_collection_processor(state: BranchState, elem: ET.Element, elem_name: str):
    """Wires collection reference in collection processor to collection elem.

    Args:
        state: current Branch State
        elem: assignment element to be wired
        elem_name: element name passed in for convenience

    Returns:
        None

    """
    # every collectionProcessor must have a single collection ref
    subtype = parse.get_by_tag(elem, tagname='elementSubtype')
    if len(subtype) == 1 and subtype[0].text == 'FilterCollectionProcessor':
        collection_el = parse.get_by_tag(elem, tagname='collectionReference')[0]
    else:
        return
    collection_ref_var = collection_el.text
    collection_var = elem_name
    stmt = DataInfluenceStatement(
        influenced_var=collection_var,
        influencer_var=collection_ref_var,
        element_name=elem_name,
        source_text=parse.ET.tostring(collection_el, encoding='unicode',
                                      default_namespace='http://soap.sforce.com/2006/04/metadata'),
        line_no=collection_el.sourceline,
        comment='collection filter',
        flow_path=state.flow_path
    )
    state.propagate_flows(statement=stmt, assign=True, store=True)
