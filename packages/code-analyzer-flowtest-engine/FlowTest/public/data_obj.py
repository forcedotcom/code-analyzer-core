"""Definitions of data classes used for querying and reporting

"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from public.enums import DataType, ReferenceType, Severity


@dataclass(frozen=True, eq=True, slots=True)
class DataInfluenceStatement:
    """Represents a statement in which one variable influences
    another, usually as the result of an assignment,
    formula or template field, or builtin function.
    These statement are the basic building blocks of dataflows.
    """

    # Variable being influenced. This is not assumed to be resolved,
    # e.g. can be 'foo.bar', so we use "_var" to emphasize this
    # in the code. Queries and influence maps are performed against
    # the *name*, which would just be 'foo'.
    influenced_var: str

    # Variable doing the influencing. Not assumed to be resolved.
    # If this is a lexical query, you can omit the influencer
    influencer_var: str | None

    # (Top Level) Flow element containing the influence.
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

    def to_dict(self):
        return {s: getattr(self, s) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class VariableType:
    """This class contains type information for a variable"""

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


@dataclass(frozen=True, eq=True, slots=True)
class Preset:
    # Publicly displayed in report file.
    preset_name: str

    # Publicly displayed in report file - leave none if you do not want this
    preset_owner: str | None

    # The list of query names that are run. Not the list of queries which have findings,
    # as it's important [e.g. for the security review] to report when a query was run and had no findings.

    # specify which dataflow queries are run on each Flow Element
    # with enough information for users to understand the significance of not finding any issues
    # for that query
    queries: {QueryDescription}

    def to_dict(self):
        return {s: str(getattr(self, s)) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class QueryDescription:
    # this is the id that occurs in the preset and is not displayed to the user.
    query_id: str

    # This will be prominently displayed in the table of contents and as a heading
    # Must be unique for each preset. See default query for examples.
    query_name: str

    # see description of severity enum
    severity: Severity

    # This will appear at the beginning of the list of results, under the query name.
    # This must be plaintext (any markup will be encoded).
    # One or two sentences should be sufficient - provide links if more detailed discussions
    # are needed.
    query_description: str

    # Often developers will need assistance with secure patterns and remediation options, as
    # well as false positive diagnosis. If this material is available online in published
    # best practices (which it should be) then place a url link here. Optional.
    help_url: str | None = None

    # This will appear only in small xml/html fields
    query_version: str = "0"

    # Whether this query is for a security or code quality issue
    is_security: bool = True

    def to_dict(self):
        return {s: str(getattr(self, s)) for s in self.__slots__}


@dataclass(frozen=True, eq=True)
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
    # which query from the preset this is a result for
    query_id: str

    # Created by the QueryProcessor as a result of parsing the Flow Element
    influence_statement: DataInfluenceStatement

    # Provided by State
    # Only provide no paths if this is a lexical query or if the sink
    # and source are in the same (local) element
    paths: frozenset[DataInfluencePath] or None


@dataclass(frozen=True, eq=True, slots=True)
class DataInfluencePath:
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
    # tuple of DataInfluenceStatements. This is what is sent to the
    # results processor and displayed to end users.
    history: (DataInfluenceStatement,)

    # influenced name. (see 'property'). This is not the same
    # as the variable name in the DataInfluenceStatement
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
    influenced_type_info: VariableType

    def report_influence_tuples(self) -> list[(str, str)]:
        """Returns simple chain of variables for high level analysis

        Returns:
            list of (flow_filename, influenced_var_name)
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
        """Prints a short report of influence chain

        Args:
            arrows: whether the report should use '->' (True) or commas
                    (False) for statement separators
            filenames: whether the report should include filenames in the report

        Returns:
            string containing summary report.
        """
        if arrows is True:
            joiner = "->"
        else:
            joiner = ","

        if filenames is False:
            s = joiner.join([s[1] for s in self.report_influence_tuples()])
        else:
            s = joiner.join(f"{s[1]}(path:{s[0]})" for s in self.report_influence_tuples())
        return s

    @classmethod
    def combine(cls, start_flow: DataInfluencePath, end_flow: DataInfluencePath,
                cross_flow: bool = False,
                type_override: VariableType | None = None) -> DataInfluencePath:
        """Combine two paths

        Args:
            start_flow: the new path starts with this influencer
            end_flow: the new path ends with this flow's influenced
            cross_flow: whether the end dataflow is in a different flow
            type_override: specify type directly, otherwise we keep the
                end_flow's type unchanged

        Returns:
            A influences C if start_flow is A influences B, and end_flow is B
            influences C

        Raises:
            ValueError if the influencers don't match up and crossflow is False as cross-flow
            dataflows will have different names and filenames.
        """

        if cross_flow is False:
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
        return DataInfluencePath(history=new_history,
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
    current_label: str
    previous_label: str | None
    token: str | None = None
    history: ((str, str),) = field(default_factory=tuple)

    def to_dict(self):
        return {s: str(getattr(self, s)) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class CrawlStep:
    step: int
    visitor: BranchVisitor
    element_name: str

    def to_dict(self):
        return {s: getattr(self, s) for s in self.__slots__}


class InfluenceStatementEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, DataInfluenceStatement):
            return obj.to_dict()
        else:
            return json.JSONEncoder.default(self, obj)


class PresetEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Preset) or isinstance(obj, QueryDescription):
            return obj.to_dict()
        else:
            return json.JSONEncoder.default(self, obj)


def _get_end_vars(df: DataInfluencePath) -> (str, str):
    return (_recover_var(df.influencer_name, df.influencer_property),
            _recover_var(df.influenced_name, df.influenced_property))


def _recover_var(name, prop) -> (str, str):
    if prop is None:
        return name
    else:
        return f"{name}.{prop}"
