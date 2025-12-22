"""Definitions of data classes used for querying and reporting.

This module contains the core data structures used throughout the flow scanner
for representing query results, influence paths, and flow metadata.
"""

from __future__ import annotations

import json
from abc import ABC
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import public.enums
from public.custom_parser import clean_string

if TYPE_CHECKING:
    from public.enums import DataType, ReferenceType, Severity, ConnType

@dataclass(frozen=True)
class JSONSerializable(ABC):
    """Abstract base class for objects that can be serialized to JSON.

    Provides a default implementation of to_dict() that converts all
    slot attributes to a dictionary.
    """

    def to_dict(self) -> dict:
        """Convert the object to a dictionary representation.

        Returns:
            Dictionary mapping slot attribute names to their values.
        """
        return {s: getattr(self, s) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class InfluenceStatement:
    """Represents a statement in which one variable influences another.

    Influence statements are usually the result of an assignment, formula,
    template field, or builtin function. These statements are the basic
    building blocks of dataflows.
    """

    # Variable being influenced.
    #
    # If a variable, then
    # this is not assumed to be resolved,
    # e.g. can be 'foo.bar', so we use "_var" to emphasize this
    # in the code. Queries and influence maps are performed against
    # the *name*, which would just be 'foo'.
    # If an element (for control influence)
    # then this is the element name (not type).
    influenced_var: str

    # Variable or element doing the influencing. Not assumed to be resolved.
    # If this is a lexical query, you can omit the influencer
    # If this is a control influence, use the element name or variable name
    # being controlled.
    influencer_var: str | None

    # (Top Level) Flow element containing the influence.
    # For control influence of one element influencing another,
    # this would be the element containing
    # the connector that points to the controlled element.
    #
    # For control influence of one variable control influencing the
    # value of another, then this would be the element in which the control
    # is defined.
    #
    # Note this may be a huge element, so we want
    # more specific information later
    element_name: str

    # Human-readable comment explaining the influence (for reporting and debugging)
    comment: str

    # filepath of element where influence transmission
    # occurs (for subflow/cross flow support) and reporting
    flow_path: str

    # source code line number where influence happens (for reporting).
    # Do not use the sourceline of the flow element unless you are
    # unable to get specific information
    line_no: int

    # string of xml element where influence transmission occurs (for reporting) and
    # not the string of the entire flow element. Include appropriate context for
    # readability while maintaining conciseness as large snippets of xml are painful.
    source_text: str

    # path of source_text element, which is just flow_path except for transmission
    # elements such as subflows, action calls, etc
    source_path: str

    def to_dict(self) -> dict:
        """Convert the influence statement to a dictionary.

        Returns:
            Dictionary representation with all string values cleaned.
        """
        return {s: clean_string(getattr(self, s)) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class VariableType:
    """Contains type information for a variable.

    Tracks metadata about variable types including data type, reference type,
    collection status, and object/field information.
    """

    # the tag (type of this object in metadata spec)
    tag: str

    # Is this a string, object, literal. Do not
    # assign unknown types, only assign if certain,
    # and leave None if uncertain
    datatype: DataType | None = None

    # is this an element a variable or a reference to another element
    reference: ReferenceType | None = None

    # Whether this is of type collection (does not matter if it has only a single elem)
    # None if unknown
    is_collection: bool | None = None

    # can this element be uninitialized. None if unknown.
    # Set as none for container objects, set False if there
    # is default assigned. TODO: determine behavior for record
    #  lookups other CRUD objects
    is_optional: bool | None = None

    # the type of SObject, e.g. Account. Set to None
    # if not known.
    object_name: str | None = None

    field_name: str | None = None

    # Whether this object has been restricted to a set
    # of properties, and if so, which ones? Set to None
    # if unknown
    properties: set[str] | None = None

    # is this variable marked available for input
    is_input: bool | None = None

    # is this variable available for output
    is_output: bool | None = None

    # overrides usual match on element name
    match_override: str | None = None


@dataclass(frozen=True, eq=True, slots=True)
class Preset:
    """Represents a preset collection of queries to run.

    Presets define which queries are executed during a scan. It's important
    to report when a query was run and had no findings (e.g., for security reviews),
    not just queries that found issues.

    Attributes:
        preset_name: Publicly displayed name in report file.
        preset_owner: Publicly displayed owner in report file. None if not specified.
        queries: Set of QueryDescription objects specifying which queries to run.
    """

    preset_name: str
    preset_owner: str | None
    queries: set[QueryDescription]

    def to_dict(self) -> dict:
        """Convert the preset to a dictionary.

        Returns:
            Dictionary representation of the preset.
        """
        return {s: str(getattr(self, s)) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class QueryDescription:
    """Metadata describing a query for reporting purposes.

    Attributes:
        query_id: Internal ID used in presets, not displayed to users.
        query_name: Prominently displayed name in table of contents and headings.
            Must be unique for each preset.
        severity: Severity level of issues found by this query.
        query_description: Plaintext description appearing at the beginning of
            results. One or two sentences recommended. Markup will be encoded.
        help_url: Optional URL to documentation for secure patterns, remediation,
            and false positive diagnosis.
        query_version: Version string appearing in XML/HTML fields. Defaults to "0".
        is_security: Whether this query detects security issues (True) or
            code quality issues (False). Defaults to True.
    """

    query_id: str
    query_name: str
    severity: Severity
    query_description: str
    help_url: str | None = None
    query_version: str = "0"
    is_security: bool = True

    def to_dict(self) -> dict:
        """Convert the query description to a dictionary.

        Returns:
            Dictionary representation of the query description.
        """
        return {s: str(getattr(self, s)) for s in self.__slots__}


@dataclass(frozen=True, slots=True, eq=True)
class QueryResult:
    """The QueryProcessor performs only local analysis, for example searching
       for whether variables *within* a given Flow Element are assigned to a
       dangerous sink -- for example a filter used to determine which objects
       should be deleted. Therefore, the execution of a query consists of
       two steps:

            - Investigate the flow element to determine dangerous influence statements.
            - Decide whether the influencing variable is user controlled.

       The second step is global analysis and is performed by querying BranchState,
       with the variable name of interest. Branch state will return all
       tainted dataflows to this variable.

       The query module will then pass the influence statement together with
       the returned dataflows to the result module. Therefore, the result
       passed is a pair of objects: a data influence statement and a list of flows.

       """
    # which query this is a result for
    query_id: str

    # Type of flow (screen, trigger, etc) this result applies to.
    # Flow type is carried from parent to child, so if a screen flow
    # calls an auto-launched flow, issues found in the subflow will still
    # inherit a flow_type of screen flow. This simplifies auditing and interpretation
    # of results.
    flow_type: public.enums.FlowType

    # Created by the QueryProcessor as a result of parsing the Flow Element.
    # Is intended to be the final passage into the sink.
    # the destination is the sink, and the sink's source code
    # is presented.
    influence_statement: InfluenceStatement | None = None

    # Provided by State
    # Only provide no paths if this is a lexical query or if the sink
    # and source are in the same (local) element
    paths: frozenset[InfluencePath] | None = None

    #
    #
    # The following fields are only needed when there is no
    # influence statement
    elem_code: str | None = None

    elem_line_no: int | None = None

    # name of element (top level)
    elem_name: str | None = None

    # name of field, within element (optional)
    field: str | None = None

    # filename (required only for lexical)
    filename: str | None = None


@dataclass(frozen=True, eq=True, slots=True)
class InfluencePath:
    """Represents a data influence between two *named* elements,
    with a history of influence statements explaining the influence.

    The chains of influence statements::

        A.foo -> B.bar in element foo
        B -> C in element bar

    are stored for reporting.

    Data Influence Paths are immutable. When flow propagation occurs,
    new paths are created and old paths kept until the variable is reassigned.

    This is accomplished by maintaining an influence_map::
      (flow_path, elem_name) -> set(DataInfluencePaths)

    that tracks all influencers. If a combination of values influences
    a variable, we *copy* paths for these values, append them, and assign
    them to the influencer. So the usual operations are copy flow + extend.
    When assignment happens, we change which flows a given variable points
    to, and let python garbage collection delete flows when no variable
    points to them.

    When symbolic execution exits a subflow,
    all paths that do not influence a return value are
    dropped.

    **Caution**: Only instantiate with provided class method
    builders to ensure data consistency.
    TODO: add support for labels.
    """
    # tuple of InfluenceStatements. This is what is sent to the
    # results processor and displayed to end users.
    history: tuple[InfluenceStatement, ...]

    # influenced name. (see 'property'). This is not the same
    # as the variable name in the InfluenceStatement.
    #
    # This could be the name of an element (for control)
    # or the name of a variable (for data or control). In the case
    # of a variable, do not include the property
    influenced_name: str

    # If the influence path influences a specific property
    # of an object, say my_string -> Account.Name,
    # then the influenced  name is `Account` and the property name is listed here.
    #
    # If this is a string or the influence is at the
    # object level, (Variable -> Account), then set
    # the field to None
    influenced_property: str | None

    # influencer name, not the same as the influence_var in the DataInfluenceStatement
    influencer_name: str

    # If the influence path influences originates,
    # from the specific property of an object,
    # say Account.Name --> my_string,
    # then the influencer name is `Account` and the
    # property name is listed here.
    #
    # If this is a string or the influence
    # describes the whole object (Account -> Z_variable)
    # then set the field to None
    influencer_property: str | None

    # influencer filepath (identifies flow)
    influenced_filepath: str

    # influenced filepath (identifies flow)
    influencer_filepath: str

    # type info about the influenced element
    influenced_type_info: VariableType | None

    def report_influence_tuples(self) -> list[tuple[str, str]]:
        """Get a simple chain of variables for high-level analysis.

        Returns:
            List of (flow_filename, influenced_var_name) tuples representing
            the influence chain.
        """
        (df_start, df_end) = _get_end_vars(self)

        start_name = self.history[0].influencer_var
        end_name = self.history[-1].influenced_var

        if df_start != self.history[0].influencer_var and self.history[0].influencer_var == self.influencer_name:
            start_name = df_start + "*"

        if df_end != self.history[-1].influenced_var and self.history[-1].influenced_var == self.influenced_name:
            end_name = df_end + "*"

        start = [(self.influencer_filepath, start_name)]
        for x in self.history[:-1]:
            start.append((x.flow_path, x.influenced_var))

        start.append((self.influenced_filepath, end_name))
        return start

    def short_report(self, arrows: bool = False, filenames: bool = False) -> str:
        """Generate a short text report of the influence chain.

        Args:
            arrows: Whether to use '->' (True) or commas (False) for separators.
            filenames: Whether to include filenames in the report.

        Returns:
            String containing a summary report of the influence chain.
        """
        if arrows:
            joiner = "->"
        else:
            joiner = ","

        if not filenames:
            s = joiner.join([s[1] for s in self.report_influence_tuples()])
        else:
            s = joiner.join(f"{s[1]}(path:{s[0]})" for s in self.report_influence_tuples())
        return s

    @classmethod
    def combine(cls, start_flow: InfluencePath, end_flow: InfluencePath,
                cross_flow: bool = False,
                type_override: VariableType | None = None) -> InfluencePath:
        """Combine two influence paths into a single path.

        Creates a new path where A influences C if start_flow is "A influences B"
        and end_flow is "B influences C".

        Args:
            start_flow: Path that provides the starting influencer.
            end_flow: Path that provides the ending influenced variable.
            cross_flow: Whether the end dataflow is in a different flow.
            type_override: Optional type to use for the combined path.
                If None, uses the end_flow's type.

        Returns:
            New InfluencePath combining both input paths.

        Raises:
            ValueError: If the influencers don't match up and cross_flow is False.
                Cross-flow dataflows will have different names and filenames.
        """

        if not cross_flow:
            if start_flow.influenced_name != end_flow.influencer_name:
                raise ValueError("Attempting to append an incompatible dataflow."
                                 f"statement influencer: {end_flow.influencer_name} "
                                 f"does not match {start_flow.influenced_name}")

            if start_flow.influenced_filepath != end_flow.influencer_filepath:
                raise ValueError("This method cannot be used to combine paths from different flows.")
        else:
            # across a flow, there may be different names and paths, so ignore both checks
            pass

        new_history = start_flow.history + end_flow.history
        return InfluencePath(history=new_history,
                             influencer_name=start_flow.influencer_name,
                             influenced_name=end_flow.influenced_name,
                             influencer_filepath=start_flow.influencer_filepath,
                             influenced_filepath=end_flow.influenced_filepath,
                             influenced_type_info=type_override or end_flow.influenced_type_info,
                             influenced_property=end_flow.influenced_property,
                             influencer_property=start_flow.influencer_property
                             )


@dataclass(frozen=True, eq=True, slots=True)
class BranchVisitor:
    """Tracks state during control flow graph traversal.

    Attributes:
        current_label: Current segment label being visited.
        previous_label: Previous segment label, or None if at start.
        loop_context: Tuple of (label, ConnType) pairs for loop context.
        history: Previously visited segment labels in order.
        token: List of (previous_label, current_label) tuples when visitor
            was spawned, or None.
    """

    current_label: str
    previous_label: str | None
    loop_context: tuple[tuple[str, ConnType], ...] = field(default_factory=tuple)
    history: tuple[str, ...] = field(default_factory=tuple)
    token: tuple[tuple[str, str], ...] | None = None

    def to_dict(self) -> dict:
        """Convert the branch visitor to a dictionary.

        Returns:
            Dictionary representation of the branch visitor.
        """
        return {s: str(getattr(self, s)) for s in self.__slots__}

@dataclass(frozen=True, eq=True, slots=True)
class CrawlStep:
    """Represents a single step in the flow crawl process.

    Attributes:
        step: Step number in the crawl sequence.
        visitor: BranchVisitor tracking traversal state.
        element_name: Name of the flow element.
        element_tag: XML tag of the flow element.
        local_index: Position within the current segment. Defaults to 0.
    """

    step: int
    visitor: BranchVisitor
    element_name: str
    element_tag: str
    local_index: int = 0

    def to_dict(self) -> dict:
        """Convert the crawl step to a dictionary.

        Returns:
            Dictionary representation of the crawl step.
        """
        return {s: getattr(self, s) for s in self.__slots__}

@dataclass(frozen=True, eq=True, slots=True)
class Jump(JSONSerializable):
    """Represents a connector (jump) in the control flow graph.

    Attributes:
        src_name: Name of the element where the jump is located.
        target: Name of the element the connector points to.
        is_goto: True if this is a goto connector.
        is_loop: True if this is a next-value (loop) connector.
        is_no_more_values: True if this is a no-more-values connector.
        is_fault: True if this is a fault connector.
    """

    src_name: str
    target: str
    is_goto: bool
    is_loop: bool
    is_no_more_values: bool
    is_fault: bool

    def priority(self) -> int:
        """Get the priority of this jump for traversal.

        Lower numbers indicate higher priority.

        Returns:
            Priority value (0 for loops, 1 for others).
        """
        if self.is_loop:
            return 0
        else:
            return 1


class InfluenceStatementEncoder(json.JSONEncoder):
    """JSON encoder for InfluenceStatement objects.

    For public display, replaces flow_path with source_path to correctly
    display transmission elements.
    """

    def default(self, obj):
        """Encode an object to JSON.

        Args:
            obj: Object to encode.

        Returns:
            Dictionary representation for InfluenceStatement objects,
            otherwise falls back to default JSON encoding.
        """
        if isinstance(obj, InfluenceStatement):
            raw_dict = obj.to_dict()
            # For public display, we replace flow_path with source_path
            # to correctly display transmission elements
            cleaned_dict = {s: raw_dict[s] for s in raw_dict.keys() if (
                            s != 'flow_path' and s != 'source_path')}
            cleaned_dict['flow_path'] = raw_dict['source_path']

            return cleaned_dict
        else:
            return json.JSONEncoder.default(self, obj)


class PresetEncoder(json.JSONEncoder):
    """JSON encoder for Preset and QueryDescription objects."""

    def default(self, obj):
        """Encode an object to JSON.

        Args:
            obj: Object to encode.

        Returns:
            Dictionary representation for Preset/QueryDescription objects,
            otherwise falls back to default JSON encoding.
        """
        if isinstance(obj, Preset) or isinstance(obj, QueryDescription):
            return obj.to_dict()
        else:
            return json.JSONEncoder.default(self, obj)


def _get_end_vars(df: InfluencePath) -> tuple[str, str]:
    """Get the start and end variable names from an influence path.

    Args:
        df: InfluencePath to extract variables from.

    Returns:
        Tuple of (influencer_var, influenced_var) with property names included.
    """
    return (_recover_var(df.influencer_name, df.influencer_property),
            _recover_var(df.influenced_name, df.influenced_property))


def _recover_var(name: str, prop: str | None) -> str:
    """Recover a full variable name from name and optional property.

    Args:
        name: Base variable name.
        prop: Optional property name.

    Returns:
        Full variable name (e.g., "Account.Name" if prop is "Name").
    """
    if prop is None:
        return name
    else:
        return f"{name}.{prop}"
