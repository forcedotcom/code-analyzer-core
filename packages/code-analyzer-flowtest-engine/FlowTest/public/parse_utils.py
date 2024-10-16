"""Public Utility module for xml queries on flows.

    The goal is to move all xml queries into this module,
    so they can be shared by other modules and made available
    to third parties in custom query development.

    .. NOTE:: The distinction between what goes in here and
              what goes in :mod:`flow_parser.parse` is that the parser
              has access to the flow root and does global analysis on flows,
              whereas the utility functions here are stateless.

    If you find yourself doing manual xml queries, look in this module
    first and add a method if one isn't already present.

"""
from __future__ import annotations

import logging
import re

from lxml import etree as ET

from public.enums import DataType, ConnType

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

#: list of all known connector tags
CONN_LIST = [CONNECTOR, DEFAULT_CONN, NEXT_VALUE_CONNECTOR, FAULT_CONNECTOR, NO_MORE_CONN]

#: module logger
logger = logging.getLogger(__name__)

#: regular expression to extract variables from formulas and templates
reg = re.compile(r"""\{!([^}]*)""")


def parse_expression(txt: str) -> list[str]:
    """
    Args:
        txt: expression or template definition string in which merge-fields are present

    Returns:
        List of elementRef names (empty list if no matches)
    """
    accum = []
    res = re.finditer(reg, txt)
    for x in res:
        accum.append(txt[x.span()[0] + 2:x.span()[1]])
    return accum


def get_tag(elem: ET._Element) -> str:
    if isinstance(elem, ET._Comment):
        return ''
    elif isinstance(elem, ET._Element):
        return elem.tag[NS_LEN:]
    else:
        return ''


def is_subflow(elem: ET._Element) -> bool:
    if elem is None:
        return False
    return get_tag(elem) == 'subflows'


def is_loop(elem: ET._Element) -> bool:
    """Is this a Loop Flow Element?

    Args:
        elem: xml element

    Returns:
        True if this is a loop element
    """
    if elem is None or elem.tag is None:
        return False
    return elem.tag.endswith("loops")


def is_goto_connector(elem: ET._Element) -> bool:
    """Is this element a goto?

    Args:
        elem: connector element

    Returns:
        whether this is a goto element
    """
    for child in elem:
        if get_tag(child) == 'isGoTo':
            return child.text == 'true'
        else:
            return False


def is_decision(elem: ET._Element) -> bool:
    """True if this is a decision Flow Element

    Args:
        elem: Flow Element

    Returns:
        True if decision
    """
    return get_tag(elem) == 'decisions'


def get_by_tag(elem: ET._Element, tagname: str) -> list[ET.etree._Element]:
    """Get list of all elem with the tag (ignoring ns).

        Convenience method as manually dealing with namespaces is clumsy.

        Notes:
            WARNING: does not recurse. Use this for top level flow
            elements -- e.g. screens, variables

        Returns:
            XML Elements else [] if no matches

    """
    return elem.findall(f'{ns}{tagname}')


def get_named_elems(elem: ET._Element) -> list[ET._Element]:
    """Get all descendents (recursive) of elem that have a ``name`` tag

    Args:
        elem: base element whose children to search

    Returns:
        [elem] or [] if None found

    """
    named = elem.findall(f'.//{ns}name/..')
    return [x for x in named if get_tag(x) != f'{ns}processMetadataValues']


def get_name(elem: ET._Element | None) -> str | None:
    """returns the string name of elem or None if no name or '*'"""
    if elem is None:
        return None
    name = elem.find(f'{ns}name')
    if name is None:
        if get_tag(elem) in ['start', 'startElementReference']:
            return '*'
        return None
    else:
        return name.text


def get_elem_string(elem: ET._Element) -> str | None:
    if elem is None:
        return ''
    else:
        return ET.tounicode(elem).strip()


def get_line_no(elem: ET._Element) -> int:
    return elem.sourceline


def get_subflow_name(subflow):
    return get_by_tag(subflow, "flowName")[0].text


def get_assignment_statement_dicts(elem: ET._Element) -> list[(str, {str: str})] | None:
    """Returns assignment statement keywords in 'assignments' elems
    Args:
        elem: elem to parse, should have a tag of "assignments"

    Returns:
        [(operator, dict)] where dict is suitable for constructing
        DataInfluenceStatements via \*\*args unpack passed to the constructor.
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


def get_filters(elem: ET._Element) -> [ET._Element]:
    """Find all filter elements

    Searches recursively to find all <filters> elements that are children
    of the current elem

    Args:
        elem: element to search

    Returns:
        list of xml elements

    """
    return elem.findall(f'.//{ns}filters')


def get_input_assignments(elem: ET._Element) -> [ET._Element]:
    """Find all input assignments

    Searches recursively to find all <inputAssignments> elements that are children
    of the current elem

    Args:
        elem: element to search

    Returns:
        list of xml elements

    """
    return elem.findall(f'.//{ns}inputAssignments')


def get_sinks_from_field_values(elems: ET._Element) -> list[(str, str)]:
    """Find variables that flow into field/value pairs

    E.g.if a recordLookup field has a filter::

        <filters>
            <field>Name</field>
            <operator>Contains</operator>
            <value>
                <elementReference>var3</elementReference>
            </value>
        </filters>

    then this would return [('Name', 'var3')]

    This strategy also works for inputAssignments::

        <inputAssignments>
            <field>Company</field>
            <value>
                <elementReference>Company</elementReference>
            </value>
        </inputAssignments>

    Notes:
          TODO: we are cheating a bit by not checking for op code in the case of filters.
          This should be added later.
    Args:
        elems: inputAssignment or field selection criteria xml elements.

    Returns:
        ``list[(field_name, influencer_name)]``  (an empty list if no sinks are found)

    """
    accum = []
    for a_filter in elems:
        field_name = None
        influencer = None

        for child in a_filter:
            child_tag = get_tag(child)
            if child_tag == 'field':
                field_name = child.text

            if child_tag == 'value':
                for e_ref in child:
                    if get_tag(e_ref) == 'elementReference':
                        influencer = e_ref.text

        if influencer is not None and field_name is not None:
            accum.append((field_name, influencer))

    return accum


def get_conn_target_map(elem: ET._Element) -> {ET._Element: (str, ConnType, bool)}:
    """returns map from connectors at elem to where they point

    Args:
        elem: base element containing connectors (Flow Element)

    Returns:
        connector element -> target reference (string), connector type, is_optional (True if connector is optional)
    """
    if elem is None:
        return {}
    to_return = {}
    if get_tag(elem) == 'decisions':
        is_decision_ = True
    else:
        is_decision_ = False

    for conn_type in CONN_LIST:
        cons = elem.findall(f'.//{ns}{conn_type}')
        if cons is not None and len(cons) > 0:
            for x in cons:
                if is_decision_ is True:
                    # in a decision, only default connectors are not optional
                    if conn_type == DEFAULT_CONN:
                        is_optional = False
                    else:
                        is_optional = True
                else:
                    if conn_type in [FAULT_CONNECTOR]:
                        is_optional = True
                    else:
                        is_optional = False

                res = get_by_tag(elem=x, tagname='targetReference')
                if res is None or len(res) == 0:
                    logger.error(f"ERROR: found a connector without a target reference! {ET.tounicode(elem)}")
                    continue
                else:
                    # don't overwrite existing value -- each connector should have a single target reference
                    assert x not in to_return

                    target_name = res[0].text
                    # classify connector
                    if is_goto_connector(x):
                        # this takes priority

                        to_return[x] = (target_name, ConnType.Goto, is_optional)

                    elif conn_type == NEXT_VALUE_CONNECTOR:
                        to_return[x] = (res[0].text, ConnType.Loop, is_optional)

                    else:
                        to_return[x] = (res[0].text, ConnType.Other, is_optional)

    return to_return


#
#
#  Utilities for parsing variables
#


def is_assign_null(elem: ET._Element) -> bool | None:
    res = elem.find(f'{ns}assignNullValuesIfNoRecordsFound')
    if res is None:
        return None
    return res.text == 'true'


def is_auto_store(elem: ET._Element) -> bool | None:
    # None if the field is missing or can't be parsed
    # otherwise true or false
    res = elem.find(f'{ns}storeOutputAutomatically')
    if res is None:
        return None
    return res.text == 'true'


def is_collection(elem: ET._Element) -> bool | None:
    # None if the field is missing or can't be parsed
    # otherwise true or false
    res = elem.find(f'{ns}isCollection')
    if res is None:
        return None
    return res.text == 'true'


def get_input_fields(elem: ET._Element) -> set[ET._Element] | None:
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


def get_obj_name(elem: ET._Element) -> str | None:
    object_name = elem.find(f'{ns}object')
    if object_name is None:
        return None
    return object_name.text


def get_output_reference(elem: ET._Element) -> str | None:
    object_name = elem.find(f'{ns}outputReference')
    if object_name is None:
        return None
    return object_name.text


def get_datatype(elem: ET._Element) -> DataType | None:
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


def is_get_first_record_only(elem: ET._Element) -> bool | None:
    res = elem.find(f'{ns}getFirstRecordOnly')
    if res is None:
        return None
    return res.text == 'true'


def is_input(elem: ET._Element) -> bool:
    res = get_by_tag(elem, 'isInput')
    return len(res) > 0 and res[0].text == 'true'


def is_output(elem: ET._Element) -> bool:
    res = get_by_tag(elem, 'isOutput')
    return len(res) > 0 and res[0].text == 'true'


"""

    Helper Methods 

"""


def _process_assignment_item(elem: ET._Element) -> (str, {str: str}):
    """Returns assignment item dict from assignment element

    Args:
        elem: (not a top Flow element) but an assignmentItem elem

    Returns:
        ::{ 'influenced_var': var_name, 'influencer_var': var_name or
        STRING_LITERAL_TOKEN, 'line_no': int, 'source_text': str
        assignmentItem code , 'comment': "Variable Assignment",
    }
    which is all keywords needed to construct DataInfluenceStatement
    except for 'element_name'
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


def _get_value(el: ET._Eleement) -> str:
    for child in el:
        if get_tag(child) == 'elementReference':
            return child.text
        else:
            return STRING_LITERAL_TOKEN


def get_subflow_output_map(subflow: ET._Element):
    """returns a tuple (bool:, map: child name --> parent name)
       where the first return value is true if outputs are automatically assigned
       in which case they are flow_name.flow_var
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


def get_subflow_input_map(subflow: ET._Element) -> {str: str}:
    """Returns a map from caller variable to variable in called flow

        E.g. in this example::

            <inputAssignments>
                <name>input_var1</name>
                <value>
                    <elementReference>parent_input_var</elementReference>
                </value>
            </inputAssignments>

        we return::

            'parent_input_var' (name in parent) -> 'input_var1' (name in child)

    Args:
        subflow: XML Element

    Returns:
        map from parent output_variable name to child input variable
        name
    """
    accum = dict()
    inputs = get_by_tag(subflow, "inputAssignments")
    for assignment in inputs:
        val = get_by_tag(assignment, 'name')[0].text
        key_refs = assignment.findall(f'{ns}value[1]/{ns}elementReference[1]')
        if key_refs is None or len(key_refs) == 0:
            continue
        key = key_refs[0].text
        accum[key] = val
    return accum
