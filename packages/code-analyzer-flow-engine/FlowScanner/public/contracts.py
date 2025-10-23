"""Interface definitions for custom queries

    Caution:: If building a custom query, only develop against the ref:mod:`public` module
    otherwise the custom query code will break on upgrades.

"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Optional

import public.enums

if TYPE_CHECKING:
    from public.data_obj import InfluencePath, VariableType, CrawlStep, Jump
    import xml.etree.ElementTree as ET

from public.enums import RunMode, QueryAction

# and import other types as needed to process queries
from public.data_obj import QueryResult, Preset, QueryDescription, InfluencePath

from typing import TypeAlias

var_t: TypeAlias = tuple[str, str]
"""
To generate custom queries, implement the QueryPresets class
and for each query listed in the preset, implement
a Query class for that query. Then specify 
the import path of the custom queries when invoking the script,
or programmatically import if invoking as a module.
"""

class AbstractCrawler(ABC):

    @abstractmethod
    def get_control_influence_from_source(self, influenced_var: str,
                                                source_var: var_t) ->tuple[var_t, ...] | None:
        """Get control influence chain from source to influenced var

        Args:
            influenced_var (str): top level (traversable) flow element name in the flow crawled by this current crawler.
            source_var (str, str): flow_path, element name in either the current flow or in another flow that may or
                                   may not be an ancestor in the call chain.

        Returns:
            None if there is no influence, or a set of crawl steps linking the source to the influenced.
            Only a single chain of crawl_steps is returned, there may be other control influence chains.

        """
        pass

    @abstractmethod
    def get_crawl_schedule(self) -> tuple[CrawlStep]:
        pass

    @abstractmethod
    def get_flow_path(self) -> str | None:
        pass

    @abstractmethod
    def get_crawler_history_unsafe(self) -> list[tuple[AbstractCrawler, int]]:
        """READ ONLY. Do not perform any crawlstep loads with these crawlers!

        Returns:
            history of crawlers encountered during crawl, together with the current step (int)
            when they entered a child flow.
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
    def seen_tokens(self) -> list[tuple[tuple[str, str]]]:
        pass

class QueryProcessor(ABC):
    """Queries must implement this class.

    - Queries are instantiated *once* per flow run,
      and the same query instance is passed to all
      subflows. Therefore, you can store internal state
      in the query, for example querying for all sources
      when given the process root command, and then using
      those sources in subsequent invocations.

    - Queries are passed the full BranchState at every
      invocation, but should never write to this state

    - Queries are passed a parser instance with a number
      of higher level functions to search for flow inputs
      and outputs, but access to making raw ET queries
      is still possible. Never write to the parser
      instance.

    - Examine the documentation for the parser instance.

    **CAUTION** The parser and BranchState API is still
    in development, so early queries may break on upgrade,
    until a more formal release is made, at which point
    older APIs will be maintained for backwards compatability.

    Please stay in contact with the project developers if you are writing
    custom queries or would prefer additional parser functionality.

    - do not rely on _methods in the parser being stable
      across even minor releases.


    """

    @abstractmethod
    def __init__(self) -> None:
        """Constructor is passed only a FlowParser instance.

            Args:
                Parser that has parsed the first (master) flow.

            Returns:
                None
        """
        pass

    # The set_preset() method is called during scan-setup. On
    # success, return the Preset with the provided name as acknowledgement
    # that these are the queries that will be run.
    #
    # If the instance is requested a preset with a non-None name and
    # returns a preset with a different name, then the scan stops with
    # an error.
    #
    # If an incorrect name is supplied or the preset cannot be found
    # return None, and the system will exit with
    # an error message to the user (usually a misspelling or
    # misconfiguration error). No scan will occur.
    #
    # If preset_name is None, a default preset
    # should be run, and this preset returned.
    #
    @abstractmethod
    def set_preset(self, preset_name: str | None) -> Preset | None:
        """

        Args:
            preset_name:

        Returns:
            Preset that will be used in subsequent processing
        """
        pass

    # This method is called by the query_processor on every flow element
    # (except <start> and <subflow>)
    @abstractmethod
    def handle_crawl_element(self,
                             state: State,
                             crawler: AbstractCrawler,
                             ) -> list[QueryResult] | None:
        """

        Args:
            state:
            crawler: cfg and crawl schedule

        Returns:
            list of query results
        """
        pass

    # Called every time a new flow is loaded (master flow or subflow)
    @abstractmethod
    def handle_flow_enter(self,
                          state: State,  # the state has the flow_path variable
                          crawler: AbstractCrawler,
                          ) -> list[QueryResult] | None:
        """Invoked when a flow or subflow is first entered.

        Args:
            state: state instance
            crawler: crawl schedule and cfg

        Returns:
            list of QueryResults
        """
        pass

    # Called when crawling is complete
    @abstractmethod
    def handle_final(self,
                     all_states: tuple[State],
                     ) -> list[QueryResult] | None:
        """Invoked when crawl is complete for the flow and all subflows.

        Args:
            all_states:

        Returns:

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

    @abstractmethod
    def get_query_description(self) -> QueryDescription:
        pass

    @abstractmethod
    def when_to_run(self) -> QueryAction:
        pass

    @abstractmethod
    def execute(self) -> list[QueryResult] | None:
        pass


class Query(AbstractQuery, ABC):

    @abstractmethod
    def get_query_description(self) -> QueryDescription:
        pass

    @abstractmethod
    def when_to_run(self) -> QueryAction:
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
    def when_to_run(self) -> QueryAction:
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
    def get_action_call_map(self) -> dict[str, list[tuple[str, str]]] | None:
        """Gets all actionCalls in the flow element
        Returns: actionCall type -> (element name, action name)
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
