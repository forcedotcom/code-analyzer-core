"""Responsible for loading and invoking query instances.

    @author: rsussland@salesforce.com

"""
from __future__ import annotations

import importlib
import logging
import os
import traceback
import types
from enum import Enum
from importlib import machinery
from typing import Any

import queries.default_query
from flow_parser.parse import Parser
from flowtest.flow_result import ResultsProcessor
from public.contracts import QueryProcessor, State

logger = logging.getLogger(__name__)


class QueryAction(Enum):
    process_elem = 0
    flow_enter = 10
    scan_exit = 20


class QueryManager:
    # instance that performs queries and produces results
    query_processor: QueryProcessor = None

    # instance that stores results and generates reports
    results: ResultsProcessor = None

    # current parser associated to flow-file
    parser: Parser = None

    # which preset to request
    requested_preset: str = None

    query_module: Any = None

    class_name: str | None = None

    @classmethod
    def build(cls, results: ResultsProcessor,
              parser: Parser = None,
              requested_preset: str | None = None,
              module_path: str | None = None,
              class_name: str | None = None) -> QueryManager:
        """Only call this once to build Query Manager at scan start
        """
        qm = QueryManager()
        if module_path is not None:
            # try to load requested query
            # TODO: add better error handling
            query_module = create_module(module_path=module_path)

            qm.query_module = query_module
            qm.class_name = class_name
            preset, instance = get_instance(query_module_=query_module,
                                            class_name_=class_name,
                                            preset_=requested_preset)
            qm.requested_preset = requested_preset

        else:
            # use default
            instance = queries.default_query.DefaultQueryProcessor()
            preset = instance.set_preset_name(preset_name=requested_preset)

        if preset is None:
            raise RuntimeError(f"The loaded query module does not support preset: {preset or 'No preset provided'}")

        # store pointer to query processor
        qm.query_processor = instance

        # assign preset to results
        results.preset = preset

        # store pointer to results
        qm.results = results
        qm.parser = parser

        return qm

    def reload(self):
        """Make a new instance of the queries after completing one flow

        Returns:
            None
        """

        if self.query_module is None or self.class_name is None:
            # use default
            self.query_processor = queries.default_query.DefaultQueryProcessor()
            return
        else:
            preset, instance = get_instance(self.query_module,
                                            self.class_name, self.requested_preset)
        self.query_processor = instance

    def query(self, action: QueryAction, state: State) -> None:
        """Invokes QueryProcessor to execute query and stores results

        Args:
            action: type of invocation (flow entrance or element entrance)
            state: current state

        Returns:
            None
        """
        # TODO: add exception handling and logging as this is third party code
        # when we first enter a state, there is a start elem which is not assigned and so curr elem is None.
        # don't look for sinks into these start states.
        if action is QueryAction.process_elem and state.get_current_elem() is not None:

            res = self.query_processor.handle_crawl_element(state=state)
            if res is not None:
                self.results.add_results(res)

        elif action is QueryAction.flow_enter:
            res = self.query_processor.handle_flow_enter(state=state)
            # TODO: better validation of result
            if res is not None:
                self.results.add_results(res)

    def final_query(self, all_states: (State,)) -> None:
        res = self.query_processor.handle_final(all_states=all_states)
        # TODO: better validation of result
        if res is not None:
            self.results.add_results(res)

        # delete old query instance and reload for next flow to process
        self.reload()

        # delete old states


def create_module(module_path: str) -> Any:
    """Loads and Instantiates QueryProcessor

        Args:
            module_path: location of module to load

        Returns:
            QueryProcessor module

        Raises:
            ValueError if module name cannot be parsed or preset not accepted
            ImportError if the module cannot be loaded

    """
    if module_path is None:
        # we'll build default
        return None

    else:
        # module should have a class with the same name as the module.
        filename = os.path.basename(module_path)

        if filename is None:
            raise ValueError("Could not determine file to load")

        splits = filename.split('.py')

        if len(splits) != 2 or splits[-1] != '':
            raise ValueError("File must end in .py")

        mod_name = splits[0]
        try:
            loader = importlib.machinery.SourceFileLoader(mod_name, module_path)
            query_module = types.ModuleType(loader.name)
            loader.exec_module(query_module)
            return query_module
        except Exception as e:
            logger.critical(f"ERROR: could not load module {filename}: {traceback.format_exc()}")
            raise e


def get_instance(query_module_, class_name_, preset_):
    if query_module_ is None:
        query_instance = queries.default_query.QueryProcessor()

    else:
        try:
            query_instance = getattr(query_module_, class_name_)()

        except Exception as e:
            logger.critical(f"ERROR: could not instantiate module")
            raise e

    try:
        accepted_preset = query_instance.set_preset_name(preset_)
        if accepted_preset is None:
            raise ValueError("Could not set preset")

        else:
            return accepted_preset, query_instance

    except Exception as e:
        logger.critical(f"ERROR: could not set preset: {traceback.format_exc()}")
        raise e

# TODO: write up initialization and flow transition for *all* elements (including variables, caches, etc)
