"""Module for xml parsing of flow global attributes

"""

from __future__ import annotations

import sys
import traceback

from flow_parser import expression_parser
from public.flow_scanner_exceptions import InvalidFlowException

sys.modules['_elementtree'] = None
import xml.etree.ElementTree as ET

from typing import Optional
import logging
import public.parse_utils as parse_utils
import flow_scanner.util as util
from public.contracts import FlowParser
import public.custom_parser as CP

from public.parse_utils import get_by_tag, get_tag, get_name, get_named_elems, STRING_LITERAL_TOKEN, get_conn_target_map
from public.enums import RunMode, FlowType, TriggerType
from public.data_obj import VariableType
from public.enums import DataType, ReferenceType

#: hardcoded sfdc metadata namespace
ns: str = '{http://soap.sforce.com/2006/04/metadata}'

#: length of namespace for text munging
NS_LEN: int = len(ns)

#: logger instance
logger: logging.Logger = logging.getLogger(__name__)


def get_root(path: str) -> ET.Element:
    """Get flow root

    Args:
        path: path of xml file to load

    Returns:
        the root of the xml file

    """
    return CP.get_root(path)


class Parser(FlowParser):
    """API for parsing global lexical attributes of flow xml files.

    Parser instances do not contain any branch-dependent data. In particular
    when a variable is seen by the parser, that does not mean it has been
    initialized or added to the influence map. Parser initialization must
    precede Frame, State, and Crawler initialization.

    Parsers should not have any data modified after initialization except
    new member resolutions (e.g. Account.foo where 'foo' is new).

    Parsers should always be built with the :meth:`Parser.from_file` class method
    except for testing where from_string can be used, but then be sure to provide
    a dummy filename.

    """

    def __init__(self, root):
        #: XMl root of a single flow
        self.root: ET.Element = root

        #: current filepath of flow
        self.flow_path: str | None = None

        #: run mode as declared in flow xml
        self.declared_run_mode: RunMode | None = None

        #: effective run mode taking inheritance into account
        self.effective_run_mode: RunMode | None = None

        #: is this a screen or auto-launched flow
        self.flow_type: FlowType | None = None

        #: trigger type (None if not a trigger)
        self.trigger_type: TriggerType | None = None

        #: trigger object (False if not a trigger or unknown, str if a trigger but unknown)
        self.trigger_object: str | bool = False

        #: frozen set of all elements that have a child of <name> and are thus flow globals
        #: useful for setting scopes
        self.all_named_elems: frozenset[ET.Element] | None = None

        #: set of all names (names of named elements)
        self.all_names: tuple[str,] | None = None

        #: variables marked 'available for input', as a pair (flow_path, name)
        self.input_variables: frozenset[tuple[str, str]] | None = None

        #: variables marked 'available for output', as a tuple (flow_path, name)
        self.output_variables: frozenset[tuple[str, str]] | None = None

        #: for marking string literals
        self.literal_var = VariableType(tag='stringValue', datatype=DataType.Literal)

        #: cache of name resolutions encountered to this point at runtime:
        # (flow_path, raw_name) --> (name, member, Variable)
        # is built up as more variable resolutions are performed
        self.cached_resolutions: dict[tuple[str, str], tuple[str, str, VariableType]] | None = None

        #: all name resolutions from the entire flow (done by lexical parse of flow)
        #: populated when the flow is loaded. Only has parents.
        self.var_types: dict[tuple[str, str], VariableType] | None = None

    def get_all_named_elems(self) -> frozenset[tuple[str, str]] | None:
        return self.all_named_elems

    def get_all_names(self) -> tuple[str] | None:
        return self.all_names

    def get_effective_run_mode(self) -> RunMode:
        return self.effective_run_mode

    def get_declared_run_mode(self) -> RunMode:
        return self.declared_run_mode

    def get_filename(self) -> str:
        return self.flow_path

    def get_root(self) -> ET.Element:
        return self.root

    def get_literal_var(self) -> VariableType:
        return self.literal_var

    def get_action_call_map(self) -> dict[str, list[tuple[str, str]]] | None:
        """Gets all actionCalls in the flow element
        Returns: actionCall type -> (element name, action name)
        """
        accum = {}
        action_calls = parse_utils.get_by_tag(self.root, 'actionCalls')
        for action_call in action_calls:
            action_name_els = parse_utils.get_by_tag(action_call, 'actionName')
            action_type_els = parse_utils.get_by_tag(action_call, 'actionType')
            elem_name = parse_utils.get_name(action_call)
            if (len(action_name_els) != 1 or len(action_type_els) != 1 or
                action_name_els[0].text is None or action_type_els[0].text is None):
                logger.error(f"found invalid actionCall {elem_name} in flow {self.flow_path}")
                continue
            to_add = (action_type_els[0].text, elem_name, action_name_els[0].text)
            if to_add[0] not in accum:
                accum[to_add[0]] = [(to_add[1], to_add[2])]
            else:
                accum[to_add[0]].append((to_add[1], to_add[2]))

        if len(accum) == 0:
            return None
        else:
            return accum

    def get_async_scheduled_paths(self) -> list[str]:
        accum = []
        start = self.get_start_elem()
        if start is None or start.tag != f'{ns}start':
            return accum

        sched_els = get_by_tag(start, 'scheduledPaths')
        for sched_el in sched_els:
            path_types = get_by_tag(sched_el,'pathType')
            if (len(path_types) == 1 and
                path_types[0].text is not None and
                path_types[0].text.startswith('Async')):
                target = sched_el.find(f'./{ns}connector/{ns}targetReference')
                if target is not None and target.text is not None:
                    accum.append(target.text)
        return accum

    def get_trigger_object(self) -> str | None:
        if self.trigger_object is True:
            return None
        elif isinstance(self.trigger_object, str):
            return self.trigger_object

        # object is not set
        else:
            tt = self.get_trigger_type()
            if tt is TriggerType.NotTrigger or tt is TriggerType.Unknown:
                self.trigger_object = True
                return None

            else:
                starts = parse_utils.get_by_tag(self.root, 'start')
                if len(starts) != 1:
                    self.trigger_object = True
                    return None
                else:
                    start = starts[0]
                    objs = parse_utils.get_by_tag(start, 'object')
                    if len(objs) != 1:
                        self.trigger_object = True
                        return None
                    obj_name = objs[0].text
                    if obj_name is None or len(obj_name) == 0:
                        self.trigger_object = True
                        return None
                    else:
                        self.trigger_object = obj_name
                        return obj_name

    def get_trigger_type(self) -> TriggerType:
        if self.trigger_type is not None:
            return self.trigger_type

        else:
            starts = get_by_tag(self.root, 'start')
            if len(starts) != 1:
                self.trigger_type = TriggerType.NotTrigger
                return TriggerType.NotTrigger
            start = starts[0]
            child_els = get_by_tag(start, 'triggerType')

            if len(child_els) != 1:
                self.trigger_type = TriggerType.NotTrigger
                return TriggerType.NotTrigger

            t_type = child_els[0].text
            if t_type is None:
                self.trigger_type = TriggerType.Unknown
                return TriggerType.Unknown
            else:
                t_type = t_type.lower()

                if t_type == 'recordaftersave':
                    trigger_type = TriggerType.RecordAfterSave

                elif t_type == 'capability':
                    trigger_type = TriggerType.Capability

                elif t_type == 'scheduled':
                    trigger_type = TriggerType.Scheduled

                elif t_type == 'recordbeforesave':
                    trigger_type = TriggerType.RecordBeforeSave

                elif t_type == 'recordbeforedelete':
                    trigger_type = TriggerType.RecordBeforeDelete

                elif t_type == 'platformevent':
                    trigger_type = TriggerType.PlatformEvent

                elif t_type == 'segment':
                    trigger_type = TriggerType.Segment

                else:
                    trigger_type = TriggerType.Unknown

                self.trigger_type = trigger_type
                return trigger_type


    def get_flow_type(self) -> FlowType:
        """Returns type of flow

        If the flow_type member attribute is not set, it is determined,
        set and returned.

        Returns:
            FlowType
        """
        if self.flow_type is not None:
            return self.flow_type

        flow_type = None

        tt = self.get_trigger_type()
        if tt is not TriggerType.NotTrigger:
            flow_type = FlowType.Trigger
            self.flow_type = flow_type
            return flow_type

        pt = get_by_tag(self.root, 'processType')

        if len(pt) > 0:
            pt = pt[0].text.lower()

            # Screen
            # <processType>Flow and start does not have trigger or schedule
            if pt == 'flow' or len(get_by_tag(self.root, 'screens')) > 0:
                flow_type = FlowType.Screen

            elif pt == 'workflow':
                flow_type = FlowType.Workflow

            elif pt == 'invocableprocess':
                flow_type = FlowType.InvocableProcess

            # AutoLaunched
            # Some teams have their own names, e.g. FooAutolaunchedFlow
            # Notice this messes up capitalization from normal 'AutoLaunchedFlow'
            # there are also recommendation strategies, etc.
            elif pt.endswith('autolaunchedflow'):
                flow_type = FlowType.AutoLaunched

            elif pt.lower() == 'orchestrator':
                flow_type = FlowType.Orchestrator

        if flow_type is not None:
            self.flow_type = flow_type
            return flow_type
        else:
            logger.critical(f"Could not determine flow type for {self.flow_path}, setting to autolaunched")
            self.flow_type = FlowType.AutoLaunched
            return FlowType.AutoLaunched

    def resolve_by_name(self, name: str, path: str | None = None,
                        strict: bool = False) -> Optional[(str, str, VariableType)]:
        """Resolves name to variable, property, VariableType. Does not store anything.

        Examples::

        Args:
            name: raw name as it is used in the flow xml file (e.g. foo.bar.baz)
            path: filename in which to resolve
            strict: whether to resolve unknown variables to None (which can cause program execution
                    to terminate) or to create a best effort 'unknown' variable type resolution.

        Returns:
            ``None`` if the name cannot be resolved,
            else the triple (parent name, member, type)

        """

        """
            First, deal with case of string literal, 
             already seen variable, or global variable
        """
        if name == STRING_LITERAL_TOKEN:
            return name, None, self.literal_var

        if path is None:
            path = self.flow_path

        seen = self.get_cached_resolution(name=name, path=path)
        if seen is not None:
            return seen


        """
        We have a real flow variable that needs to be resolved.
        
        tst1 = 'subflow_name.my_obj.Account.Name.my_obj.Account.Name' 
                -> ('subflow_name.my_obj', 'Account.Name.my_obj.Account.Name', VT)
                
        tst2 = 'my_var.Account.Name.my_obj.Account.Name' 
                -> ('my_var', 'Account.Name.my_obj.Account.Name', VT)
                
        tst3 = 'my_var.Name' 
                -> ('my_var', 'Name', VT)
                
        tst4 = 'my_var' 
                -> ('my_var', None, VT)
          
          
        we start with the first element 'subflow_name' which 
        should have been initialized as a variable (in this case, a subflow)
        and we look if this is a variable or an indirect reference. 
        - if it's an indirect reference, we take the parent as
        'subflow_name.my_obj' and 'Account.Name.my_obj.Account.Name' is a property.
        - otherwise, we take first part, 'subflow_name' as parent and everything
        else as a property.
            
        if the parent is not in the list of initialized variables, this means that a new
        element type has been added to flows that flow scanner does not know about. 
        In this case, behavior is determined by the 'strict' flag. In strict usage, we return None.
        Otherwise, we create a dummy 'unknown' variable type and assume it only applies
        to the top level, logging the error. 
            
        """

        # now do more complex logic
        splits = name.split('.')
        spl_len = len(splits)

        for i in range(0, spl_len):
            tst = '.'.join(splits[0:spl_len-i])
            if (path, tst) in self.var_types:
                var_type = self.var_types[(path, tst)]

                if var_type.tag.startswith("$") and var_type.tag in parse_utils.GLOBALS_SINGLETON:
                    # These elements should not be viewed as properties of vectors
                    res = name, None, var_type

                elif var_type.tag in ['subflows', 'actions', 'actionCalls', 'apexPluginCalls', 'stageSteps',
                                      "$Input", "$Output", "$Setup"]:
                    # these elements do not a single variable but the return of a set of variables that must each be
                    # referenced by name.
                    # If the function itself is used, then this
                    # could be that it returned successfully and will be a boolean, but to get the variables
                    # we need another param. e.g. subflow_name.varname.Id
                    if len(tst) == len(name):
                        res = tst, None, var_type
                    else:
                        parent = tst + '.' + splits[spl_len-i]
                        if len(parent) == len(name):
                            member = None
                        else:
                            member = name[len(parent)+1:]
                        res = parent, member, var_type

                else:
                    if len(tst) == len(name):
                        res = tst, None, var_type
                    else:
                        res = tst, name[len(tst)+1:], var_type

                # add to cache for future lookups
                self.cached_resolutions[(path, name)] = res
                return res
            else:
                # keep looking for parents
                continue

        # If we fall through here, then we could not find a resolution
        logger.critical(f"Could not resolve name {name} in path {path}")

        if strict:
            return None
        else:
            # treat as a literal value
            return name, None, self.literal_var



    @classmethod
    def from_file(cls, filepath: str, old_parser: Parser = None) -> Parser:
        root = CP.get_root(filepath)
        parser = Parser(root)
        parser.flow_path = filepath
        parser.update(old_parser=old_parser)
        return parser

    @classmethod
    def from_string(cls, xml_string: str | bytes, filepath_to_use: str,
                    old_parser: Parser = None) -> Parser:
        if isinstance(xml_string, str):
            root = CP.get_root_from_string(xml_string.encode())
        elif isinstance(xml_string, bytes):
            root = CP.get_root_from_string(xml_string)
        else:
            raise ValueError(f"cannot build a parser from type {type(xml_string)}."
                             f" Please use str or bytes.")
        parser = Parser(root)
        parser.flow_path = filepath_to_use
        parser.update(old_parser=old_parser)
        return parser

    def update(self, old_parser: Parser = None, is_return=False) -> Parser:
        """Parse flow root and populate default values

        Args:
            old_parser: when updating a new parser from an old, to copy over elements
                        and update run-mode

            is_return: are we returning from a function call?

        Returns:
            None

        """
        all_named, all_names, vars_, inputs, outputs = _get_global_flow_data(self.flow_path, self.root)
        # all_named_elems are ET elements that have a <name> tag as a child
        self.all_named_elems = all_named
        # there are the names above
        self.all_names = all_names

        # all resolutions of all variables (parents) defined in the flow
        self.var_types = vars_
        self.input_variables = inputs
        self.output_variables = outputs
        self.get_flow_type()  # will populate flow type
        self.declared_run_mode = self.get_run_mode()
        self.flow_type = self.get_flow_type()
        self.trigger_type = self.get_trigger_type()
        self.trigger_object = self.get_trigger_object()
        self.cached_resolutions = dict()

        if old_parser is None:
            self.effective_run_mode = self.declared_run_mode
            self.flow_type = self.get_flow_type()

        else:
            self.flow_type = old_parser.flow_type

            if not is_return:
                # if returning from a function call, don't inherit sharing from the child!
                self.effective_run_mode = util.get_effective_run_mode(
                    parent_sharing=old_parser.get_effective_run_mode(),
                    current_sharing=self.declared_run_mode
                )

            # we always update parsed variables, so we have full resolutions available
            self.cached_resolutions.update(old_parser.cached_resolutions)
            self.var_types.update(old_parser.var_types)
        return self

    def get_output_variables(self, path: str | None = None) -> set[tuple[str, str]]:
        if path is None:
            path = self.flow_path
        return {(x, y) for (x, y) in self.output_variables if x == path}

    def get_input_variables(self, path: str | None = None) -> set[tuple[str, str]]:
        if path is None:
            path = self.flow_path
        return {(x, y) for (x, y) in self.input_variables if x == path}

    def get_input_field_elems(self) -> set[ET.Element] | None:
        return parse_utils.get_input_fields(self.root)

    def get_input_output_elems(self) -> dict[str, set[ET.Element]]:
        """
        Returns::
              {"input": input variable elements,
              "output": output variable elements }
        """
        vars_ = self.get_all_variable_elems()
        input_accum = set()
        output_accum = set()
        if vars_ is None:
            vars_ = []
        for elem in vars_:
            for child in elem:
                if child.tag == f'{ns}isInput' and child.text == 'true':
                    input_accum.add(elem)
                if child.tag == f'{ns}isOutput' and child.text == 'true':
                    output_accum.add(elem)

        return {"input": input_accum,
                "output": output_accum
                }

    def get_by_name(self, name_to_match: str, scope: ET.Element | None = None) -> ET.Element | None:
        """returns the first elem with the given name that is a child of the scope element"""
        if name_to_match == '*':
            return self.get_start_elem()

        if scope is None:
            scope = self.root
            if self.all_named_elems is None:
                self.all_named_elems = get_named_elems(scope)
            elems_in_scope = self.all_named_elems
        else:
            elems_in_scope = get_named_elems(scope)

        for current in elems_in_scope:
            if get_name(current) == name_to_match:
                return current

        return None

    def get_flow_name(self) -> str:
        """we assume there is always a flow label."""
        res = get_by_tag(self.root, 'label')
        if len(res) == 0:
            raise InvalidFlowException(f"Flow {self.flow_path} has no name, skipping..")
        else:
            return res[0].text

    def get_run_mode(self) -> RunMode:
        """Get effective context of flow

        Returns:
            RunMode public enum

        """
        flow_type = self.get_flow_type()

        if flow_type is FlowType.InvocableProcess:
            # always runs in user mode
            return RunMode.DefaultMode

        if flow_type in [FlowType.Workflow, FlowType.Trigger, FlowType.ProcessBuilder]:
            # always runs in system mode
            return RunMode.SystemModeWithoutSharing

        # for screen and other autolaunched, check if there is a declaration
        # otherwise go with default
        elems = get_by_tag(self.root, 'runInMode')
        if len(elems) == 0:
            return RunMode.DefaultMode
        else:
            return RunMode[elems[0].text]

    def get_api_version(self) -> str:
        return get_by_tag(self.root, 'apiVersion')[0].text

    def get_all_traversable_flow_elements(self) -> list[ET.Element]:
        """ ignore start"""
        return [child for child in self.root if
                get_tag(child) in parse_utils.CTRL_FLOW_ELEM]

    def get_all_variable_elems(self) -> list[ET.Element] | None:
        elems = get_by_tag(self.root, 'variables')
        if len(elems) == 0:
            return None
        else:
            return elems

    def get_templates(self) -> list[ET.Element]:
        """Grabs all template elements.
           Returns empty list if none found
        """
        templates = get_by_tag(self.root, 'textTemplates')
        return templates

    def get_formulas(self) -> list[ET.Element]:
        """Grabs all formula elements.
                Returns empty list if none found
        """
        formulas = get_by_tag(self.root, 'formulas')
        return formulas

    def get_choices(self) -> list[ET.Element]:
        choices = get_by_tag(self.root, 'choices')
        return choices

    def get_dynamic_choice_sets(self) -> list[ET.Element]:
        dcc = get_by_tag(self.root, 'dynamicChoiceSets')
        return dcc

    def get_constants(self) -> list[ET.Element]:
        constants = get_by_tag(self.root, 'constants')
        return constants

    def get_start_elem(self) -> ET.Element | None:
        """Get first element of flow

        Returns:
            <start> element or element pointed to in <startElementReference>

        """
        res = parse_utils.get_start_element(self.root)
        if res is None:
            raise InvalidFlowException(f"No start element found in {self.flow_path}")
        else:
            return res

    def get_all_indirect_tuples(self) -> list[tuple[str, ET.Element]]:
        """returns a list of tuples of all indirect references, e.g.
        str, elem, where str influences elem.
        The elem is a formula or template element and
        str is an extracted merge-field from the elem
        """
        accum = []
        elems = self.get_templates() + self.get_formulas()
        for elem in elems:
            expr = None
            if elem.tag == f'{ns}textTemplates':
                expr = elem.find(f'{ns}text').text
                if expr is not None:
                    influencers = expression_parser.extract_expression(expr)
                    [accum.append((var, elem)) for var in influencers]
            if elem.tag == f'{ns}formulas':
                # is a formula
                expr = elem.find(f'{ns}expression').text
                if expr is not None:
                    # we parse formulas but only extract (grep) text templates
                    influencers = expression_parser.parse_expression(expr)
                    [accum.append((var, elem)) for var in influencers]
            if expr is None:
                # we have seen empty expressions in flows
                continue

        return accum

    def get_cached_resolution(self, name: str, path: str | None = None) -> tuple[str, str | None, VariableType] | None:
        """Gets the VariableType for the named Flow Element

        Only looks in cache.

        Args:
            name: name of Flow Element to retrieve
            path: filename to use (if None, use current path)

        Returns:
            VariableType or None if not present in cache
        """
        if name == STRING_LITERAL_TOKEN:
            return name, None, self.literal_var

        if path is None:
            path = self.flow_path

        if (path, name) in self.cached_resolutions:
            return self.cached_resolutions[(path, name)]
        else:
            return None

    def get_called_descendents(self, elem_name: str) -> list[str]:
        """Returns empty list if no descendents
        """
        el = self.get_by_name(elem_name)
        return [x[0] for x in get_conn_target_map(el).values()]

    def get_traversable_descendents_of_elem(self, elem_name: str) -> list[str]:
        """includes the original elem name"""
        visited = []
        worklist = []
        curr_name = elem_name
        while True:
            visited.append(curr_name)
            to_add = [x for x in self.get_called_descendents(curr_name) if
                        (x not in visited and x not in worklist)]
            worklist = worklist + to_add

            if worklist:
                curr_name = worklist.pop(0)
            else:
                return visited


def build_vartype_from_elem(elem: ET.Element) -> VariableType | None:
    """Build VariableType from XML Element

    The purpose of this function is to assign types to named
    flow elements, in order to assist in object resolution
    and type analysis.

    We are primarily interested in variable names and flow element names
    that can represent variables (via auto-naming conventions).
    Do not add flow elements that can't be used to resolve variable
    names -- e.g. if an element has an explicit outputAssignment,
    then you cannot refer to the output of the flow element by the
    element name, and therefore should not attempt to create a
    variable from this flow element.

    Args:
        elem: must be a *named* Flow element (e.g. an element with a <name> tag that
              is a child of the element root)

    Returns:
        VariableType instance containing type information for the element or None
        If the element is not a named Flow element or is unknown to the parser.
    """
    if elem is None:
        return None

    tag = get_tag(elem)

    try:

        if tag == 'actionCalls':
            # needs wiring
            is_ = parse_utils.is_auto_store(elem)
            if is_:
                reference = ReferenceType.ActionCallReference

                return VariableType(tag=tag,
                                    reference=reference)
            else:
                return VariableType(tag=tag, reference=ReferenceType.NodeReference)

        if tag == 'actions':
            # needs wiring
            # These are actions associated to screen flows
            # and can have an actionType of "flow" so that they
            # behave also as subflows, with a return value of ".Results"
            # Also have input parameters
            return VariableType(tag=tag, reference=ReferenceType.ElementReference)

        if tag == 'apexPluginCalls':
            # needs wiring
            # old action type but needs output parameters
            # defined, however it evaluates to 'true' if called.
            return VariableType(tag=tag, reference=ReferenceType.NodeReference)

        if tag == 'assignments':
            return None

        if tag == 'capabilityTypes':
            return None

        if tag == 'choices':
            # TODO: handle this better, now put in a stub
            datatype = parse_utils.get_datatype(elem)
            return VariableType(tag=tag, datatype=datatype, reference=ReferenceType.ElementReference)

        if tag == 'collectionProcessors':
            subtype = elem.find(f'{ns}elementSubtype')
            if subtype is not None and subtype.text == 'FilterCollectionProcessor':
                # These always store automatically
                # TODO: Better type inferences needed. Defer this for now.
                return VariableType(tag=tag,
                                    reference=ReferenceType.CollectionReference,
                                    is_collection=True)
            else:
                return VariableType(tag=tag,reference=ReferenceType.NodeReference)

        if tag == 'constants':
            datatype = parse_utils.get_datatype(elem)
            return VariableType(tag=tag, datatype=datatype, reference=ReferenceType.Constant)

        if tag == 'customErrors':
            # Displays an error message
            # Does not hold value
            return None

        if tag == 'customProperties':
            return VariableType(tag='stringValue', datatype=DataType.Literal)

        if tag == 'decisions':
            return None

        if tag == 'dynamicChoiceSets':
            # These are effectively record lookups
            # TODO: handle this better, right now we just have a stub
            datatype = parse_utils.get_datatype(elem)
            obj_type = parse_utils.get_obj_name(elem)
            return VariableType(tag=tag, datatype=datatype, object_name=obj_type)

        if tag == 'exitActionInputParameters':
            #todo: check
            return None

        if tag == 'entryActionInputParameters':
            #todo: check
            return None

        if tag == 'fields':
            # TODO: support more vars as time allows. Screens have many possible components.
            # every field should have a field type
            # TODO: decide on nullable policy -- say declare nullable if no default?
            field_type = elem.find(f'{ns}fieldType')
            if field_type is not None:
                fld_type = elem.find(f'{ns}fieldType').text
                if fld_type == 'InputField' or fld_type == 'ComponentInstance':
                    is_not_required_t = elem.find(f'{ns}isRequired')
                    if is_not_required_t is not None and is_not_required_t.text == 'true':
                        is_not_required = True
                    else:
                        is_not_required = False
                    return VariableType(tag=tag,
                                        reference=ReferenceType.ElementReference,
                                        is_collection=False,
                                        is_optional=is_not_required)

            # put in a stub
            # TODO: revisit this against corpus
            return VariableType(tag=tag, datatype=DataType.StringValue,
                                reference=ReferenceType.ElementReference,
                                is_collection=False)

        if tag == 'formulas' or tag == 'textTemplates':
            return VariableType(tag=tag, datatype=DataType.StringValue,
                                reference=ReferenceType.Formula,
                                is_collection=False)

        if tag == 'inputAssignments':
            #todo: check
            return None

        if tag == 'inputs':
            return None

        if tag == 'inputParameters':
            return None

        if tag == 'loops':
            return VariableType(tag=tag,
                                reference=ReferenceType.CollectionReference,
                                is_optional=False, is_collection=True)

        if tag == 'orchestratedStages':
            return None

        if tag == 'outputAssignments':
            return None

        if tag == 'outputParameters':
            # use in action calls to assign outputs
            # to variables. The <name> subelement
            # does not refer to the output parameter
            # element
            return None

        if tag == 'recordCreates':
            # Todo: get collection parsing correct, look if record being created is itself
            # a collection element - do examples of bulkified versions of commands.
            is_ = parse_utils.is_auto_store(elem)
            obj_ = parse_utils.get_obj_name(elem)
            if is_ is True and obj_ is not None:
                reference = ReferenceType.ElementReference
            else:
                reference = ReferenceType.NodeReference
            return VariableType(tag=tag, datatype=DataType.StringValue,
                                reference=reference,
                                object_name=obj_, is_optional=False)

        if tag == 'recordDeletes':
            return None

        if tag == 'recordLookups':
            type_ = DataType.Object
            nulls_provided = parse_utils.is_assign_null(elem)
            is_ = not parse_utils.is_get_first_record_only(elem)
            if is_ is None:
                logger.critical(f"Error parsing recordLookups {parse_utils.get_name(elem)}")
                return None
            # Todo: once we support second order flows, we'll need to add all of recordLookups
            if parse_utils.is_auto_store(elem) is True:
                # this is a valid element reference to the return value of the lookups
                ref_ = ReferenceType.ElementReference

                return VariableType(tag=tag, datatype=type_, reference=ref_, is_collection=is_,
                                    object_name=parse_utils.get_obj_name(elem),
                                    is_optional=nulls_provided is not None and nulls_provided is False)
            # put in a stub
            else:
                return VariableType(tag=tag, datatype=type_, is_collection=is_,
                                    reference=ReferenceType.NodeReference,
                                    object_name=parse_utils.get_obj_name(elem),
                                    is_optional=nulls_provided is not None and nulls_provided is False)

        if tag == 'recordRollbacks':
            return None

        if tag == 'recordUpdates':
            return None

        if tag == 'rules':
            return None

        if tag == 'scheduledPaths':
            return None

        if tag == 'screens':
            # the variable is not held by the screen but by elements
            # within it, such as 'field'
            return None

        if tag == 'stageSteps':
            # needs wiring
            # output as foo.Outputs.output_var_name
            return VariableType(tag=tag,reference=ReferenceType.ElementReference)


        if tag == 'stages':
            return VariableType(tag=tag,reference=ReferenceType.ElementReference)

        if tag == 'subflows':
            if parse_utils.is_auto_store(elem) is True:
                # todo: we need a None field for booleans we don't know
                return VariableType(tag=tag,
                                    reference=ReferenceType.SubflowReference)
            else:
                return VariableType(tag=tag, reference=ReferenceType.NodeReference)

        if tag == 'transforms':
            # needs wiring
            return VariableType(tag=tag,
                                is_collection=parse_utils.is_collection(elem),
                                datatype=parse_utils.get_datatype(elem),
                                reference=ReferenceType.ElementReference)

        if tag == 'variables':
            # TODO: handle default variable values in wiring module

            datatype = parse_utils.get_datatype(elem)
            is_optional = elem.find(f'{ns}value') is None  # (No default value provided)
            input_ = parse_utils.is_input(elem)
            output_ = parse_utils.is_output(elem)
            is_coll = parse_utils.is_collection(elem)
            obj_ = elem.find(f'{ns}objectType')
            if obj_ is not None:
                obj_ = elem.find(f'{ns}objectType').text
            else:
                obj_ = None

            if datatype is None:
                logger.warning("Could not parse datatype")
            return VariableType(tag=tag, datatype=datatype, reference=ReferenceType.Direct,
                                is_collection=is_coll, is_optional=is_optional, object_name=obj_,
                                is_input=input_, is_output=output_,
                                properties=None)

        if tag == 'waitEvents':
            # needs wiring
            # return values are explicitly assigned to other variables
            return None

        if tag == 'waits':
            return None


    except Exception as e:
        # Todo: create flow exception here
        logger.critical(f"Error parsing variable element {traceback.format_exc()}")

    # Pass through
    logger.critical(f"Variable type cannot find match for elem {parse_utils.get_name(elem)} with tag {tag}")
    return None


def _get_global_flow_data(flow_path, root: ET.Element) \
        -> tuple[list[ET.Element], tuple[str,...], dict[tuple[str, str], VariableType],
        frozenset[tuple[str, str]], frozenset[tuple[str, str]]]:

    all_named = get_named_elems(root)

    # all named cannot be None, each flow must have at least one named element.
    assert all_named is not None

    name_dict = {x: get_name(x) for x in all_named if x is not None}
    all_names = tuple(list(name_dict.values()))
    vars_ = dict()
    inputs = []
    outputs = []

    # add in globals
    for x in parse_utils.ALL_GLOBALS:
        vars_[(flow_path, x)] = VariableType(tag=x, reference=ReferenceType.Global)

    # add in named elements that reference a value
    for x in all_named:
        try:
            var = build_vartype_from_elem(x)
        except Exception:
            logger.error(f"ERROR parsing element {parse_utils.get_elem_string(x)}")
            continue
        if var is not None:
            if var.tag == 'actions':
                vars_[(flow_path, name_dict[x] + ".Results")] = var

            elif var.tag == 'stageSteps':
                # e.g. if a stage called 'my_stage' is found in the xml file
                # we add the variable my_stage.Outputs. to the list of variables
                vars_[(flow_path, name_dict[x] + ".Outputs")] = var

            else:
                vars_[(flow_path, name_dict[x])] = var

            if var.is_input:
                inputs.append((flow_path, name_dict[x]))

            if var.is_output:
                outputs.append((flow_path, name_dict[x]))

    return all_named, all_names, vars_, frozenset(inputs), frozenset(outputs)


