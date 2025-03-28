"""Module for xml parsing of flow global attributes

"""

from __future__ import annotations

import sys

from flow_parser import expression_parser
from public.flowtest_exceptions import InvalidFlowException

sys.modules['_elementtree'] = None
import xml.etree.ElementTree as ET

from typing import Optional
import logging
import public.parse_utils as parse_utils
import flowtest.util as util
from public.contracts import FlowParser
import public.custom_parser as CP

from public.parse_utils import get_by_tag, get_tag, get_name, get_named_elems, STRING_LITERAL_TOKEN, get_conn_target_map
from public.enums import RunMode, FlowType
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

        #: frozen set of all elements that have a child of <name> and are thus flow globals
        #: useful for setting scopes
        self.all_named_elems: frozenset[ET.Element] | None = None

        #: set of all names (names of named elements)
        self.all_names: (str,) or None = None

        #: variables marked 'available for input', as a pair (flow_path, name)
        self.input_variables: frozenset[(str, str)] | None = None

        #: variables marked 'available for output', as a tuple (flow_path, name)
        self.output_variables: frozenset[(str, str)] | None = None

        #: for marking string literals
        self.literal_var = VariableType(tag='stringValue', datatype=DataType.Literal)

        #: map from (path, (resolved) parent name) --> Variable (cache)
        self.__seen_parents: {(str, str): VariableType} = {}

        #: cache of name resolutions: (flow_path, raw_name) --> (name, member, Variable)
        self.__seen_resolutions: {(str, str): (str, str, VariableType)} = {}

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

        # Process Builder
        # no <start> but <startElementReference>
        res = get_by_tag(self.root, 'startElementReference')
        if len(res) == 0:
            res = get_by_tag(self.root, 'start')
            if len(res) == 0:
                # this is an old format record trigger flow
                self.flow_type = FlowType.RecordTrigger
                return FlowType.RecordTrigger
        start = res[0]

        # Trigger, record
        # <start> has a child <triggerType>
        child = get_by_tag(start, 'triggerType')
        if len(child) > 0:
            flow_type = FlowType.RecordTrigger

        elif len(get_by_tag(start, 'schedule')) > 0:
            flow_type = FlowType.Scheduled

        else:
            # We couldn't determine flow type by looking at
            # <start> elem, so now look at processType elem
            pt = get_by_tag(self.root, 'processType')
            if len(pt) > 0:
                pt = pt[0].text

                # Screen
                # <processType>Flow and start does not have trigger or schedule
                if pt == 'Flow' or len(get_by_tag(self.root, 'screens')) > 0:
                    flow_type = FlowType.Screen

                elif pt.lower() == 'workflow':
                    flow_type = FlowType.Workflow

                elif pt.lower() == 'invocableprocess':
                    flow_type = FlowType.InvocableProcess

                # AutoLaunched
                # Some teams have their own names, e.g. FooAutolaunchedFlow
                # Notice this messes up capitalization from normal 'AutoLaunchedFlow'
                # there are also recommendation strategies, etc.
                else:
                    flow_type = FlowType.AutoLaunched

            elif self.flow_path.endswith(".flow"):
                flow_type = FlowType.AutoLaunched

        if flow_type is not None:
            self.flow_type = flow_type
            return flow_type
        else:
            raise RuntimeError(f"Could not determine flow type for {self.flow_path}")

    def resolve_by_name(self, name: str, path: str | None = None,
                        strict: bool = False) -> Optional[(str, str, VariableType)]:
        """Resolves name to variable, property, VariableType.

        Examples::

            "Account_var.Name" --> ("Account_var", "Name", VariableType)
            "account_var" --> (account_var, None, VariableType).
            (my_subflow.account.Name) --> (my_subflow.account, Name, VariableType)
            (my_action_call.account) --> (my_action_call.account, None, VariableType)

        Args:
            name: raw name as it is used in the flow xml file (e.g. foo.bar.baz)
            path: filename in which to resolve
            strict: whether to fail hard or guess

        Returns:
            ``None`` if the name cannot be resolved,
            else the triple (parent name, member, type)

        """
        if path is None:
            path = self.flow_path
        # do this first, as this method will be called all the time.
        # Look in cache of already resolved names, plus string literals and globals are handled here
        res = self.__get_type(path=path, name=name)
        if res is not None:
            # the variable is already in our map
            return name, None, res

        # second cache, contains properties already seen as well as names of flow elements
        seen = dict.get(self.__seen_resolutions, (path, name))
        if seen is not None:
            return seen

        # now do more complex logic
        splits = name.split('.')
        spl_len = len(splits)
        # we've already checked for the name directly
        if spl_len == 1:
            logger.warning(f"RESOLUTION ERROR {name}")
            if strict is False:
                # 'strict' = False means that any unknown variable name
                # is assumed to be a string literal that is hardcoded into
                # the flows runtime and so not declared in flow xml file
                return name, None, self.literal_var
            else:
                return None

        for i in range(1, spl_len):
            # as index goes up, we get less specific. But no need to check the whole name,
            # so start at -1 go to -len(splits)+1, e.g. -range(1, len(splits)).
            # This means we check splits[0] last
            tst = '.'.join(splits[0:-i])
            var_type = self.__get_type(name=tst, path=path, strict=strict)

            if var_type is not None:
                # check if this is an automatic storage reference
                # e.g. my_recordLookup.output or my_subflow.output
                # if it is, we treat the variable name as elem.name
                #
                #
                # NOTE: there are a number of ways to do this, all with downsides
                # but we choose to look for anything other than a direct reference as indirect
                if i == 1 and (var_type.reference is not ReferenceType.CollectionReference) and (
                        var_type.reference is not ReferenceType.Direct):
                    # We have an indirect reference, e.g. subflow.foo or subflow.foo.bar
                    # add this to the cache of parsed variables
                    ref_name = tst + '.' + splits[1]
                    self.__seen_parents[(path, ref_name)] = var_type  # TODO: try to get more precise type

                    if spl_len == 2:
                        # while we could just continue, we can handle this now directly to save lookup
                        to_return = (ref_name, None, var_type)

                    else:
                        # We have subflow.foo.bar..
                        to_return = (ref_name, name[len(tst) + 1:], var_type)

                    # add this resolution to the cache
                    self.__seen_resolutions[(path, name)] = to_return
                    return to_return

                # name is foo.bar.baz so if foo.bar is best (most specific) match,
                # we need to skip the period to get baz

                to_return = (tst, name[len(tst) + 1:], var_type)

                # add to cache of resolutions, so we don't need to go through this again
                self.__seen_resolutions[(path, name)] = to_return

                # return
                return to_return

        return None

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
        self.all_named_elems = all_named
        self.all_names = all_names
        self.__seen_parents = vars_
        self.input_variables = inputs
        self.output_variables = outputs
        self.get_flow_type()  # will populate flow type
        self.declared_run_mode = self.get_run_mode()

        if old_parser is None:
            self.effective_run_mode = self.declared_run_mode

        else:
            if is_return is False:
                # if returning from a function call, don't inherit sharing from the child!
                self.effective_run_mode = util.get_effective_run_mode(
                    parent_sharing=old_parser.get_effective_run_mode(),
                    current_sharing=self.declared_run_mode
                )

            # we always update parsed variables, so we have full resolutions available
            self.__seen_parents.update(old_parser.__seen_parents)

        return self

    def get_output_variables(self, path: str | None = None) -> {(str, str)}:
        if path is None:
            path = self.flow_path
        return {(x, y) for (x, y) in self.output_variables if x == path}

    def get_input_variables(self, path: str | None = None) -> {(str, str)}:
        if path is None:
            path = self.flow_path
        return {(x, y) for (x, y) in self.input_variables if x == path}

    def get_input_field_elems(self) -> set[ET.Element] | None:
        return parse_utils.get_input_fields(self.root)

    def get_input_output_elems(self) -> {str: set[ET.Element]}:
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
        return get_by_tag(self.root, 'label')[0].text

    def get_run_mode(self) -> RunMode:
        """Get effective context of flow

        Returns:
            RunMode public enum

        """
        flow_type = self.get_flow_type()

        if flow_type is FlowType.InvocableProcess:
            # always runs in user mode
            return RunMode.DefaultMode

        if flow_type in [FlowType.Workflow, FlowType.RecordTrigger, FlowType.Scheduled, FlowType.ProcessBuilder]:
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

    def get_all_traversable_flow_elements(self) -> [ET.Element]:
        """ ignore start"""
        return [child for child in self.root if
                get_tag(child) in parse_utils.CTRL_FLOW_ELEM]

    def get_all_variable_elems(self) -> [ET.Element] or None:
        elems = get_by_tag(self.root, 'variables')
        if len(elems) == 0:
            return None
        else:
            return elems

    def get_templates(self) -> [ET.Element]:
        """Grabs all template elements.
           Returns empty list if none found
        """
        templates = get_by_tag(self.root, 'textTemplates')
        return templates

    def get_formulas(self) -> [ET.Element]:
        """Grabs all formula elements.
                Returns empty list if none found
        """
        formulas = get_by_tag(self.root, 'formulas')
        return formulas

    def get_choices(self) -> [ET.Element]:
        choices = get_by_tag(self.root, 'choices')
        return choices

    def get_dynamic_choice_sets(self) -> [ET.Element]:
        dcc = get_by_tag(self.root, 'dynamicChoiceSets')
        return dcc

    def get_constants(self) -> [ET.Element]:
        constants = get_by_tag(self.root, 'constants')
        return constants

    def get_start_elem(self) -> ET.Element:
        """Get first element of flow

        Returns:
            <start> element or element pointed to in <startElementReference>

        """
        start_elements = parse_utils.START_ELEMS
        # These are used in obsolete flow versions that exist only in unit tests in core
        blacklisted_elements = parse_utils.BANNED_ELEMS

        blacklist_max = max([len(get_by_tag(self.root, x)) for x in blacklisted_elements])
        if blacklist_max > 0:
            msg = "Cannot process a flow with blacklisted elements, skipping flow"
            logger.warning(msg)
            raise InvalidFlowException(msg, flow=self.flow_path)

        else:
            start_res = {x: get_by_tag(self.root, x) for x in start_elements}

            for key in start_res:
                if len(start_res[key]) == 1:
                    return start_res[key][0]

            # no start element, so guess
            possible = self._guess_start_element()

            if possible is None:
                msg = "Cannot find start element for this flow, skipping flow."
                logger.warning(msg)
                raise InvalidFlowException(msg, flow=self.flow_path)
            else:
                return possible

    def _guess_start_element(self) -> ET.Element | None:
        """
        When the flow has no start or startElementReference we try to guess by looking for a
        traversable flow element that is not pointed to by a connector.

        Returns:
            Start Element or None if none can be found
        """
        traversables = self.get_all_traversable_flow_elements()
        if len(traversables) == 0:
            return None

        # Only one option and no connector can point to it
        if len(traversables) == 1:
            return traversables[0]

        traversable_map = {get_name(x): x for x in traversables}
        connector_names = set()
        for x in traversables:
            targets = get_conn_target_map(x)
            if targets is not None and len(targets) > 0:
                connector_names.update({x[0] for x in targets.values()})

        candidates = [traversable_map[x] for x in traversable_map if x not in connector_names]

        if len(candidates) == 1:
            return candidates[0]
        else:
            return None

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
                raise RuntimeError(f"could not find expression for {elem}")

        return accum

    def __get_type(self, name: str, path: str | None = None, strict: bool = False) -> VariableType | None:
        """Gets the VariableType for the named Flow Element

        Only looks in cache.

        Args:
            name: name of Flow Element to retrieve
            path: filename to use (if None, use current path)

        Returns:
            VariableType or None if not present in cache
        """
        if name == STRING_LITERAL_TOKEN:
            return self.literal_var

        if name == 'User':
            return self.literal_var

        if path is None:
            path = self.flow_path

        if (path, name) in self.__seen_parents:
            return self.__seen_parents[(path, name)]

        if name.startswith('$'):
            global_type = _resolve_globals(name)
            if global_type is not None:
                # add to cache
                self.__seen_parents[(path, name)] = global_type
                return global_type

        else:
            logger.info(f"Auto-resolving {name} in file {self.flow_path}")
            if strict is True:
                return self.literal_var
            else:
                return None


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
            is_ = parse_utils.is_auto_store(elem)
            if is_ is True:
                reference = ReferenceType.ActionCallReference
                # TODO: see if we can get datatype info from return value

                return VariableType(tag=tag, datatype=DataType.StringValue,
                                    reference=reference, is_optional=False)

        if tag == 'actions':
            pass

        if tag == 'apexPluginCalls':
            pass

        if tag == 'capabilityTypes':
            pass

        if tag == 'choices':
            # TODO: handle this better, now put in a stub
            datatype = parse_utils.get_datatype(elem)
            return VariableType(tag=tag, datatype=datatype)

        if tag == 'collectionProcessors':
            if elem.find(f'{ns}elementSubtype').text == 'FilterCollectionProcessor':
                # These always store automatically
                # TODO: Better type inferences needed. Defer this for now.
                return VariableType(tag=tag,
                                    reference=ReferenceType.CollectionReference,
                                    is_collection=True)

        if tag == 'constants':
            datatype = parse_utils.get_datatype(elem)
            return VariableType(tag=tag, datatype=datatype, reference=ReferenceType.Constant)

        if tag == 'customErrors':
            pass

        if tag == 'customProperties':
            pass

        if tag == 'dynamicChoiceSets':
            # These are effectively record lookups
            # TODO: handle this better, right now we just have a stub
            datatype = parse_utils.get_datatype(elem)
            obj_type = parse_utils.get_obj_name(elem)
            return VariableType(tag=tag, datatype=datatype, object_name=obj_type)

        if tag == 'fields':
            # TODO: support more vars as time allows. Screens have many possible components.
            # every field should have a field type
            # TODO: decide on nullable policy -- say declare nullable if no default?
            res = elem.find(f'{ns}fieldType').text
            if res == 'InputField':
                is_not_required = elem.find(f'{ns}isRequired').text == 'false'
                return VariableType(tag=tag, datatype=DataType.StringValue,
                                    reference=ReferenceType.ElementReference,
                                    is_collection=False,
                                    is_optional=is_not_required)
            else:
                # put in a stub
                # TODO: revisit this against corpus (e.g. componentInstance fields)
                return VariableType(tag=tag, datatype=DataType.StringValue,
                                    reference=ReferenceType.ElementReference,
                                    is_collection=False)

        if tag == 'formulas' or tag == 'textTemplates':
            return VariableType(tag=tag, datatype=DataType.StringValue,
                                reference=ReferenceType.Formula,
                                is_collection=False)

        if tag == 'inputs':
            pass

        if tag == 'loops':
            return VariableType(tag=tag,
                                reference=ReferenceType.CollectionReference,
                                is_optional=False, is_collection=True)

        if tag == 'orchestratedStages':
            pass

        if tag == 'outputAssignments':
            pass

        if tag == 'outputParameters':
            pass

        if tag == 'recordCreates':
            # Todo: get collection parsing correct, look if record being created is itself
            # a collection element - do examples of bulkified versions of commands.
            is_ = parse_utils.is_auto_store(elem)
            obj_ = parse_utils.get_obj_name(elem)
            if is_ is True and obj_ is not None:
                reference = ReferenceType.ElementReference
            else:
                reference = None
            return VariableType(tag=tag, datatype=DataType.StringValue,
                                reference=reference,
                                object_name=obj_, is_optional=False)

        if tag == 'recordDeletes':
            pass

        if tag == 'recordLookups':
            type_ = DataType.Object
            nulls_provided = parse_utils.is_assign_null(elem)
            is_ = not parse_utils.is_get_first_record_only(elem)
            if is_ is None:
                logger.warning("Error parsing recordLookups")
                return
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
                                    object_name=parse_utils.get_obj_name(elem),
                                    is_optional=nulls_provided is not None and nulls_provided is False)

        if tag == 'recordRollbacks':
            pass

        if tag == 'recordUpdates':
            pass

        if tag == 'stageSteps':
            # output as foo.Outputs.output_var_name
            pass

        if tag == 'stages':
            pass

        if tag == 'subflows':
            if parse_utils.is_auto_store(elem) is True:
                # todo: we need a None field for booleans we don't know
                return VariableType(tag=tag,
                                    reference=ReferenceType.SubflowReference)
            else:
                return VariableType(tag=tag)

        if tag == 'transforms':
            pass

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
            pass

        if tag == 'wait':
            pass


    except Exception as e:
        # Todo: create flow exception here
        logger.error(f"Error parsing variable element {e.args[0]}")

    return None


def _get_global_flow_data(flow_path, root: ET.Element) -> ([ET.Element], {str: VariableType}):
    all_named = get_named_elems(root)

    # all named cannot be None, each flow must have at least one named element.
    assert all_named is not None

    name_dict = {x: get_name(x) for x in all_named}
    all_names = tuple(name_dict.values())
    vars_ = {}
    inputs = []
    outputs = []

    for x in all_named:
        try:
            var = build_vartype_from_elem(x)
        except Exception:
            logger.error(f"ERROR parsing element {ET.tostring(x, encoding='unicode')}")
            continue
        if var is not None:
            vars_[(flow_path, name_dict[x])] = var

            if var.is_input is True:
                inputs.append((flow_path, name_dict[x]))

            if var.is_output is True:
                outputs.append((flow_path, name_dict[x]))

    return all_named, all_names, vars_, frozenset(inputs), frozenset(outputs)


def _resolve_globals(name: str):
    if not name.startswith("$"):
        return None
    # right now, we allow normal "." to proceed and just add all top level
    res = name.split(".")
    if len(res) == 1:
        if res is not None:
            var_type = VariableType(reference=ReferenceType.Global, tag=name)
            return var_type
    else:
        return None
