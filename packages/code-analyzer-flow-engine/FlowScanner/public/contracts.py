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

    @abstractmethod
    def get_crawl_schedule(self) -> tuple[CrawlStep]:
        pass

    @abstractmethod
    def get_flow_path(self) -> str | None:
        pass

    @abstractmethod
    def get_subflow_parents(self) -> list[tuple[ET.Element, str]]:
        """READ ONLY. Do not perform any crawlstep loads with these crawlers!

        Returns:
            history of previous subflow/action elements, flow_paths that are ancestors
            of the current crawler, crawler. E.g. current_frame <-- [(elem0, path0), (elem1, path1)
            .. where the frame that spawned the current frame is at history[0] and the very first frame
            is at history[-1]
        """
        pass

    @abstractmethod
    def get_cfg(self) -> AbstractControlFlowGraph:
        pass

    @abstractmethod
    def get_current_step_index(self)->int:
        pass


    @abstractmethod
    def load_crawl_step(self) -> CrawlStep | None:
        pass

    @abstractmethod
    def get_last_ancestor(self, crawl_step) -> CrawlStep | None:
        """Get latest ancestor branch that was last visited at :obj:`CrawlStep`

        Useful for knowing which influence map to clone

        Args:
            crawl_step: step whose history is sought

        Returns:
            CrawlStep instance or None

        """
        pass

    @abstractmethod
    def get_elem_to_crawl_step(self, elem_name: str) -> list[CrawlStep]:
        """returns a list of all :obj:`CrawlStep` in which this element has been visited
         during the crawl of this flow. If not visited, the empty list is returned.

        Args:
            elem_name (str): element name (use '*' for the start element)

        Returns:
            list of :obj:`CrawlStep` instances that visit this element

        """
        pass

    @abstractmethod
    def get_crawlable_elem_tuples(self) -> list[tuple[str, str]] | None:
        """Returns all traversable element name, tag tuples that are connected to the start element
        """
        pass

    @abstractmethod
    def get_call_chain(self, source_el: ET.Element,
                       source_path: str,
                       sink_el: ET.Element,
                       source_parser: FlowParser) -> list[tuple[ET.Element, str]] | None:
        """sink_el must be in the current flow. source_el can be in an ancestor
        flow. Only returns paths currently crawled, so this must be called
        every time a specific frame is loaded.

        Args:
            source_parser: must be parser in the source flow path
        Returns:
            A list starting with the source and ending with the sink in which the each is an
            ancestor caller of the succeeding element.
            [(element, element flow path)]

        """
        pass


class AbstractControlFlowGraph(ABC):
    # where to start
    @property
    @abstractmethod
    def start_label(self) -> str:
        pass

    # map from segment label -> inbound jumps
    @property
    @abstractmethod
    def inbound(self) -> dict[str, list[Jump]]:
        pass

    @property
    @abstractmethod
    def segment_map(self) -> dict[str, AbstractSegment]:
        pass


class AbstractSegment(ABC):
    # name of element at the start of the segment (jump target)
    @property
    @abstractmethod
    def label(self) -> str:
        pass

    # list of (element names, element tags) (including label) in this segment (in order)
    @property
    @abstractmethod
    def traversed(self) -> list[tuple[str, str]]:
        pass

    # list of traversal indexes that are subflow elements
    @property
    @abstractmethod
    def subflows(self) -> list[int]:
        pass

    @property
    @abstractmethod
    def jumps(self) -> list[Jump]:
        pass

    # whether this segment may end execution
    @property
    @abstractmethod
    def is_terminal(self) -> bool:
        pass

    # for tracking whether it has been visited
    @property
    @abstractmethod
    def seen_tokens(self) -> list[tuple[tuple[str], ...]]:
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
        """
        The accept method is designed for directly reporting issues discovered
        in-line during regular flow processing and not run as the result of running
        a query.

        For example, the executor needs to check if a subflow creates a circular reference
        in order to ensure that symbolic execution terminates, but the user may also be
        looking for this information as a query result.

        Therefore, we ensure that every query has an accept method that takes no
        action and in case there is a query (e.g. that checks for subflow circular references)
        then this query can override the accept method to handle it.

        The query manager ensures that only instantiated queries can have their
        accept method called.

        """
        return None

    @classmethod
    @abstractmethod
    def get_query_description(cls) -> QueryDescription:
        pass

    @abstractmethod
    def when_to_run(self) -> list[QueryAction]:
        pass

    @abstractmethod
    def execute(self) -> list[QueryResult] | None:
        pass


class Query(AbstractQuery, ABC):

    @classmethod
    @abstractmethod
    def get_query_description(cls) -> QueryDescription:
        pass

    @abstractmethod
    def when_to_run(self) -> list[QueryAction]:
        pass

    @abstractmethod
    def execute(self,
                state: State=None, # the state has the flow_path variable
                crawler: AbstractCrawler = None,
                all_states = None) -> list[QueryResult] | None:
        pass



class LexicalQuery(AbstractQuery, ABC):

    @abstractmethod
    def get_query_description(self) -> QueryDescription:
        pass

    @abstractmethod
    def when_to_run(self) -> list[QueryAction]:
        pass

    @abstractmethod
    def execute(self,
                parser: FlowParser = None,
                **kwargs
                ) -> list[QueryResult] | None:
        pass




class AbstractFlowVector(ABC):

    @property
    @abstractmethod
    def property_maps(self) -> dict[InfluencePath, dict[str, set[InfluencePath]]]:
        pass

    @classmethod
    @abstractmethod
    def from_flows(cls, default: set[InfluencePath] = None) -> AbstractFlowVector:
        pass

    @abstractmethod
    def get_flows_by_prop(self, member_name: str | None = None) -> set[InfluencePath]:
        pass

    @abstractmethod
    def add_vector(self, vector: AbstractFlowVector) -> AbstractFlowVector:
        pass


    @abstractmethod
    def push_via_flow(self, extension_path: InfluencePath, influenced_vec: AbstractFlowVector,
                      assign: bool = True,
                      cross_flow: bool = False) -> AbstractFlowVector:
        pass


class State(ABC):
    """Stores DataInfluencePaths in the current execution step

    """
    @abstractmethod
    def get_parser(self) -> FlowParser:
        pass

    @abstractmethod
    def get_current_elem(self) -> ET.Element:
        pass

    @abstractmethod
    def get_current_elem_name(self) -> str:
        pass

    @abstractmethod
    def get_flows_from_sources(self, influenced_var: str,
                               source_vars: set[tuple[str, str]],
                               restrict: str | None = None) -> set[InfluencePath] | None:
        pass

    @abstractmethod
    def is_in_map(self, var_name: str) -> bool:
        pass


class FlowParser(ABC):
    """Exposes global information about the current flow
    """


    @abstractmethod
    def get_all_named_elems(self) -> frozenset[ET.Element] | None:
        pass


    @abstractmethod
    def get_all_names(self) -> tuple[str,] | None:
        pass

    @abstractmethod
    def get_effective_run_mode(self) -> RunMode:
        pass

    @abstractmethod
    def get_declared_run_mode(self) -> RunMode:
        pass

    @abstractmethod
    def get_api_version(self) -> str:
        pass

    @abstractmethod
    def get_all_traversable_flow_elements(self) -> list[ET.Element]:
        pass

    @abstractmethod
    def get_all_variable_elems(self) -> list[ET.Element] | None:
        pass

    @abstractmethod
    def get_start_elem(self) -> ET.Element:
        pass

    @abstractmethod
    def get_traversable_descendents_of_elem(self, elem_name: str) -> list[str]:
        """Gets elements that are called (connected to) from elem_name.
         Includes the original elem_name"""
        pass

    @abstractmethod
    def get_filename(self) -> str:
        pass

    @abstractmethod
    def get_flow_name(self) -> str:
        pass

    @abstractmethod
    def get_flow_type(self)-> public.enums.FlowType:
        pass

    @abstractmethod
    def get_trigger_object(self) -> str | None:
        pass

    @abstractmethod
    def get_trigger_type(self)-> public.enums.TriggerType:
        pass

    @abstractmethod
    def get_root(self) -> ET.Element:
        pass

    @abstractmethod
    def get_literal_var(self) -> VariableType:
        pass

    @abstractmethod
    def get_traversable_inbound(self) -> dict[str, list[str]]:
        """Returns dict from element name to list of all inbound element names
           will be empty list if no inbound.
        """
        pass

    @abstractmethod
    def get_action_call_map(self) -> dict[str, list[tuple[El, str]]] | None:
        """Gets all actionCalls in the flow element
        Returns: actionCall type -> (element, action name)
        """
        pass

    @abstractmethod
    def get_async_scheduled_paths(self) -> list[str]:
        pass

    @abstractmethod
    def resolve_by_name(self, name: str, path: str | None = None) -> Optional[(str, str, VariableType)]:
        pass

    @abstractmethod
    def get_output_variables(self, path: str | None = None) -> set[tuple[str, str]]:
        pass

    @abstractmethod
    def get_input_variables(self, path: str | None = None) -> set[tuple[str, str]]:
        """Get Flow variables available for input

        Returns: (filename, element_name) corresponding to all variables available for input
                 or None if none found.

        """
        pass

    @abstractmethod
    def get_input_field_elems(self) -> set[ET.Element] | None:
        """Named XML elements that are children of Screen Flow Input Text Elements

        .. Note:: Only returns variables from current flow

        Returns: None if none present in flow

        """
        pass

    @abstractmethod
    def get_by_name(self, name_to_match: str, scope: ET.Element | None = None) -> ET.Element | None:
        pass

    @abstractmethod
    def get_tainted_inputs(self) ->  set[tuple[str, str]] | None:
        pass