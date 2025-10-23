"""Responsible for loading and invoking query instances.

    @author: rsussland@salesforce.com

"""
from __future__ import annotations

import importlib
import json
import logging
import os
import traceback
import types
from importlib import machinery
from typing import Any

import queries.default_query
import queries.optional_query
import queries.debug_query


from flow_parser.parse import Parser
from flow_scanner.util import case_insensitive_match
from flow_scanner.control_flow import Crawler
from flow_scanner.flow_result import ResultsProcessor
from public.contracts import QueryProcessor, State, AbstractQuery, AbstractCrawler, Query, LexicalQuery
from public.data_obj import Preset, PresetEncoder
from public.enums import QueryAction
logger = logging.getLogger(__name__)


# In the future, if other files are added, need to add here
ADDITIONAL_QUERY_MODULES = [
    (queries.optional_query, queries.optional_query.QUERIES),
    (queries.debug_query, queries.debug_query.QUERIES)
]


class QueryManager:
    # instance that performs queries and produces results
    query_processor: QueryProcessor = None

    # stand-alone query_map action -> additional query instance
    queries: dict[QueryAction, list[Query | LexicalQuery]] = None

    # stand-alone query map -> query_id -> query instance
    flattened_queries: dict[str, Query | LexicalQuery] | None = None

    # instance that stores results and generates reports
    results: ResultsProcessor = None

    # current parser associated to flow-file
    parser: Parser = None

    # which preset to request
    requested_preset: str = None

    # additional queries to perform
    additional_queries: list[str] = None

    # lexical queries only run once per flow visit
    visited_flows: list[str] = None

    query_module: Any = None

    class_name: str | None = None

    query_id_to_module_name: dict[str, str] | None = None

    debug_msg: str | None = None

    @classmethod
    def build(cls, results: ResultsProcessor,
              parser: Parser = None,
              requested_preset: str | None = None,
              additional_queries: list[str] | None = None,
              module_path: str | None = None,
              class_name: str | None = None,
              debug_query: str | None = None) -> QueryManager:
        """Only call this once to build Query Manager at scan start
        """
        qm = QueryManager()

        if debug_query is not None:
            qm.set_debug_query(debug_query)

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
            preset = instance.set_preset(preset_name=requested_preset)

        if preset is None:
            raise RuntimeError(f"The loaded query module does not support preset: {preset or 'No preset provided'}")

        # store pointer to query processor
        qm.query_processor = instance
        res = build_query_map(additional_queries=additional_queries, debug_msg=debug_query)
        qm.queries, qm.flattened_queries, qm.query_id_to_module_name = res
        if qm.flattened_queries is not None:
            qm.additional_queries = list(qm.flattened_queries.keys())
        # assign preset to results
        results.preset = get_updated_preset(preset, additional_query_map=qm.queries)

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
        self.queries, self.flattened_queries, self.query_id_to_module_name = build_query_map(
            additional_queries=self.additional_queries, debug_msg=self.debug_msg
        )

    def lexical_query(self, parser: Parser, crawler: AbstractCrawler=None) -> None:
        if self.additional_queries is None:
            return None
        if QueryAction.lexical not in self.queries:
            return None
        flow_path = parser.flow_path
        if self.visited_flows is not None and flow_path in self.visited_flows:
            return None
        else:
            if self.visited_flows is None:
                self.visited_flows = [flow_path]
            else:
                self.visited_flows.append(flow_path)

            to_run = self.queries[QueryAction.lexical]
            for qry in to_run:
                res = qry.execute(parser=parser, crawler=crawler)
                if res is not None:
                    self.results.add_results(res)
            return None

    def lexical_accept(self, query_id, **kwargs) -> None:

        if self.additional_queries is not None and query_id in self.additional_queries:
            mod_name = self.query_id_to_module_name[query_id]
            qry_class = getattr(mod_name,query_id)

            res = getattr(qry_class, 'accept')(**kwargs)

            if res is not None:
                self.results.add_results(res)
            else:
                logger.info(f"The query id {query_id} is not recognized as a requested lexical query id")

    def query(self, action: QueryAction, state: State, crawler: Crawler = None) -> None:
        """Invokes QueryProcessor to execute query and stores results

        Args:
            action: type of invocation (flow entrance or element entrance)
            state: current state
            crawler: flow crawler object which has crawl schedule and cfg

        Returns:
            None
        """
        # TODO: add exception handling and logging as this is third party code
        # when we first enter a state, there is a start elem which is not assigned and so curr elem is None.
        # don't look for sinks into these start states.
        if action is QueryAction.process_elem and state.get_current_elem() is not None:

            res = self.query_processor.handle_crawl_element(state=state, crawler=crawler)
            if res is not None:
                self.results.add_results(res)

        elif action is QueryAction.flow_enter:
            res = self.query_processor.handle_flow_enter(state=state, crawler=crawler)
            # TODO: better validation of result
            if res is not None:
                self.results.add_results(res)

        self._run_additional_queries(action=action, state=state,
                                     crawler=crawler, all_states=None)




    def final_query(self, all_states: tuple[State]=None) -> None:
        res = self.query_processor.handle_final(all_states=all_states)
        # TODO: better validation of result
        if res is not None:
            self.results.add_results(res)
        self._run_additional_queries(action=QueryAction.scan_exit,
                                     all_states=all_states)

        # delete old query instance and reload for next flow to process
        self.reload()
        # delete old states

    def accept(self, query_id: str, **kwargs) -> None:
        if query_id not in self.additional_queries:
            return None
        qry = self.flattened_queries[query_id]

        res = qry.accept(**kwargs)
        if res is not None:
            self.results.add_results(res)
        return None

    def debug_query(self, msg: str):
        self.debug_msg = msg

    def _run_additional_queries(self, action: QueryAction, state: State=None,
                                crawler: AbstractCrawler=None, all_states: tuple[State]=None) -> None:
        if self.additional_queries is None:
            return None
        if action not in self.queries:
            return None
        else:
            to_run = self.queries[action]
            for qry in to_run:
                res = qry.execute(state=state, crawler=crawler, all_states=all_states)
                if res is not None:
                    self.results.add_results(res)
            return None


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
        query_instance = queries.default_query.DefaultQueryProcessor()

    else:
        try:
            query_instance = getattr(query_module_, class_name_)()

        except Exception as e:
            logger.critical(f"ERROR: could not instantiate module")
            raise e

    try:
        accepted_preset = query_instance.set_preset(preset_)
        if accepted_preset is None:
            raise ValueError("Could not set preset")

        else:
            return accepted_preset, query_instance

    except Exception as e:
        logger.critical(f"ERROR: could not set preset: {traceback.format_exc()}")
        raise e


def build_query_map(additional_queries: list[str] | None=None,
                    debug_msg: str|None = None
                    ) -> tuple[dict[QueryAction, list[Query | LexicalQuery]],
                         dict[str, Query | LexicalQuery], dict[str,str]] | tuple[None, None, None]:
    if additional_queries is None:
        return None, None, None
    else:
        instance_map = {}
        flat_map = {}
        qry_to_mod = {}
        for q_name in additional_queries:
            for (my_module, qry_map) in ADDITIONAL_QUERY_MODULES:
                match_ = case_insensitive_match(qry_map.keys(), q_name)
                if match_ is not None:
                    qry_to_mod[match_] = my_module
                    if my_module is not queries.debug_query:
                        q_instance = getattr(my_module, match_)()
                    else:
                        q_instance = getattr(my_module, match_)(debug_msg)
                    action = q_instance.when_to_run()
                    if action not in instance_map:
                        instance_map[action] = [q_instance]
                    else:
                        instance_map[action].append(q_instance)
                    if match_ in flat_map.keys():
                        raise ValueError(f"Duplicate query name: {q_name}")
                    else:
                        flat_map[match_] = q_instance
                    # stop looking in other modules for q_name
                    break

        if len(instance_map) == 0:
            return None, None, None
        else:
            return instance_map, flat_map, qry_to_mod


def get_updated_preset(preset, additional_query_map: dict[QueryAction,list[AbstractQuery]]=None):
    if additional_query_map is None:
        return preset
    else:
        old_queries = preset.queries
        for q_list in additional_query_map.values():
            for q in q_list:
                if q is not None:
                    old_queries.add(q.get_query_description())

        return Preset(preset_name=preset.preset_name,
                      preset_owner=preset.preset_owner,
                      queries=old_queries)


def get_all_optional_descriptions()-> str:
    descriptions = []
    for (my_module, qry_map) in ADDITIONAL_QUERY_MODULES:
        for q_name in qry_map.keys():
            q_instance = getattr(my_module, q_name)()
            descriptions.append(q_instance.get_query_description())
    return (json.dumps(descriptions, indent=4, cls=PresetEncoder)
            .replace('\\"', '"').replace('\\n', "\n"))


def validate_qry_list(qry_list: list[str]) -> bool | list[str]:
    query_keys = [x[1].keys() for x in ADDITIONAL_QUERY_MODULES]
    found_tkns = []
    missed_tkns = []
    for tkn in qry_list:
        for query_key in query_keys:
            match_ = case_insensitive_match(query_key, tkn)
            if match_ is not None:
                found_tkns.append(match_)
                break
        # tkn not found in any query key
        missed_tkns.append(tkn)
    valid = len(found_tkns) == len(qry_list)
    if valid:
        return True
    else:
        assert len(missed_tkns) != 0
        return missed_tkns

def get_all_optional_queries() -> list[str]:
    """Does not return debug queries
    """
    accum = []
    for x in ADDITIONAL_QUERY_MODULES:
        if x[0] is not queries.debug_query:
            accum = accum + list(x[1].keys())

    return accum
