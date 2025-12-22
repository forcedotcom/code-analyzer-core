"""Interface definitions for custom queries

    Caution:: If building a custom query, only develop against the ref:mod:`public` module
    otherwise the custom query code will break on upgrades.

"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Optional

import public.enums
from public import parse_utils

if TYPE_CHECKING:
    from public.data_obj import InfluencePath, VariableType, CrawlStep, Jump
    import xml.etree.ElementTree as ET

from public.enums import RunMode, QueryAction

# and import other types as needed to process queries
from public.data_obj import QueryResult, Preset, QueryDescription, InfluencePath

from typing import TypeAlias

var_t: TypeAlias = tuple[str, str]
El: TypeAlias = parse_utils.CP.ET.Element
"""
To generate custom queries, implement the QueryPresets class
and for each query listed in the preset, implement
a Query class for that query. Then specify 
the import path of the custom queries when invoking the script,
or programmatically import if invoking as a module.
"""

class AbstractCrawler(ABC):
    """Abstract base class for flow crawlers.

    Crawlers are responsible for traversing flow elements and managing
    the crawl state during flow execution.
    """

    @abstractmethod
    def get_crawl_schedule(self) -> tuple[CrawlStep]:
        """Get the crawl schedule for this crawler.

        Returns:
            Tuple of CrawlStep instances representing the crawl schedule.
        """
        pass

    @abstractmethod
    def get_flow_path(self) -> str | None:
        """Get the path to the flow file being crawled.

        Returns:
            Path to the flow file, or None if not available.
        """
        pass

    @abstractmethod
    def get_subflow_parents(self) -> list[tuple[ET.Element, str]]:
        """Get the history of parent subflow/action elements.

        .. warning::
            READ ONLY. Do not perform any crawlstep loads with these crawlers!

        Returns:
            List of tuples containing (element, flow_path) for ancestors of the
            current crawler. The frame that spawned the current frame is at
            index 0, and the very first frame is at the last index.
            Example: current_frame <-- [(elem0, path0), (elem1, path1), ...]
        """
        pass

    @abstractmethod
    def get_cfg(self) -> AbstractControlFlowGraph:
        """Get the control flow graph for the current flow.

        Returns:
            The AbstractControlFlowGraph instance for this flow.
        """
        pass

    @abstractmethod
    def get_current_step_index(self) -> int:
        """Get the index of the current crawl step.

        Returns:
            Integer index of the current step in the crawl schedule.
        """
        pass


    @abstractmethod
    def load_crawl_step(self) -> CrawlStep | None:
        """Load the next crawl step.

        Returns:
            The next CrawlStep instance, or None if no more steps available.
        """
        pass

    @abstractmethod
    def get_last_ancestor(self, crawl_step: CrawlStep) -> CrawlStep | None:
        """Get the latest ancestor branch that was last visited at the given step.

        Useful for knowing which influence map to clone.

        Args:
            crawl_step: Step whose history is sought.

        Returns:
            CrawlStep instance of the last ancestor, or None if not found.
        """
        pass

    @abstractmethod
    def get_elem_to_crawl_step(self, elem_name: str) -> list[CrawlStep]:
        """Get all crawl steps in which an element has been visited.

        Args:
            elem_name: Element name (use '*' for the start element).

        Returns:
            List of CrawlStep instances that visit this element.
            Returns empty list if the element has not been visited.
        """
        pass

    @abstractmethod
    def get_crawlable_elem_tuples(self) -> list[tuple[str, str]] | None:
        """Get all traversable element name and tag tuples.

        Returns:
            List of (element_name, tag) tuples that are connected to the
            start element, or None if none found.
        """
        pass

    @abstractmethod
    def get_call_chain(self, source_el: ET.Element,
                       source_path: str,
                       sink_el: ET.Element,
                       source_parser: FlowParser) -> list[tuple[ET.Element, str]] | None:
        """Get the call chain from source to sink element.

        The sink element must be in the current flow. The source element can
        be in an ancestor flow. Only returns paths currently crawled, so this
        must be called every time a specific frame is loaded.

        Args:
            source_el: Source element in the call chain.
            source_path: Path to the flow containing the source element.
            sink_el: Sink element in the current flow.
            source_parser: Parser for the source flow path.

        Returns:
            List of (element, element_flow_path) tuples starting with the
            source and ending with the sink, where each element is an ancestor
            caller of the succeeding element. Returns None if no chain found.
        """
        pass


class AbstractControlFlowGraph(ABC):
    """Abstract base class for control flow graphs.

    Represents the control flow structure of a flow, including segments
    and jumps between them.
    """

    @property
    @abstractmethod
    def start_label(self) -> str:
        """Get the label of the starting segment.

        Returns:
            Label string of the starting segment.
        """
        pass

    @property
    @abstractmethod
    def inbound(self) -> dict[str, list[Jump]]:
        """Get the map from segment label to inbound jumps.

        Returns:
            Dictionary mapping segment labels to lists of inbound Jump objects.
        """
        pass

    @property
    @abstractmethod
    def segment_map(self) -> dict[str, AbstractSegment]:
        """Get the map of all segments in the control flow graph.

        Returns:
            Dictionary mapping segment labels to AbstractSegment instances.
        """
        pass


class AbstractSegment(ABC):
    """Abstract base class for control flow graph segments.

    A segment represents a linear sequence of flow elements between
    control flow jumps.
    """

    @property
    @abstractmethod
    def label(self) -> str:
        """Get the label of the element at the start of the segment.

        This is the jump target for this segment.

        Returns:
            Label string of the starting element.
        """
        pass

    @property
    @abstractmethod
    def traversed(self) -> list[tuple[str, str]]:
        """Get the list of elements traversed in this segment.

        Returns:
            List of (element_name, element_tag) tuples in traversal order,
            including the label element.
        """
        pass

    @property
    @abstractmethod
    def subflows(self) -> list[int]:
        """Get the traversal indexes that are subflow elements.

        Returns:
            List of integer indexes into the traversed list that correspond
            to subflow elements.
        """
        pass

    @property
    @abstractmethod
    def jumps(self) -> list[Jump]:
        """Get the list of jumps from this segment.

        Returns:
            List of Jump objects representing control flow transitions.
        """
        pass

    @property
    @abstractmethod
    def is_terminal(self) -> bool:
        """Check if this segment may end execution.

        Returns:
            True if this segment may terminate flow execution, False otherwise.
        """
        pass

    @property
    @abstractmethod
    def seen_tokens(self) -> list[tuple[tuple[str], ...]]:
        """Get tokens for tracking whether this segment has been visited.

        Returns:
            List of token tuples used for visit tracking.
        """
        pass

class AbstractQuery(ABC):
    """
    Class representing a standalone query.

    Standalone queries are stateless, so there is no need to reload
    after passing to a new flow.

    Standalone queries can only be invoked on a single query action
    """

    @classmethod
    def accept(cls, **kwargs) -> list[QueryResult] | None:
        """Accept and report issues discovered in-line during flow processing.

        The accept method is designed for directly reporting issues discovered
        in-line during regular flow processing and not run as the result of
        running a query.

        For example, the executor needs to check if a subflow creates a circular
        reference in order to ensure that symbolic execution terminates, but
        the user may also be looking for this information as a query result.

        Therefore, we ensure that every query has an accept method that takes
        no action by default. Queries that need to handle in-line issues (e.g.,
        checking for subflow circular references) can override this method.

        The query manager ensures that only instantiated queries can have their
        accept method called.

        Args:
            **kwargs: Variable keyword arguments for issue-specific data.

        Returns:
            List of QueryResult instances if issues are found, None otherwise.
        """
        return None

    @classmethod
    @abstractmethod
    def get_query_description(cls) -> QueryDescription:
        """Get the description metadata for this query.

        Returns:
            QueryDescription instance containing query metadata.
        """
        pass

    @abstractmethod
    def when_to_run(self) -> list[QueryAction]:
        """Get the list of query actions that trigger this query.

        Returns:
            List of QueryAction enums indicating when this query should run.
        """
        pass

    @abstractmethod
    def execute(self) -> list[QueryResult] | None:
        """Execute the query and return results.

        Returns:
            List of QueryResult instances if issues are found, None otherwise.
        """
        pass


class Query(AbstractQuery, ABC):
    """Base class for stateful queries that operate during flow execution.

    Stateful queries can access the current execution state, crawler,
    and all states during flow processing.
    """

    @classmethod
    @abstractmethod
    def get_query_description(cls) -> QueryDescription:
        """Get the description metadata for this query.

        Returns:
            QueryDescription instance containing query metadata.
        """
        pass

    @abstractmethod
    def when_to_run(self) -> list[QueryAction]:
        """Get the list of query actions that trigger this query.

        Returns:
            List of QueryAction enums indicating when this query should run.
        """
        pass

    @abstractmethod
    def execute(self,
                state: State = None,
                crawler: AbstractCrawler = None,
                all_states: list[State] | None = None) -> list[QueryResult] | None:
        """Execute the query with access to execution state.

        Args:
            state: Current execution state (contains the flow_path variable).
            crawler: Current crawler instance for flow traversal.
            all_states: List of all execution states if available.

        Returns:
            List of QueryResult instances if issues are found, None otherwise.
        """
        pass



class LexicalQuery(AbstractQuery, ABC):
    """Base class for lexical queries that operate on flow structure.

    Lexical queries analyze the static structure of flows without requiring
    execution state or crawling.
    """

    @abstractmethod
    def get_query_description(self) -> QueryDescription:
        """Get the description metadata for this query.

        Returns:
            QueryDescription instance containing query metadata.
        """
        pass

    @abstractmethod
    def when_to_run(self) -> list[QueryAction]:
        """Get the list of query actions that trigger this query.

        Returns:
            List of QueryAction enums indicating when this query should run.
        """
        pass

    @abstractmethod
    def execute(self,
                parser: FlowParser = None,
                **kwargs) -> list[QueryResult] | None:
        """Execute the lexical query on the flow parser.

        Args:
            parser: FlowParser instance for the flow being analyzed.
            **kwargs: Additional keyword arguments for query-specific data.

        Returns:
            List of QueryResult instances if issues are found, None otherwise.
        """
        pass




class AbstractFlowVector(ABC):
    """Abstract base class for flow vectors tracking data influence paths.

    Flow vectors track how data flows through flow elements via influence
    paths and property maps.
    """

    @property
    @abstractmethod
    def property_maps(self) -> dict[InfluencePath, dict[str, set[InfluencePath]]]:
        """Get the property maps for this flow vector.

        Returns:
            Dictionary mapping InfluencePath to property name to set of
            InfluencePath instances.
        """
        pass

    @classmethod
    @abstractmethod
    def from_flows(cls, default: set[InfluencePath] = None) -> AbstractFlowVector:
        """Create a flow vector from a set of influence paths.

        Args:
            default: Optional set of InfluencePath instances to initialize
                the vector with.

        Returns:
            New AbstractFlowVector instance.
        """
        pass

    @abstractmethod
    def get_flows_by_prop(self, member_name: str | None = None) -> set[InfluencePath]:
        """Get all influence paths for a specific property.

        Args:
            member_name: Name of the property to get flows for.
                If None, returns all flows.

        Returns:
            Set of InfluencePath instances for the specified property.
        """
        pass

    @abstractmethod
    def add_vector(self, vector: AbstractFlowVector) -> AbstractFlowVector:
        """Add another flow vector to this one.

        Args:
            vector: Flow vector to add to this one.

        Returns:
            New AbstractFlowVector instance with combined flows.
        """
        pass

    @abstractmethod
    def push_via_flow(self, extension_path: InfluencePath, influenced_vec: AbstractFlowVector,
                      assign: bool = True,
                      cross_flow: bool = False) -> AbstractFlowVector:
        """Push influence via a flow extension path.

        Args:
            extension_path: InfluencePath to extend through.
            influenced_vec: Flow vector being influenced.
            assign: Whether this is an assignment operation.
            cross_flow: Whether this crosses flow boundaries.

        Returns:
            New AbstractFlowVector instance with extended influence paths.
        """
        pass


class State(ABC):
    """Stores DataInfluencePaths in the current execution step.

    State objects track the current execution context including the current
    element, parser, and data influence information.
    """

    @abstractmethod
    def get_parser(self) -> FlowParser:
        """Get the flow parser for the current flow.

        Returns:
            FlowParser instance for the current flow.
        """
        pass

    @abstractmethod
    def get_current_elem(self) -> ET.Element:
        """Get the current flow element being executed.

        Returns:
            XML Element representing the current flow element.
        """
        pass

    @abstractmethod
    def get_current_elem_name(self) -> str:
        """Get the name of the current flow element.

        Returns:
            Name string of the current element.
        """
        pass

    @abstractmethod
    def get_flows_from_sources(self, influenced_var: str,
                               source_vars: set[tuple[str, str]],
                               restrict: str | None = None) -> set[InfluencePath] | None:
        """Get influence paths from source variables to an influenced variable.

        Args:
            influenced_var: Name of the variable being influenced.
            source_vars: Set of (filename, element_name) tuples for source variables.
            restrict: Optional restriction string to filter paths.

        Returns:
            Set of InfluencePath instances from sources to the influenced variable,
            or None if no paths found.
        """
        pass

    @abstractmethod
    def is_in_map(self, var_name: str) -> bool:
        """Check if a variable is in the influence map.

        Args:
            var_name: Name of the variable to check.

        Returns:
            True if the variable is in the map, False otherwise.
        """
        pass


class FlowParser(ABC):
    """Exposes global information about the current flow.

    FlowParser provides access to flow metadata, structure, and elements
    for analysis and query execution.
    """

    @abstractmethod
    def get_all_named_elems(self) -> frozenset[ET.Element] | None:
        """Get all named elements in the flow.

        Returns:
            Frozenset of all named XML elements, or None if none found.
        """
        pass

    @abstractmethod
    def get_all_names(self) -> tuple[str, ...] | None:
        """Get all element names in the flow.

        Returns:
            Tuple of all element name strings, or None if none found.
        """
        pass

    @abstractmethod
    def get_effective_run_mode(self) -> RunMode:
        """Get the effective run mode of the flow.

        Returns:
            RunMode enum value indicating how the flow actually runs.
        """
        pass

    @abstractmethod
    def get_declared_run_mode(self) -> RunMode:
        """Get the declared run mode of the flow.

        Returns:
            RunMode enum value as declared in the flow definition.
        """
        pass

    @abstractmethod
    def get_api_version(self) -> str:
        """Get the API version of the flow.

        Returns:
            API version string.
        """
        pass

    @abstractmethod
    def get_all_traversable_flow_elements(self) -> list[ET.Element]:
        """Get all traversable flow elements.

        Returns:
            List of XML elements that can be traversed during execution.
        """
        pass

    @abstractmethod
    def get_all_variable_elems(self) -> list[ET.Element] | None:
        """Get all variable elements in the flow.

        Returns:
            List of variable XML elements, or None if none found.
        """
        pass

    @abstractmethod
    def get_start_elem(self) -> ET.Element:
        """Get the starting element of the flow.

        Returns:
            XML Element representing the flow start element.
        """
        pass

    @abstractmethod
    def get_traversable_descendants_of_elem(self, elem_name: str) -> list[str]:
        """Get elements that are called (connected to) from the given element.

        Args:
            elem_name: Name of the element to get descendants for.

        Returns:
            List of element names that are descendants, including the
            original element name.
        """
        pass

    @abstractmethod
    def get_filename(self) -> str:
        """Get the filename of the flow.

        Returns:
            Filename string of the flow file.
        """
        pass

    @abstractmethod
    def get_flow_name(self) -> str:
        """Get the name of the flow.

        Returns:
            Flow name string.
        """
        pass

    @abstractmethod
    def get_flow_type(self) -> public.enums.FlowType:
        """Get the type of the flow.

        Returns:
            FlowType enum value.
        """
        pass

    @abstractmethod
    def get_trigger_object(self) -> str | None:
        """Get the trigger object for the flow.

        Returns:
            Trigger object name string, or None if not applicable.
        """
        pass

    @abstractmethod
    def get_trigger_type(self) -> public.enums.TriggerType:
        """Get the trigger type of the flow.

        Returns:
            TriggerType enum value.
        """
        pass

    @abstractmethod
    def get_root(self) -> ET.Element:
        """Get the root XML element of the flow.

        Returns:
            Root XML Element of the flow document.
        """
        pass

    @abstractmethod
    def get_literal_var(self) -> VariableType:
        """Get the literal variable type.

        Returns:
            VariableType instance for literals.
        """
        pass

    @abstractmethod
    def get_traversable_inbound(self) -> dict[str, list[str]]:
        """Get inbound connections for all traversable elements.

        Returns:
            Dictionary mapping element names to lists of inbound element names.
            Returns empty list for elements with no inbound connections.
        """
        pass

    @abstractmethod
    def get_action_call_map(self) -> dict[str, list[tuple[El, str]]] | None:
        """Get all action calls in the flow.

        Returns:
            Dictionary mapping action call types to lists of
            (element, action_name) tuples, or None if none found.
        """
        pass

    @abstractmethod
    def get_async_scheduled_paths(self) -> list[str]:
        """Get paths for asynchronously scheduled flows.

        Returns:
            List of flow paths that are scheduled asynchronously.
        """
        pass

    @abstractmethod
    def resolve_by_name(self, name: str, path: str | None = None) -> Optional[tuple[str, str, VariableType]]:
        """Resolve a variable or element by name.

        Args:
            name: Name of the variable or element to resolve.
            path: Optional path to scope the resolution.

        Returns:
            Tuple of (filename, element_name, VariableType) if found,
            None otherwise.
        """
        pass

    @abstractmethod
    def get_output_variables(self, path: str | None = None) -> set[tuple[str, str]]:
        """Get output variables for the flow.

        Args:
            path: Optional path to scope the search.

        Returns:
            Set of (filename, element_name) tuples for output variables.
        """
        pass

    @abstractmethod
    def get_input_variables(self, path: str | None = None) -> set[tuple[str, str]]:
        """Get flow variables available for input.

        Args:
            path: Optional path to scope the search.

        Returns:
            Set of (filename, element_name) tuples for all variables
            available for input, or None if none found.
        """
        pass

    @abstractmethod
    def get_input_field_elems(self) -> set[ET.Element] | None:
        """Get named XML elements that are children of Screen Flow Input Text Elements.

        .. note::
            Only returns variables from the current flow.

        Returns:
            Set of XML elements for input fields, or None if none present.
        """
        pass

    @abstractmethod
    def get_by_name(self, name_to_match: str, scope: ET.Element | None = None) -> ET.Element | None:
        """Get an element by name within an optional scope.

        Args:
            name_to_match: Name of the element to find.
            scope: Optional XML Element to scope the search within.

        Returns:
            XML Element if found, None otherwise.
        """
        pass

    @abstractmethod
    def get_tainted_inputs(self) -> set[tuple[str, str]] | None:
        """Get tainted input variables.

        Returns:
            Set of (filename, element_name) tuples for tainted inputs,
            or None if none found.
        """
        pass