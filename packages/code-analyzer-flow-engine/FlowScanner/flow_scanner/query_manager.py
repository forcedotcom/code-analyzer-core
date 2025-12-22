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
from importlib import machinery, reload
from typing import Any

import queries.default_query
import queries.optional_query
from flow_parser.parse import Parser
from flow_scanner.control_flow import Crawler
from flow_scanner.flow_result import ResultsProcessor
from flow_scanner.util import case_insensitive_match
from public.contracts import State, AbstractCrawler, Query, LexicalQuery, FlowParser
from public.data_obj import Preset, PresetEncoder
from public.enums import QueryAction
from queries import debug_query
from queries.debug_query import Detect

logger = logging.getLogger(__name__)

PRESETS = {
    'default': [(queries.default_query, 'PreventPassingUserDataIntoElementWithoutSharing'),
                (queries.default_query,'PreventPassingUserDataIntoElementWithSharing'),
                (queries.optional_query, 'DbInLoop'),
                (queries.optional_query, 'HardcodedId'),
                (queries.optional_query, 'SameRecordUpdate'),
                (queries.optional_query, 'TriggerEntryCriteria'),
                (queries.optional_query, 'UnusedResource'),
                (queries.optional_query, 'UnreachableElement'),
                (queries.optional_query, 'MissingNextValueConnector'),
                (queries.optional_query, 'TriggerWaitEvent'),
                (queries.optional_query, 'TriggerCallout'),
                ],
    'org':[(queries.default_query, 'PreventPassingUserDataIntoElementWithoutSharing'),
           (queries.default_query, 'PreventPassingUserDataIntoElementWithSharing'),
           (queries.optional_query, 'DbInLoop'),
           (queries.optional_query, 'CyclicSubflow'),
           (queries.optional_query, 'MissingFaultHandler'),
           (queries.optional_query, 'HardcodedId'),
           (queries.optional_query, 'SameRecordUpdate'),
           (queries.optional_query, 'TriggerEntryCriteria'),
           (queries.optional_query, 'UnusedResource'),
           (queries.optional_query, 'UnreachableElement'),
           (queries.optional_query, 'MissingNextValueConnector'),
           (queries.optional_query, 'TriggerWaitEvent'),
           (queries.optional_query, 'TriggerCallout'),
           ]
}


# In the future, if other files are added, need to add here
QUERY_MODULES = [
    (queries.default_query, queries.default_query.QUERIES),
    (queries.optional_query, queries.optional_query.QUERIES),
]

class QueryManager:
    """Manages query execution during flow scanning.

    Lifecycle: QueryManager is instantiated once per invocation of flow_scanner.
    That means that if an argument is set to None due to error, it will not be
    attempted again in the next flow.

    At the end of a full flow parse (including subflows), the queries are reloaded,
    e.g. re-instantiated. But query instances persist across subflows. They persist
    until reload is called.
    """
    # which built-in queries were requested, combining preset and any optional
    requested_query_ids: list[str] | None = None

    # built-in query_id -> query instance. Includes debug query but not custom queries
    queries: dict[str, Query | LexicalQuery] | None = None

    # custom query_id -> query instance. None if no custom queries were requested.
    custom_queries: dict[str, Query | LexicalQuery] | None = None

    # Custom Queries are combined with regular queries and also with the debug query
    # action_type -> list of query instances with this type.
    action2queries: dict[QueryAction, list[Query | LexicalQuery]] = None

    # used in lexical accept
    query_id2module_name: dict[str, str] | None = None

    # instance that stores results and generates reports
    results: ResultsProcessor = None

    # current parser associated to flow-file
    parser: FlowParser = None

    # which preset to request
    preset: str = None

    # module loaded from environment
    external_query_module: Any = None

    # list of class names to run from external module. Must not conflict with
    # any requested built-in queries or with the debug query.
    #
    external_class_names: list[str] | None = None

    # JSON object that will be passed to the debug query
    debug_arg: Any | None = None

    @classmethod
    def build(cls,
              parser: FlowParser,
              requested_preset: str | None = None,
              requested_queries: list[str] | None = None,
              external_module_path: str | None = None,
              external_class_names: str | None = None,
              debug_arg_str: str | None = None) -> QueryManager:
        """Build QueryManager instance at scan start.

        Only call this once to build Query Manager at scan start.

        Args:
            parser: FlowParser instance for the current flow.
            requested_preset: Name of preset to use, or None.
            requested_queries: List of specific query IDs to run, or None.
            external_module_path: Path to external query module, or None.
            external_class_names: Comma-separated class names from external module, or None.
            debug_arg_str: JSON string for debug query arguments, or None.

        Returns:
            Configured QueryManager instance.

        Raises:
            ValueError: If debug_arg_str cannot be parsed.
            ImportError: If external module cannot be loaded.
        """
        qm = QueryManager()
        qm.parser = parser
        if debug_arg_str is not None:
            try:
                qm.debug_arg = json.loads(debug_arg_str)

            except:
                logger.critical(f"error parsing debug argument\n{traceback.format_exc()}"
                                f"\n...skipping debug query in this run")
                raise

        if external_module_path is not None and external_class_names is not None:
            # try to load requested query
            try:
                query_module = create_module(module_path=external_module_path)

                qm.external_query_module = query_module
                qm.external_class_names = [x.strip() for x in external_class_names.split(",")
                                           if x.strip() != '']

            except:
                msg=("error loading external module\n"
                     f"{traceback.format_exc()}\n"
                     f"skipping external query in this run.")
                logger.critical(msg)
                print(msg)
                raise

        if requested_queries is not None and requested_preset is not None:
            # use both
            qm.preset = requested_preset
            qm.requested_query_ids = qm.requested_query_ids + [x[1] for x in PRESETS[requested_preset]
                                                               if x[1] not in qm.requested_query_ids]

        elif requested_queries is not None:
            # requested preset must be None but user listed queries, so just run those
            qm.requested_query_ids = requested_queries

        else:
            # requested queries must be None, so we rely on preset
            if requested_preset is None:
                requested_preset = 'default'
            qm.preset = requested_preset
            qm.requested_query_ids = [x[1] for x in PRESETS[requested_preset]]

        qm.queries, qm.custom_queries, qm.action2queries, qm.query_id2module_name = build_query_maps(
            requested_queries=qm.requested_query_ids,
            external_module=qm.external_query_module,
            external_classnames=qm.external_class_names,
            debug_arg=qm.debug_arg
        )

        return qm

    def generate_effective_preset(self) -> Preset:
        """Generate the effective preset that will actually be run.

        Combines the preset field selected by the caller and any additional
        queries selected by the caller.

        Returns:
            Preset object containing the list of query descriptions that will
            actually be run.
        """
        q = []
        if self.queries:
            q += list(self.queries.values())
        if self.custom_queries:
            q += list(self.custom_queries.values())

        query_desc = [instance.get_query_description() for instance in q]

        if self.debug_arg:
            query_desc.append(debug_query.Detect.get_query_description())

        preset_name = self.preset or "custom"

        return Preset(preset_name=preset_name, preset_owner=None,
                      queries=set(query_desc))



    def lexical_query(self, parser: Parser, crawler: AbstractCrawler = None) -> None:
        """Execute all lexical queries on the parser.

        Args:
            parser: Parser instance for the flow.
            crawler: Optional crawler instance (not used for lexical queries).
        """
        if self.queries is None or QueryAction.lexical not in self.action2queries:
            return None

        to_run = self.action2queries[QueryAction.lexical]
        for qry in to_run:
            try:
                res = qry.execute(parser=parser, crawler=crawler)
                if res is not None:
                    self.results.add_results(res)
            except:
                logger.critical(f"error executing lexical query in flow "
                                f"{parser.flow_path} {traceback.format_exc()}")
        return None

    def static_accept(self, query_id: str, **kwargs) -> None:
        """Call the (static) 'accept' method of a query.

        The query must override the static 'accept' method of the abstract class.
        Expert use only.

        The purpose of accept methods is to record issues found in the course
        of normal scanning and parsing, and not as a result of running queries.
        Because of this, we are accepting issues found and merely reformatting
        them into the appropriate query result. But if this query is not requested,
        then it will not override the parent accept which is a null op.

        Args:
            query_id: Name of class that has the static accept method.
            **kwargs: Keyword arguments to pass to the accept method.
        """
        if self.queries is not None and query_id in self.queries:
            mod_name = self.query_id2module_name[query_id]
            qry_class = getattr(mod_name,query_id)
            try:
                res = getattr(qry_class, 'accept')(**kwargs)
                if res is not None:
                    self.results.add_results(res)
            except:
                logger.critical(f"error processing lexical accept "
                                f"{traceback.format_exc()}")
            else:
                logger.info(f"The query id {query_id} is not recognized as a requested lexical query id")

    def query(self, action: QueryAction, state: State, crawler: Crawler = None) -> None:
        """Invoke QueryProcessor to execute query and store results.

        Args:
            action: Type of invocation (flow entrance or element entrance).
            state: Current execution state.
            crawler: Flow crawler object which has crawl schedule and CFG.
        """
        # when we first enter a state, there is a start elem which is not assigned and so curr elem is None.
        # don't look for sinks into these start states.
        if action is QueryAction.process_elem and state.get_current_elem() is None:
            return None
        else:
            self.run_queries(action=action, state=state,
                             crawler=crawler, all_states=None)

            return None


    def final_query(self, all_states: tuple[State] = None) -> None:
        """Run final queries and reload for next flow.

        Executes scan_exit queries and then reloads query instances
        for the next flow to process.

        Args:
            all_states: Tuple of all execution states, or None.
        """
        self.run_queries(action=QueryAction.scan_exit,
                         all_states=all_states)

        # delete old query instances, modules, and reload for next flow to process
        self.reload()

    def accept(self, query_id: str, **kwargs) -> None:
        """Call the accept method of a query instance.

        Args:
            query_id: Query ID to call accept on.
            **kwargs: Keyword arguments to pass to accept method.
        """
        if query_id not in self.queries:
            return None
        qry = self.queries[query_id]
        try:
            res = qry.accept(**kwargs)
            if res is not None:
                self.results.add_results(res)
        except:
            logger.critical(f"error handling accept query {traceback.format_exc()}")

        return None

    def debug_query(self, msg: str) -> None:
        """Set debug argument for debug query.

        Args:
            msg: Debug message string.
        """
        self.debug_arg = msg

    def run_queries(self, action: QueryAction, state: State = None,
                    crawler: AbstractCrawler = None, all_states: tuple[State] = None) -> None:
        """Run all queries for a specific action.

        Args:
            action: QueryAction type to run queries for.
            state: Current execution state, or None.
            crawler: Flow crawler instance, or None.
            all_states: Tuple of all execution states, or None.
        """
        if self.action2queries is None:
            return None
        if action not in self.action2queries:
            return None
        else:
            to_run = self.action2queries[action]
            for qry in to_run:
                try:
                    res = qry.execute(state=state, crawler=crawler, all_states=all_states)
                    if res is not None:
                        self.results.add_results(res)
                except:
                    logger.critical(f"error executing query in flow {state.get_parser().get_filename()}"
                                    f"\n {traceback.format_exc()}")

            return None

    def reload(self) -> None:
        """Make new instances of queries after completing one flow.

        Deletes old query instances, modules, and reloads for the next flow
        to process.
        """
        # reload internal modules
        for mod_ in QUERY_MODULES:
            reload(mod_[0])

        # reload any external module
        if self.external_query_module:
            reload(self.external_query_module)

        self.queries, self.custom_queries, self.action2queries, self.query_id2module_name = build_query_maps(
            requested_queries=self.requested_query_ids,
            external_module=self.external_query_module,
            external_classnames=self.external_class_names,
            debug_arg=self.debug_arg
        )

def create_module(module_path: str) -> Any:
    """Load and instantiate a query module.

    Args:
        module_path: Location of module file to load.

    Returns:
        Loaded module object.

    Raises:
        ValueError: If module name cannot be parsed or file doesn't end in .py.
        ImportError: If the module cannot be loaded.
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

def build_query_maps(
        requested_queries: list[str] | None = None,
        external_module: Any | None = None,
        external_classnames: list[str] | None = None,
        debug_arg: Any | None = None
) -> tuple[
    dict[str, Query | LexicalQuery] | None,
    dict[str, Query | LexicalQuery] | None,
    dict[QueryAction, list[Query | LexicalQuery]] | None,
    dict[str, str]
]:
    """Instantiate queries and place them into convenient map structures.

    Args:
        requested_queries: List of validated built-in query IDs.
        external_module: Loaded external module reference, or None.
        external_classnames: List of class names in external module, or None.
        debug_arg: JSON object for debug query arguments, or None.

    Returns:
        Tuple of:
        - queries: Dictionary mapping query_id to built-in query instance.
        - custom_queries: Dictionary mapping query_id to custom query instance.
        - action2queries: Dictionary mapping QueryAction to list of query instances.
        - query_id2module_name: Dictionary mapping query_id to module name.
    """

    built_in_id2instance = {}  # only for builtin
    custom_id2instance = {} # only for custom
    action2queries = {} # for everything, including debug
    id2module = {} # for everything except debug

    if requested_queries:
        for (my_module, qry_map) in QUERY_MODULES:
            for qry_id in requested_queries:
                if qry_id in qry_map:
                    populate_maps_from_instance(
                        qry_id,
                        my_module,
                        id2instance=built_in_id2instance,
                        id2module=id2module,
                        action2queries=action2queries
                    )

    if external_classnames:
        for class_ in external_classnames:
            populate_maps_from_instance(
                qry_id=class_,
                my_module=external_module,
                id2instance=custom_id2instance,
                id2module=id2module,
                action2queries=action2queries
            )
    if debug_arg:
        instance = Detect(debug_arg)
        # add to self.queries, debug classname is 'Detect'
        built_in_id2instance['Detect'] = instance
        # add to action2queries
        populate_action2queries(action2queries, instance)

    return built_in_id2instance, custom_id2instance, action2queries, id2module

def populate_maps_from_instance(qry_id: str, my_module: Any,
                                id2instance: dict, id2module: dict,
                                action2queries: dict) -> None:
    """Populate query maps from a query instance.

    Args:
        qry_id: Query ID/class name.
        my_module: Module containing the query class.
        id2instance: Dictionary to add query instance to.
        id2module: Dictionary to add module mapping to.
        action2queries: Dictionary to add action mappings to.
    """
    qry_instance = getattr(my_module, qry_id)()
    id2instance[qry_id] = qry_instance
    id2module[qry_id] = my_module
    populate_action2queries(action2queries, qry_instance)


def populate_action2queries(action2queries: dict[QueryAction, list[LexicalQuery | Query]],
                            instance: Query | LexicalQuery | Detect) -> None:
    """Add query instance to action2queries map based on when_to_run.

    Args:
        action2queries: Dictionary mapping QueryAction to list of queries.
        instance: Query instance to add to the map.
    """
    for action in instance.when_to_run():
        if action not in action2queries:
            action2queries[action] = [instance]
        else:
            action2queries[action].append(instance)


def get_query_descriptions() -> str:
    """Get all descriptions for built-in queries.

    Returns:
        JSON string containing all built-in query descriptions.
    """
    descriptions = []
    for (my_module, qry_map) in QUERY_MODULES:
        if my_module is not queries.debug_query:
            for q_name in qry_map.keys():
                q_instance = getattr(my_module, q_name)()
                descriptions.append(q_instance.get_query_description())
    return json.dumps(descriptions, indent=4, cls=PresetEncoder)


def validate_qry_list(qry_list: list[str]) -> tuple[bool, list[str] | None, list[str] | None, list[str] | None]:
    """Verify that query list contains valid, case-insensitive query names.

    Args:
        qry_list: List of user-provided query IDs to validate.

    Returns:
        Tuple of (is_valid, found_list, missed_list, duplicates_list).
        - is_valid: True if all queries are valid and no duplicates.
        - found_list: List of matching legal query names (de-duplicated).
        - missed_list: List of unrecognized query names.
        - duplicates_list: List of duplicate query names in input.
    """
    query_keys = [x[1].keys() for x in QUERY_MODULES]
    found_tkns = []
    missed_tkns = []
    duplicates = []

    for tkn in qry_list:
        found = False
        for query_key in query_keys:
            match_ = case_insensitive_match(query_key, tkn)
            if match_ is not None:
                found = True
                if match_ not in found_tkns:
                    found_tkns.append(match_)
                else:
                    duplicates.append(query_key)
                break

        if not found:
            # tkn not found in any query key
            missed_tkns.append(tkn)

    valid = len(missed_tkns) == 0 and len(duplicates) == 0
    return valid, found_tkns, missed_tkns, duplicates

def build_preset_for_name(preset_name: str) -> Preset | None:
    """Build a Preset object for an internal preset name.

    Used by the CLI to describe an internal preset.

    Args:
        preset_name: Name of the preset to build.

    Returns:
        Preset object corresponding to this name, or None if not found.
    """
    queries_ = dict.get(PRESETS, preset_name, [])
    accum = set()
    if not queries:
        return None
    for (mod, query) in queries_:
        class_ = getattr(mod, query)
        accum.add(class_.get_query_description())


    return Preset(preset_name=preset_name,
                  preset_owner="Salesforce",
                  queries=accum)

def get_all_queries() -> list[str]:
    """Get list of all built-in query IDs.

    Does not return debug queries.

    Returns:
        List of all built-in query ID strings.
    """
    accum = []
    for x in QUERY_MODULES:
        if x[0] is not queries.debug_query:
            accum = accum + list(x[1].keys())

    return accum
