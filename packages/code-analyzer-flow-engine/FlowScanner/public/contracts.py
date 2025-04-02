"""Interface definitions for custom queries

    Caution:: If building a custom query, only develop against the ref:mod:`public` module
    otherwise the custom query code will break on upgrades.

"""

from __future__ import annotations
from typing import TYPE_CHECKING, Optional

from abc import ABC, abstractmethod

import public.enums

if TYPE_CHECKING:
    from public.data_obj import DataInfluencePath, VariableType
    import xml.etree.ElementTree as ET

from public.enums import RunMode

# and import other types as needed to process queries
from public.data_obj import QueryResult, Preset

"""
To generate custom queries, implement the QueryPresets class
and for each query listed in the preset, implement
a Query class for that query. Then specify 
the import path of the custom queries when invoking the script,
or programmatically import if invoking as a module.
"""


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
    def set_preset_name(self, preset_name: str | None) -> Preset | None:
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
                             ) -> list[QueryResult] | None:
        """

        Args:
            state:

        Returns:

        """
        pass

    # Called every time a new flow is loaded (master flow or subflow)
    @abstractmethod
    def handle_flow_enter(self,
                          state: State,  # the state has the flow_path variable
                          ) -> list[QueryResult] | None:
        """Invoked when a flow or subflow is first entered.

        Args:
            state:

        Returns:

        """
        pass

    # Called when crawling is complete
    @abstractmethod
    def handle_final(self,
                     all_states: ([State],),
                     ) -> list[QueryResult] | None:
        """Invoked when crawl is complete for the flow and all subflows.

        Args:
            all_states:

        Returns:

        """
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
    def get_flows_from_sources(self, influenced_var: str, source_vars: {(str, str)}) -> set[DataInfluencePath] | None:
        pass

    @abstractmethod
    def is_in_map(self, var_name: str) -> bool:
        pass


class FlowParser(ABC):
    """Exposes global information about the current flow
    """

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
    def get_filename(self) -> str:
        pass

    @abstractmethod
    def get_flow_name(self) -> str:
        pass

    @abstractmethod
    def get_flow_type(self)-> public.enums.FlowType:
        pass

    @abstractmethod
    def get_root(self) -> ET.Element:
        pass

    @abstractmethod
    def get_literal_var(self) -> VariableType:
        pass

    @abstractmethod
    def resolve_by_name(self, name: str, path: str | None = None) -> Optional[(str, str, VariableType)]:
        pass

    @abstractmethod
    def get_output_variables(self, path: str | None = None) -> {(str, str)}:
        pass

    @abstractmethod
    def get_input_variables(self, path: str | None = None) -> {(str, str)}:
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
