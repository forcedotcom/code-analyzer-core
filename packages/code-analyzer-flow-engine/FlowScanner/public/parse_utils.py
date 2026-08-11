"""Public Utility module for XML queries on flows.

    The goal is to move all XML queries into this module,
    so they can be shared by other modules and made available
    to third parties in custom query development.

    .. NOTE:: The distinction between what goes in here and
              what goes in :mod:`flow_parser.parse` is that the parser
              has access to the flow root and does global analysis on flows,
              whereas the utility functions here are stateless.

    If you find yourself doing manual XML queries, look in this module
    first and add a method if one isn't already present.

"""
from __future__ import annotations

import json
import logging
import re
import traceback
from typing import Callable
from typing import TypeAlias

import public.custom_parser as CP
from public.enums import DataType, ConnType, TransformType, ComplexValueType

El: TypeAlias = CP.ET.Element

#: sfdc namespace
ns = '{http://soap.sforce.com/2006/04/metadata}'

#: length of namespace string (including {})
NS_LEN = 41

#: string literal token (can't be a var name)
STRING_LITERAL_TOKEN = '** STRING LITERAL **'

#: generic connector label.
CONNECTOR = 'connector'

#: next value connector label used in loops
NEXT_VALUE_CONNECTOR = 'nextValueConnector'

#: fault connector launched by some actions
FAULT_CONNECTOR = 'faultConnector'

#: connector for when a loop is exhausted
NO_MORE_CONN = 'noMoreValuesConnector'

#: default connector in 'decisions' Flow Element
DEFAULT_CONN = 'defaultConnector'

#: connector to call when timing out during callout or action call
TIMEOUT_CONNECTOR = 'timeoutConnector'

#: list of all known connector tags
CONN_LIST = [CONNECTOR, DEFAULT_CONN, NEXT_VALUE_CONNECTOR, FAULT_CONNECTOR, NO_MORE_CONN, TIMEOUT_CONNECTOR]

#: List of global namespaces that correspond to a single record or variable,
#: such as $Record or $User
GLOBALS_RECORD = ["$Record", "$Record__Prior", "$User", "$Event"]

#: List of global namespaces that correspond to a set of records
#: such as $Input, $Output, $Setup. These must be accessed as $Input.my_obj.field or $Input.my_var
GLOBALS_RECORD_GROUP = ["$Input", "$Output", "$Setup", "$CustomMetadata"]


#: List of all global namespaces that contain unrelated values that have no object/member relationship with each other.
GLOBALS_SINGLETON = ["$Api", "$Client", "$Flow", "$Label", "$Permission",
                     "$Organization", "$Profile", "$System", "$UserRole"]

ALL_GLOBALS = GLOBALS_RECORD + GLOBALS_SINGLETON + GLOBALS_RECORD_GROUP

#: list of all (supported) elements that have a connector except start.
#: These are relevant for control flow.
CTRL_FLOW_ELEM = ["actionCalls",
                  "apexPluginCalls",
                  "assignments",
                  "collectionProcessors",
                  "customErrors",
                  "decisions",
                  "loops",
                  "orchestratedStages",
                  "recordLookups",
                  "recordCreates",
                  "recordDeletes",
                  "recordLookups",
                  "recordRollbacks",
                  "recordUpdates",
                  "screens",
                  "subflows",
                  "transforms",
                  "waits"
                  ]

#: list of supported start elements
START_ELEMS = ['start', 'startElementReference']
START_ELEMS_TAGGED = ['<start>', '<startElementReference>']

#: list of banned elements (we may add support later, but now skip these flows)
#: these correspond workflows and older flow grammars
BANNED_ELEMS = ['startElement',
                'connectors',
                'allocators',
                'questions',
                'experiments',
                'source',
                'target',
                'statements']

BANNED_ELEMS_TAGGED = ['<startElement>',
                '<connectors>',
                '<allocators>',
                '<questions>',
                '<experiments>',
                '<source>',
                '<target>',
                '<statements>']


#: List of all resource tags
RESOURCE_TAGS = [
            'dynamicChoiceSets',
            'choices',
            'variables',
            'constants',
            'formulas',
            'textTemplates'
        ]

#: list of all tags that might hold a reference to a resource as text content
DIRECT_REF_HOLDERS = [
        "assignNextValueToReference",
        "assignToReference",
        "assignRecordIdToReference",
        "choiceReferences",
        "collectionReference",
        "defaultSelectedChoiceReference",
        "elementReference",
        "eventSource",
        "field",
        "inputReference",
        "leftValueReference",
        "objectFieldReference",
        "outputFieldApiName",
        "outputReference",
        ]

EXPRESSION_REF_HOLDERS = [
    # values here can be in expressions or templates
    # but will appear as merge-fields and must be extracted
    "text", # in text template
    "fieldText",
    "choiceText",
    "stringValue"
    "expression", # in formula
    "formulaExpression" # has no name and so cannot be referenced
]

SCREEN_FIELD_TYPES = [
    'ComponentChoice',
    'ComponentInput',
    'ComponentInstance',
    'ComponentMultiChoice'
    'DisplayText',
    'DropdownBox',
    'InputField',
    'LargeTextArea',
    'MultiSelectCheckboxes',
    'MultiSelectPicklist',
    'ObjectProvided', # --> objectFieldReference (e.g. Foo.my_field) assigns contents to var
    'PasswordField',
    'RadioButtons',
    'Region',
    'RegionContainer',
    'Repeater'
    ]

# Then need to also check `value`, `rightValue` tags

#: module logger
logger = logging.getLogger(__name__)

#: regular expression to extract variables from formulas and templates
reg = re.compile(r"""\{!([^}]*)""")


def parse_expression(txt: str) -> list[str]:
    """Parse merge-fields from an expression or template string.

    Extracts variable references in the format {!variableName} from the input string.

    Args:
        txt: Expression or template definition string containing merge-fields.

    Returns:
        List of element reference names (empty list if no matches found).
    """
    accum = []
    res = re.finditer(reg, txt)
    for x in res:
        accum.append(txt[x.span()[0] + 2:x.span()[1]])
    return accum


def get_tag(elem: El) -> str:
    """Get the tag name of an element without the namespace prefix.

    Args:
        elem: XML Element to get the tag from.

    Returns:
        Tag name without namespace, or empty string if not an Element.
    """
    if isinstance(elem, El):
        return elem.tag[NS_LEN:]
    # elif isinstance(elem, ET._Comment):
    #    return ''
    else:
        return ''

def get_text_of_tag(elem: El, tag_name: str) -> str | None:
    """Get text content from a single child element with the specified tag.

    Does not recurse - only looks at direct children.

    Args:
        elem: Parent element to search.
        tag_name: Tag name to find (without namespace).

    Returns:
        Text content of the child element, or None if there is not exactly
        one child with the tag or if it has no text.
    """
    res = get_by_tag(elem, tag_name)
    if len(res) == 1 and res[0] is not None:
        r = res[0].text
        if r is None or r == '':
            return None
        else:
            return r
    return None


def is_subflow(elem: El) -> bool:
    """Check if an element is a subflow element.

    Args:
        elem: XML Element to check.

    Returns:
        True if the element is a subflow, False otherwise.
    """
    if elem is None:
        return False
    return get_tag(elem) == 'subflows'


def is_loop(elem: El) -> bool:
    """Is this a Loop Flow Element?

    Args:
        elem: XML element

    Returns:
        True if this is a loop element
    """
    if elem is None or elem.tag is None:
        return False
    return elem.tag.endswith("loops")


def is_goto_connector(elem: El) -> bool | None:
    """Check if an element is a goto connector.

    Args:
        elem: Connector element to check.

    Returns:
        True if this is a goto connector, False if not, None if element
        has no tag or no children.
    """
    for child in elem:
        if get_tag(child) == 'isGoTo':
            return child.text == 'true'
        else:
            return False
    return None


def is_decision(elem: El) -> bool:
    """Check if an element is a decision flow element.

    Args:
        elem: Flow element to check.

    Returns:
        True if this is a decision element, False otherwise.
    """
    return get_tag(elem) == 'decisions'


def get_by_tag(elem: El, tag_name: str) -> list[El]:
    """Get list of all child elements with the specified tag (ignoring namespace).

    Convenience method for dealing with namespaced XML. Does not recurse into
    nested elements.

    .. warning::
        Does not recurse. Use this for top-level flow elements (e.g., screens, variables).

    Args:
        elem: Parent element to search.
        tag_name: Tag name to find (without namespace).

    Returns:
        List of XML Elements with the tag, or empty list if no matches.
    """
    return elem.findall(f'./{ns}{tag_name}')


def get_named_elems(elem: El) -> frozenset[El]:
    """Get all descendants (recursive) of elem that have a name tag.

    Args:
        elem: Base element whose descendants to search.

    Returns:
        Frozenset of named elements, excluding processMetadataValues.
    """
    named = elem.findall(f'.//{ns}name/..')
    to_return = [x for x in named if get_tag(x) != 'processMetadataValues']
    return frozenset(to_return)

def get_name(elem: El | None) -> str | None:
    """Get the string name of an element.

    Args:
        elem: XML Element to get the name from.

    Returns:
        Element name string, '*' for start elements, or None if no name found.
    """
    if elem is None:
        return None
    name = elem.find(f'{ns}name')
    if name is None:
        if get_tag(elem) in START_ELEMS:
            return '*'
        return None
    else:
        return name.text


def get_elem_string(elem: El) -> str | None:
    """Get the string representation of an XML element.

    Args:
        elem: XML Element to convert.

    Returns:
        String representation of the element, or empty string if None.
    """
    if elem is None:
        return ''
    else:
        return CP.to_string(elem)


def get_line_no(elem: El) -> int:
    """Get the source line number of an element.

    Args:
        elem: XML Element with source line information.

    Returns:
        Source line number where the element appears.
    """
    # noinspection PyUnresolvedReferences
    return elem.sourceline


def get_start_element(root: El) -> El | None:
    """Get the start element from a flow root.

    Args:
        root: Root XML element of the flow.

    Returns:
        Start element if found, None otherwise.
    """
    start_elements = START_ELEMS
    start_res = {x: get_by_tag(root, x) for x in start_elements}

    for key in start_res:
        if len(start_res[key]) == 1:
            return start_res[key][0]
    return None


def get_subflow_name(subflow: El) -> str | None:
    """Get the name of a subflow element.

    Args:
        subflow: Subflow XML element.

    Returns:
        Subflow name string, or None if not found.
    """
    sub_name_el = get_by_tag(subflow, "flowName")
    if sub_name_el is None or len(sub_name_el) == 0:
        sub_name_el = get_by_tag(subflow, "subflowName")
    if sub_name_el is None or len(sub_name_el) == 0:
        logger.critical(f"found a subflow with no name: {CP.to_string(subflow)}")
        return None
    else:
        return sub_name_el[0].text


def get_assignment_statement_dicts(elem: El) -> list[tuple[str, dict[str, str]]] | None:
    """Extract assignment statement data from an assignments element.

    Args:
        elem: Element to parse, should have a tag of "assignments".

    Returns:
        List of (operator, dict) tuples where dict is suitable for constructing
        DataInfluenceStatements via argument unpacking. Returns None if no
        assignments found.
    """
    if get_tag(elem) == "assignments":
        elem_name = get_name(elem)
        accum = []
        for child in elem:
            if child.tag == f'{ns}assignmentItems':
                res = _process_assignment_item(child)
                if res is not None:
                    res[1]["element_name"] = elem_name
                    accum.append(res)
        if len(accum) > 0:
            return accum

    return None


def get_filters(elem: El) -> list[El]:
    """Find all filter elements recursively.

    Searches recursively to find all <filters> elements that are children
    of the current element.

    Args:
        elem: Element to search.

    Returns:
        List of filter XML elements.
    """
    return elem.findall(f'.//{ns}filters')

def get_transform_influencers(transform_elem: El) -> list[tuple[TransformType, str | None, tuple[str, ...]]] | None:
    """Convert transform element to a list of influencer tuples.

    Args:
        transform_elem: Top-level transform element to process.

    Returns:
        List of (transform_type, outputAPI_field, tuple(influencer_names)) tuples,
        or None if no transform values found.
    """
    if transform_elem is None:
        logger.error("called get_transform_influencers will null element")
        return None
    values = get_by_tag(transform_elem,'transformValues')
    if len(values) == 0:
        return None

    output = []
    join_name = None
    join_def = None
    try:
        # first look for meta
        for t_value in values:
            # first look for meta
            value_ref = get_text_of_tag(t_value, 'transformValueName')

            if value_ref is not None:
                join_name = value_ref
                # this is a join definition, so grab it
                val_actions = get_by_tag(t_value, 'transformValueActions')
                assert len(val_actions) == 1
                assert get_text_of_tag(val_actions[0], 'transformType') == 'InnerJoin'
                val_elem = val_actions[0].find(f'./{ns}inputParameters/{ns}value')
                join_def = get_vars_from_value(val_elem)
                break

        # Now look for other tags
        for t_value in values:
            val_actions = get_by_tag(t_value, 'transformValueActions')

            for val_action in val_actions:
                output_api = get_text_of_tag(val_action, 'outputFieldApiName')  # could be None
                action_type = get_text_of_tag(val_action, 'transformType')

                if action_type == 'InnerJoin':
                    # already processed this
                    continue

                elif action_type == 'Map':
                    value_el = get_by_tag(val_action, 'value')[0]
                    res = get_vars_from_value(value_el)
                    if res is not None:
                        t_value = dict.get(res, 'transformValueReference', None)

                    if res is not None and t_value is not None:
                        assert join_name is not None and join_def is not None

                        # noinspection PyUnresolvedReferences
                        left_table = join_def['complexValueType.JoinDefinition.leftElementReference'][0]
                        # noinspection PyUnresolvedReferences
                        right_table = join_def['complexValueType.JoinDefinition.rightElementReference'][0]

                        # noinspection PyTypeChecker
                        fixed = t_value[0].replace(f"{join_name}.LeftTable",
                                                   left_table).replace(f"{join_name}.RightTable",
                                                                       right_table)
                        output.append(('Map', output_api, (fixed,)))

                    elif res is not None:
                            accum = ()
                            for val in res.values():
                                accum += tuple(val)
                            output.append(('Map', output_api, accum))

                elif action_type == 'Sum' or action_type == 'Count':
                    elem_top = None
                    field = None
                    action_to_return = []

                    for input_ in get_by_tag(val_action, 'inputParameters'):
                        input_name = get_text_of_tag(input_, 'name')

                        if input_name == 'aggregationField':
                            field = input_.find(f'./{ns}value/{ns}stringValue').text

                        elif input_name == 'aggregationValues':
                            elem_top = input_.find(f'./{ns}value/{ns}elementReference').text

                        elif input_name == 'aggregationFieldReference':
                            res = get_vars_from_value(input_.find(f'./{ns}value'))
                            to_return = (action_type, output_api, tuple(res['complexValue.FieldReference']))
                            action_to_return.append(to_return)
                            break

                    if not action_to_return:
                        assert elem_top is not None

                        if field is None:
                            action_to_return.append(
                                (action_type, output_api, (elem_top,))
                            )
                        else:
                            action_to_return.append(
                                (action_type, output_api, (f"{elem_top}.{field}",))
                            )

                    output += action_to_return

        return output

    except:
        logger.critical(f"could not parse transform {get_elem_string(transform_elem)}\n"
                        f"{traceback.format_exc()}")
        return None

def get_vars_from_value(elem: El,
                        expr_parser: Callable[[str], list[str]] = parse_expression) -> dict[str, list[str]] | None:
    """Extract variables that influence a value element.

    Accepts <value>, <defaultValue>, or <rightValue> elements and returns
    variables that influence them. Variables are not normalized (e.g., "foo.Name"
    will appear). For inner join complex values, further processing is needed
    to resolve join tables.

    Args:
        elem: <complexValue> element or similar value element.
        expr_parser: Callable method to parse expressions (default regexp provided).

    Returns:
        Dictionary mapping tag_name to list of variable names. For complex values,
        tag_name contains refined information like:
        - 'ComplexValueType.FieldReference': ['var1', 'var2']
        - 'ComplexValueType.JoinDefinition.leftJoinKeys': ['var1', 'var2']
        - 'ComplexValueType.JoinDefinition.leftElementReference': ['var1']
        Returns None if no variable influencers found.
    """
    if elem is None:
        logger.error("called 'get_vars_from_value' with null input")
        return None

    for child_el in elem:
        child_tag = get_tag(child_el)

        if child_tag == 'collectionElements':
            for el in child_el:
                el_tag = get_tag(el)
                res =  _process_val_child(el, el_tag=el_tag, parent_el=child_el, expr_parser=expr_parser)
                if res is not None:
                    return res
            return None

        res = _process_val_child(child_el, el_tag=child_tag,parent_el=elem, expr_parser=expr_parser)
        if res is not None:
            return res

    # fall through
    return None

def _process_val_child(elem: El, el_tag: str, parent_el: El,
                       expr_parser: Callable[[str], list[str]] = parse_expression) -> dict[str, list[str]] | None:
    """Process a child element of a value element to extract variable references.

    Handles various value types including element references, string values,
    complex values, and transform value references.

    Args:
        elem: Child element to process.
        el_tag: Tag name of the child element (without namespace).
        parent_el: Parent element containing the child.
        expr_parser: Callable to parse expressions (default: parse_expression).

    Returns:
        Dictionary mapping tag names to lists of variable names, or None if
        no variables found or element has no text.
    """
    raw_data = elem.text
    if raw_data is None or len(raw_data) == 0:
        return None

    data = rid_item(raw_data)
    if data is None or len(data) == 0:
        return None

    if el_tag == 'elementReference':
        return {el_tag:[data]}

    elif el_tag == 'stringValue' or el_tag == 'formulaExpression':
        # this may be a formula
        vars_ = expr_parser(data)
        if len(vars_) > 0:
            return {el_tag: vars_}
        else:
            return None

    elif el_tag == 'complexValue':
        # get the complex value type
        t_type = get_text_of_tag(parent_el, 'complexValueType')
        if t_type is None or len(t_type) == 0 or t_type not in ComplexValueType:
            return None
        try:
            type_dict = json.loads(data)
        except:
            logger.error(f"could not de-serialize complex value type {data}")
            return None

        try:
            """
            if t_type == ComplexValueType.ComplexObjectFieldDetails.name:
                # these are used to specify labels in datatables flow extension
                # in screen flows but do not correspond to actual flow variables.
                pass
            """
            if t_type == ComplexValueType.FieldReference.name:
                # used in aggregation transforms such as sum and count transforms
                field_refs = dict.get(type_dict, "fieldReferences", None)
                elem_ref = dict.get(type_dict, "elementReference", None)
                if (field_refs is None or len(field_refs) == 0) and (
                        elem_ref is None or len(elem_ref) == 0):
                    return None

                elif field_refs is None or len(field_refs)==0:
                    to_add = [elem_ref]
                else:
                    to_add = [f"{elem_ref}.{f}" for f in field_refs]

                return {'complexValue.FieldReference': to_add}

            elif t_type == ComplexValueType.JoinDefinition.name:
                left_el_ref = dict.get(type_dict, "leftElementReference", None)
                left_join_keys = dict.get(type_dict, "leftJoinKeys", None)
                left_selected_fields = dict.get(type_dict, "leftSelectedFields", [])
                right_el_ref = dict.get(type_dict, "rightElementReference", None)
                right_join_keys = dict.get(type_dict,"rightJoinKeys", None)
                right_selected_keys = dict.get(type_dict,"rightSelectedFields", [])

                to_return = {
                    "complexValueType.JoinDefinition.leftJoinKeys": [
                        f"{left_el_ref}.{x}" for x in left_join_keys],
                    "complexValueType.JoinDefinition.rightJoinKeys": [
                        f"{right_el_ref}.{x}" for x in right_join_keys],
                    "complexValueType.JoinDefinition.leftSelectedFields": [
                        f"{left_el_ref}.{x}" for x in left_selected_fields],
                    "complexValueType.JoinDefinition.rightSelectedFields": [
                        f"{right_el_ref}.{x}" for x in right_selected_keys],
                    "complexValueType.JoinDefinition.leftElementReference": [
                        left_el_ref
                    ],
                    "complexValueType.JoinDefinition.rightElementReference": [
                        right_el_ref
                    ]
                }
                return to_return

            elif t_type == ComplexValueType.ResourceDescriptor.name:
                var_str = dict.get(type_dict, "resourceTemplate", '')
                vars_ = expr_parser(var_str)
                if len(vars_) > 0:
                    return {'complexValue.ResourceDescriptor': vars_}
                else:
                    return None

            elif t_type == ComplexValueType.ResourceAnnotationMap.name:
                var_str = dict.get(type_dict, "name", '')
                vars_ = expr_parser(var_str)
                if len(vars_) > 0:
                    return {'complexValue.ResourceAnnotationMap': vars_}
                else:
                    return None

        except:
            logger.error(f"could not process complex value type {data}")
            return None

    elif el_tag == 'transformValueReference':
        return {'transformValueReference': [data]}

    elif el_tag in ['apexValue', 'sobjectValue']:
        try:
            parsed = json.loads(data)
            to_return = []
            recursive_parse(parsed, parse_callable=expr_parser, accum=to_return)
            if len(to_return) == 0:
                return None
            else:
                return {el_tag: to_return}

        except:
            logger.error(f"could not json parse data {data} in tag {el_tag}")

    # fall through
    return None


def get_input_assignments(elem: El) -> list[El]:
    """Find all input assignment elements recursively.

    Searches recursively to find all <inputAssignments> elements that are
    children of the current element.

    Args:
        elem: Element to search.

    Returns:
        List of input assignment XML elements.
    """
    return elem.findall(f'.//{ns}inputAssignments')


def get_sinks_from_field_values(elems: list[El]) -> list[tuple[str, str | None, str]]:
    """Find variables that flow into field/value pairs.

    For example, if a recordLookup field has a filter::

        <filters>
            <field>Name</field>
            <operator>Contains</operator>
            <value>
                <elementReference>var3</elementReference>
            </value>
        </filters>

    then this would return [('Name', 'Contains', 'var3')].

    This strategy also works for inputAssignments::

        <inputAssignments>
            <field>Company</field>
            <value>
                <elementReference>Company</elementReference>
            </value>
        </inputAssignments>

    then this would return [('Company', None, 'Company')].

    Args:
        elems: Input assignment or field selection criteria XML elements.

    Returns:
        List of (field_name, operator, influencer_name) tuples.
        Returns empty list if no sinks are found.
    """
    accum = []
    for a_filter in elems:
        field_name = None
        influencer = None
        operator = None

        for child in a_filter:

            child_tag = get_tag(child)
            if child_tag == 'field':
                field_name = child.text

            if child_tag == 'operator':
                if child.text is None or len(child.text) == 0:
                    operator = None
                else:
                    operator = child.text

            if child_tag == 'value':
                for e_ref in child:
                    if get_tag(e_ref) == 'elementReference':
                        influencer = e_ref.text

        if influencer is not None and field_name is not None:
            accum.append((field_name, operator, influencer))

    return accum

def process_output_assignments(elem: El) -> list[tuple[str, str]]:
    """Extract output assignments from an element recursively.

    Searches element recursively and extracts pairs of the form::

        <outputAssignments>
            <assignToReference>WorkItemID</assignToReference>
            <field>Id</field>
        </outputAssignments>

    returning a list of tuples [('Id', 'WorkItemID')].

    Args:
        elem: Element to search recursively.

    Returns:
        List of (influencer_field, assignTo_field) tuples.
        Returns empty list if none found.
    """
    elems = elem.findall(f'.//{ns}outputAssignments')
    accum = []
    for elem in elems:
        influencer = None
        influenced = None
        for child in elem:
            if child.tag == f'{ns}assignToReference' and child.text is not None:
                influenced = child.text
            if child.tag == f'{ns}field' and child.text is not None:
                influencer = child.text
        if influencer is not None and influenced is not None:
            accum.append((influencer, influenced))
    return accum

def get_field_op_values_from_elem(elem: El, tag: str) -> list[tuple[str, str | None, str]]:
    """Extract field/operator/value triples from elements with a specific tag.

    Searches element recursively for the tag and extracts triples of the form::

        <tag>
          <field>foo</field>
          <operator>Contains</operator>
          <value>
            <elementReference>bar</elementReference>
          </value>
        </tag>

    returning a list of triples [('foo', 'Contains', 'bar')].

    Args:
        elem: Element to search recursively.
        tag: Tag name that must be a descendant of elem.

    Returns:
        List of (field_name, operator, influencer_name) triples.
        Returns empty list if none found.
    """

    elems = elem.findall(f'.//{ns}{tag}')
    return get_sinks_from_field_values(elems)

def get_conn_target_map(elem: El) -> dict[El, tuple[str, ConnType, bool]] | None:
    """Get a connector map that works for all possible start elements.

    Args:
        elem: Element to search for connectors.

    Returns:
        Dictionary mapping connector elements to (target_name, connector_type, is_optional).
        Optional connectors are ones that need not be followed (e.g., in a decision).
        If an element contains only optional connectors, it may be a terminal element.
        Returns None if element is None.
    """
    if elem is None:
        return None

    tag = get_tag(elem)
    if tag == 'startElementReference':
        conn_name = elem.text
        if conn_name is None or conn_name == '':
            return {}
        else:
            return {elem: (conn_name, ConnType.Other, False)}

    elif tag == 'start':
        standard_connectors = _get_conn_target_map(elem)

        # Now look for scheduled paths
        scheduled_paths = elem.findall(f'.//{ns}scheduledPaths/{ns}connector')
        if scheduled_paths is None or len(scheduled_paths) == 0:
            return standard_connectors
        else:
            seen_scheduled_targets = []
            for x in scheduled_paths:
                try:
                    conn_name = x.find('.//{ns}targetReference').text
                    if conn_name not in seen_scheduled_targets:
                        seen_scheduled_targets.append(conn_name)

                        standard_connectors[x] = (conn_name, ConnType.Other, False)
                # noinspection PyBroadException
                except:
                    continue
            return standard_connectors
    else:
        return _get_conn_target_map(elem)


def _get_conn_target_map(elem: El) -> dict[El, tuple[str, ConnType, bool]]:
    """Get map from connectors at element to where they point.

    Args:
        elem: Base element containing connectors (Flow Element).

    Returns:
        Dictionary mapping connector elements to (target_reference, connector_type, is_optional).
        Returns empty dict if element is None.
    """
    if elem is None:
        return {}
    to_return = {}
    el_tag = get_tag(elem)
    is_optional = False  # start with this and then override
    missing_connector = False
    seen_targets = []

    if el_tag == 'decisions':

        rules_els = get_by_tag(elem, 'rules')
        for rule in rules_els:
            conn = get_by_tag(rule, 'connector')
            if not conn:
                # if there is a condition with no connector
                # then this element can terminate execution
                # when the condition is met
                missing_connector = True
                break

    for conn_type in CONN_LIST:
        cons = elem.findall(f'.//{ns}{conn_type}')
        if cons is not None and len(cons) > 0:
            for x in cons:
                if conn_type in [FAULT_CONNECTOR, TIMEOUT_CONNECTOR, NEXT_VALUE_CONNECTOR]:
                    is_optional = True
                if conn_type == NO_MORE_CONN:
                    is_optional = False
                if (el_tag == 'decisions' and (missing_connector is True or
                    conn_type != DEFAULT_CONN)):
                    # connectors are optional if they are not default
                    # or if they are default and a rule is missing a connector
                    is_optional = True

                res = get_by_tag(elem=x, tag_name='targetReference')
                if res is None or len(res) == 0:
                    logger.error(f"ERROR: found a connector without a target reference! "
                                 f"{get_elem_string(elem)}")
                    continue
                else:
                    # don't overwrite existing value -- each connector should have a single target reference
                    assert x not in to_return

                    target_name = res[0].text
                    if target_name not in seen_targets:
                        seen_targets.append(target_name)
                        # classify connector
                        if is_goto_connector(x):
                            # this takes priority
                            to_return[x] = (target_name, ConnType.Goto, is_optional)

                        elif conn_type == NEXT_VALUE_CONNECTOR:
                            to_return[x] = (res[0].text, ConnType.Loop, is_optional)

                        elif conn_type == FAULT_CONNECTOR or conn_type == TIMEOUT_CONNECTOR:
                            to_return[x] = (res[0].text, ConnType.Exception, is_optional)

                        else:
                            to_return[x] = (res[0].text, ConnType.Other, is_optional)

    return to_return


#
#
#  Utilities for parsing variables
#

def is_assign_null(elem: El) -> bool | None:
    """Check if an element has assignNullValuesIfNoRecordsFound set.

    Args:
        elem: XML Element to check.

    Returns:
        True if assignNullValuesIfNoRecordsFound is 'true', False if 'false',
        None if the field is missing.
    """
    res = elem.find(f'{ns}assignNullValuesIfNoRecordsFound')
    if res is None:
        return None
    return res.text == 'true'


def is_auto_store(elem: El) -> bool | None:
    """Check if an element has storeOutputAutomatically set.

    Args:
        elem: XML Element to check.

    Returns:
        True if storeOutputAutomatically is 'true', False if 'false',
        None if the field is missing or can't be parsed.
    """
    res = elem.find(f'{ns}storeOutputAutomatically')
    if res is None:
        return None
    return res.text == 'true'


def is_collection(elem: El) -> bool | None:
    """Check if an element represents a collection.

    Args:
        elem: XML Element to check.

    Returns:
        True if isCollection is 'true', False if 'false',
        None if the field is missing or can't be parsed.
    """
    res = elem.find(f'{ns}isCollection')
    if res is None:
        return None
    return res.text == 'true'


def get_input_fields(elem: El) -> set[El] | None:
    """Get all input field elements from a flow element.

    Args:
        elem: Element to search for input fields.

    Returns:
        Set of input field XML elements, or None if none found.
    """
    accum = set()
    elems = elem.findall(f'.//{ns}fields')
    for el in elems:
        for child in el:
            if child.tag == f'{ns}fieldType' and child.text == 'InputField':
                accum.add(el)
                break
    if len(accum) == 0:
        return None
    else:
        return accum


def get_obj_name(elem: El) -> str | None:
    """Get the object name from an element.

    Args:
        elem: XML Element to extract object name from.

    Returns:
        Object name string, or None if not found.
    """
    object_name = elem.find(f'{ns}object')
    if object_name is None:
        return None
    return object_name.text


def get_output_reference(elem: El) -> str | None:
    """Get the output reference from an element.

    Args:
        elem: XML Element to extract output reference from.

    Returns:
        Output reference string, or None if not found.
    """
    object_name = elem.find(f'{ns}outputReference')
    if object_name is None:
        return None
    return object_name.text


def get_datatype(elem: El) -> DataType | None:
    """Get the data type from an element.

    Args:
        elem: XML Element to extract data type from.

    Returns:
        DataType enum value, or None if not found or unrecognized.
    """
    obj_ = elem.find(f'{ns}dataType')
    if obj_ is None:
        return None
    else:
        object_name = obj_.text
        if object_name is None:
            return None

        if object_name == 'SObject':
            return DataType.Object

        if object_name == 'String':
            return DataType.StringValue

    return DataType.Literal


def is_get_first_record_only(elem: El) -> bool | None:
    """Check if an element has getFirstRecordOnly set.

    Args:
        elem: XML Element to check.

    Returns:
        True if getFirstRecordOnly is 'true', False if 'false',
        None if the field is missing.
    """
    res = elem.find(f'{ns}getFirstRecordOnly')
    if res is None:
        return None
    return res.text == 'true'


def is_input(elem: El) -> bool:
    """Check if an element is marked as an input.

    Args:
        elem: XML Element to check.

    Returns:
        True if isInput is 'true', False otherwise.
    """
    res = get_by_tag(elem, 'isInput')
    return len(res) > 0 and res[0].text == 'true'


def is_output(elem: El) -> bool:
    """Check if an element is marked as an output.

    Args:
        elem: XML Element to check.

    Returns:
        True if isOutput is 'true', False otherwise.
    """
    res = get_by_tag(elem, 'isOutput')
    return len(res) > 0 and res[0].text == 'true'


"""

    Helper Methods 

"""


def _process_assignment_item(elem: El) -> tuple[str, dict[str, str]] | None:
    """Extract assignment item data from an assignmentItem element.

    Args:
        elem: AssignmentItem element (not a top-level Flow element).

    Returns:
        Tuple of (operator, dict) where dict contains all keywords needed to
        construct DataInfluenceStatement except 'element_name'. Returns None
        if processing fails.
    """
    # This must match DataInfluenceStatement constructor
    entry = {
        'influenced_var': None,
        'influencer_var': None,
        'line_no': None,
        'source_text': get_elem_string(elem),
        'comment': "Variable Assignment",
    }
    operator = None

    for child in elem:
        if child.tag == f'{ns}assignToReference':
            entry['influenced_var'] = child.text
            # noinspection PyUnresolvedReferences
            entry['line_no'] = child.sourceline

        if child.tag == f'{ns}operator':
            operator = child.text
            if operator != "Assign" and operator != "Add":
                continue

        if child.tag == f'{ns}value':
            entry['influencer_var'] = _get_value(child)

    # Only proceed if all entries are populated
    if len([x for x in entry if entry[x] is None]) == 0 and operator is not None:
        return operator, entry
    else:
        logger.error(f"Failed to process assignments in {entry['source_text']}")
        return None


def _get_value(el: El) -> str | None:
    """Extract value from a value element.

    Args:
        el: Value element to extract from.

    Returns:
        Element reference text if found, STRING_LITERAL_TOKEN if other value type,
        None if no children.
    """
    for child in el:
        if get_tag(child) == 'elementReference':
            return child.text
        else:
            return STRING_LITERAL_TOKEN
    return None


def get_subflow_output_map(subflow: El) -> tuple[bool, dict[str, str]]:
    """Get the output mapping for a subflow.

    Args:
        subflow: Subflow XML element.

    Returns:
        Tuple of (auto_assign, mapping) where:
        - auto_assign: True if outputs are automatically assigned (flow_name.flow_var format)
        - mapping: Dictionary mapping child variable names to parent variable names
    """
    auto = False
    mappings = {}
    res1 = get_by_tag(subflow, 'storeOutputAutomatically')
    if len(res1) > 0:
        assert len(res1) == 1
        if res1[0].text.strip() == "true":
            auto = True
            return auto, mappings
    res2 = get_by_tag(subflow, 'outputAssignments')
    if len(res2) > 0:
        for assignment in res2:
            child_name = get_by_tag(assignment, 'name')[0].text
            parent_name = get_by_tag(assignment, 'assignToReference')[0].text
            mappings[child_name] = parent_name

    return auto, mappings


def get_subflow_input_map(subflow: El) -> dict[str, str]:
    """Get the input mapping for a subflow.

    Returns a map from caller variable to variable in called flow.

    For example, in this input assignment::

        <inputAssignments>
            <name>input_var1</name>
            <value>
                <elementReference>parent_input_var</elementReference>
            </value>
        </inputAssignments>

    we return::

        'parent_input_var' (name in parent) -> 'input_var1' (name in child)

    Args:
        subflow: Subflow XML Element.

    Returns:
        Dictionary mapping parent variable names to child input variable names.
    """
    accum = dict()
    inputs = get_by_tag(subflow, "inputAssignments")
    for assignment in inputs:
        val_els = get_by_tag(assignment, 'name')
        if len(val_els) != 1:
            continue
        else:
            val = val_els[0].text
        key_refs = assignment.findall(f'{ns}value[1]/{ns}elementReference[1]')
        if key_refs is None or len(key_refs) == 0:
            continue
        key = key_refs[0].text
        accum[key] = val
    return accum

def _get_tags(root: El, tags: list[str]) -> list[str]:
    """Extract text content from elements with specified tags.

    Args:
        root: Root element to search recursively.
        tags: List of tag names (without namespace) to find.

    Returns:
        List of non-empty text content from matching elements.
    """
    accum = []
    for tag in tags:
        res = root.findall(f'.//{ns}{tag}')
        for res in res:
            if res.text is not None and res.text.strip() != '':
                accum.append(res.text.strip())
    return accum

def get_all_flow_refs(root: El) -> list[str]:
    """Get all flow variable references from a flow root element.

    Extracts references from both direct reference holders and expression
    reference holders (which may contain merge-fields).

    Args:
        root: Root XML element of the flow.

    Returns:
        List of unique variable reference names.
    """
    accum = _get_tags(root, tags=DIRECT_REF_HOLDERS)
    expressions = _get_tags(root, tags=EXPRESSION_REF_HOLDERS)
    for expr in expressions:
        accum += parse_expression(expr)

    return list(set(accum))


def rid_item(msg: str) -> str:
    """Remove [$EachItem] token from a string.

    Args:
        msg: String to process.

    Returns:
        String with [$EachItem] removed.
    """
    return msg.replace('[$EachItem]', '')

def recursive_parse(my_obj: dict | list | str, parse_callable: Callable[[str], list[str]] = parse_expression, accum: list[str] | None = None) -> None:
    """Walk through JSON objects and apply parse_callable to string values.

    Recursively traverses dictionaries, lists, and strings, applying the
    parse_callable to all string values found.

    Args:
        my_obj: JSON object (dict, list, or str) to parse.
        parse_callable: Callable to parse strings (default: parse_expression).
        accum: List to accumulate results in. If None, creates a new list.
            Modified in place.

    Returns:
        None (results are added to accum in place).
    """
    if accum is None:
        my_accum = []
    else:
        my_accum = accum

    if isinstance(my_obj, dict):
        for key, value in my_obj.items():
            recursive_parse(value, parse_callable=parse_callable, accum=my_accum)  # Recurse into nested dictionaries

    elif isinstance(my_obj, list):
        for item in my_obj:
            recursive_parse(item, parse_callable=parse_callable, accum=my_accum)  # Recurse into list elements

    elif isinstance(my_obj, str):
        to_append = parse_callable(my_obj)
        if to_append is not None and len(to_append) > 0:
            [my_accum.append(x) for x in to_append]

    return None

def quick_validate(flow_path: str) -> bool | None:
    """Quickly validate a flow file by checking for required and banned tags.

    Performs a fast string-based check without full XML parsing.

    Args:
        flow_path: Path to the flow file to validate.

    Returns:
        True if flow has a start element and no banned elements,
        False if validation fails, None if file not found.
    """
    has_start = False
    has_banned = False
    try:
        # Flow XML is authored/declared UTF-8, so read it as UTF-8 explicitly
        # rather than relying on the platform locale encoding (e.g. cp1252 on
        # Windows), which would raise UnicodeDecodeError on valid flows and
        # cause them to be silently dropped. Fall back to cp1252 for legacy
        # files, matching the pattern used in flow_scanner/__main__.py.
        try:
            with open(flow_path, 'r', encoding='utf-8') as fp:
                flow_data = fp.read()
        except UnicodeDecodeError:
            # cp1252 is used on older Windows systems
            with open(flow_path, 'r', encoding='cp1252') as fp:
                flow_data = fp.read()

        for start_tag in START_ELEMS_TAGGED:
            if start_tag in flow_data:
                has_start = True
                break

        for banned_tag in BANNED_ELEMS_TAGGED:
            if banned_tag in flow_data:
                has_banned = True
                break

        return has_start and not has_banned

    except FileNotFoundError:
        logger.critical(f"Could not find file {flow_path}")
    except:
        logger.critical(f"could not quick_validate flow {flow_path}"
                        f"\n{traceback.format_exc()}")
        return False

def validate_flow(flow_path: str) -> bool:
    """Validate that a flow file can be parsed and processed.

    There are many legacy versions of flows that contain grammars we cannot parse.
    This tool only processes modern flows that can be built in flow builder.

    Args:
        flow_path: Path to the flow file to validate.

    Returns:
        True if the flow is valid (parseable, has start element, no banned elements),
        False otherwise.
    """
    # 1. Flows must be parseable
    # 2. Flows must have a start element
    # 3. Flows must not contain unsupported legacy tags corresponding to older grammars
    try:
        root = CP.get_root(flow_path)
        starts = get_by_tag(root, 'start')

        if len(starts) != 1:
            start_ref = get_by_tag(root, 'startElementReference')
            if len(start_ref) != 1:
                print(f"flow {flow_path} has no start element. Skipping..")
                return False

        for x in BANNED_ELEMS:
            if len(get_by_tag(root, x)) > 0:
                print(f"flow {flow_path} contains the legacy {x} element which is unsupported. Skipping..")
                return False
        return True

    except Exception:
        print(f"Could not parse flow {flow_path}. Skipping..")
        return False


