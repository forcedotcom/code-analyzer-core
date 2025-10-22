"""Performs symbolic execution and vulnerability analysis

  @author: rsussland@salesforce.com

The executor handles the element crawl and dispatches
query handlers and dataflow updates as appropriate
"""

from __future__ import annotations

import json
import logging
import os
import traceback
from typing import TYPE_CHECKING, Any, TypeAlias

import flow_parser.parse as parse
import flow_scanner.control_flow as crawl_spec
import public.parse_utils
from flow_scanner.branch_state import BranchState
from flow_scanner.control_flow import Crawler, ControlFlowGraph
from flow_scanner.flows import FlowVector
from flow_scanner.query_manager import QueryManager, QueryAction
from flow_scanner.util import Resolver
from public import parse_utils
from public.flow_scanner_exceptions import InvalidFlowException

if TYPE_CHECKING:
    from public.parse_utils import ET

from datetime import datetime

import flow_scanner.flows as flows

from flow_scanner import wire
from flow_scanner.flow_result import ResultsProcessor as Results

#: Controls whether subflows are followed or not, useful for debugging.
FOLLOW_SUBFLOWS: bool = True

#: When calling subflows, we store the input variables that go into the subflow.
#: If subflows are pure functions, then calling them repeatedly with the same inputs
#: should result in the same output. This is the Carnac prediction.
#: When trust carnac is set to true, we skip running subflows if there is a cached
#: invocation with the same dataflow inputs for the same subflow.
#:
#: To disable this behavior, set to False.
TRUST_CARNAC: bool = True

#: For testing purposes, we store outputs when re-running subflows and compare with
#: the carnac prediction to see if there is a match. We have run carnac extensively on
#: on the flow corpus in the try only mode before deciding to trust carnac in production.
TRY_CARNAC: bool = True

#: logger for current module
logger: logging.Logger = logging.getLogger(__name__)

# variables are identified by a tuple (flow_path, var name)
# as two flows can have the same variable.
var_g: TypeAlias = tuple[str, str]

# At each variable there is a vectorized data structure called
# 'FlowVector' that contains all dataflows influencing that variable
# at any point in program execution.
# Therefore, the global list of all dataflows at any point in program
# execution is dict[tuple[str,str], FlowVector]
flow_vec_g: TypeAlias = dict[var_g, FlowVector]


class Stack(object):
    """The Stack handles subflow invocation.

    When we pass to a subflow a new frame is pushed on the stack and when we
    return it is popped."""

    def __init__(self, root_flow_path: str, resolver: Resolver,
                 query_manager: QueryManager):
        """Constructor (can be used)

        Args:
            root_flow_path: current filename of flow being processed
            resolver: map[flow_name] -> flow_path of all files in scope
            query_manager: invokes queries and stores results

        Results:
            result instance object

        """

        #: tracks list of frames that need to be processed *after* current frame
        self.__frame_stack: list[Frame] = []

        #: stores frames that have been fully processed
        self.__collected_frames: list[Frame] = []

        #: subflows that have already been processed
        #: subflow name --> global Flow Vectors at program exit
        self.resolved_subflows: dict[str, flow_vec_g] = {}

        #: map from flow name to flow filepath (for subflow path lookup)
        self.resolver: Resolver = resolver

        #: current frame being processed

        self.current_frame: Frame = Frame.build(current_flow_path=root_flow_path,
                                                resolver=resolver,
                                                resolved_subflows=self.resolved_subflows,
                                                query_manager=query_manager)



        #: pointer to query manager so that it can be returned on exit
        self.query_manager: QueryManager = query_manager

    def pop(self) -> Frame | None:
        """Get next frame from stack

        Returns:
            frame or None if empty

        """
        if len(self.__frame_stack) > 0:
            return self.__frame_stack.pop(0)
        else:
            return None

    def push(self, frame: Frame):
        """Pushes a frame onto stack, call when invoking a subflow

        Args:
            frame: frame to push to the top of the stack

        Returns:
            None

        """
        self.__frame_stack.insert(0, frame)
        return

    def run(self) -> QueryManager:
        """Main entry point for symbolic execution of an initialized stack

        Returns:
            Query Manager object

        """
        while True:
            next_frame = self.current_frame.execute()

            if next_frame is not None and not self.is_circular_reference(next_frame):
                # we have a function call and need to store the current frame on the stack
                self.push(self.current_frame)
                self.current_frame = next_frame

            else:
                # save the (collected) frame
                self.__collected_frames.append(self.current_frame)

                # next frame is None, so grab the next frame from the stack
                next_frame = self.pop()
                if next_frame is None:
                    # nothing on the stack, so perform final queries
                    # and exit processing
                    all_states = _consolidate_collected_frames(self.__collected_frames)
                    # empty
                    self.__collected_frames = []
                    self.query_manager.final_query(all_states=all_states)
                    # delete old states

                    return self.query_manager

                else:
                    # we must be returning from a subflow..

                    # grab all the initial output flows and store them
                    all_outputs = self.current_frame.get_consolidated_output_vars()

                    # take return values of current frame and updates popped frame
                    # but filter out the generic entrypoints as we want flows from the parent
                    # (and possibly grandparent)
                    self.current_frame.update_parent_frame(
                        next_frame,
                        self.current_frame.state.filter_input_variables(all_outputs)
                    )

                    # now switch execution to new frame
                    self.current_frame = next_frame

    def is_circular_reference(self, next_frame: Frame) -> bool:
        """Checks if the next frame is in the previously
           processed frames.

        Args:
            next_frame: next frame to process

        Returns:
            True if the next frame is in the old frames
        """
        if next_frame is None:
            return False
        flow_path = next_frame.flow_path
        seen = False
        matching_frame = None
        # don't allow reference to something on the current stack
        # all_frames = self.__frame_stack + self.__collected_frames
        for f in self.__frame_stack:
            if flow_path == f.flow_path:
                seen = True
                matching_frame = f
                break

        if seen:
            logger.critical(f"found circular reference in {next_frame.flow_path}")
            self.query_manager.lexical_accept("CyclicSubflow",
                                              next_flow_path=flow_path,
                                              current_frame=self.current_frame,
                                              matching_frame=matching_frame,
                                              all_frames=self.__frame_stack)
        return seen


def add_inputs_to_call_cache(cache: dict[str, list[list[flow_vec_g]]],
                             sub_path: str,
                             val: flow_vec_g,
                             ) -> dict[str, list[list[flow_vec_g]]]:
    """Store input values to subflow in cache

    Args:
        cache: cached return values (subflow name -> flow_vec_g)
        sub_path: path of subflow
        val: input values to store

    Returns:
        updated cache

    """
    if cache is None:
        cache = {sub_path: [[val]]}

    elif sub_path not in cache:
        cache[sub_path] = [[val]]

    elif call_carnac(cache, val, subflow_path=sub_path, outputs=None) is None:
        # we've checked that the inputs are not already in the cache
        cache[sub_path].append([val])

    return cache


def add_outputs_to_call_cache(cache: dict[str, list[list[flow_vec_g]]],
                              inputs: flow_vec_g,
                              added: flow_vec_g,
                              flow_path: str) -> dict[str,list[list[flow_vec_g]]]:
    """Store return values of subflow in call cache

    Args:
        cache: cached subflow inputs and outputs
        inputs: inputs whose outputs are being added to cache
        added: vars to flow vectors to add to cache
        flow_path: filename of flow

    Returns:
        the updated cache

    """
    # outputs should only be added after inputs
    assert cache is not None and flow_path in cache
    res = call_carnac(input_cache=cache, vector_map=inputs, outputs=added, subflow_path=flow_path)
    assert res == added
    return cache


def call_carnac(input_cache: dict[str, list[list[flow_vec_g]]] | None,
                vector_map: flow_vec_g,
                subflow_path: str,
                outputs: flow_vec_g = None) -> flow_vec_g | None:
    """Predicts what the subflow will return

    Args:
        input_cache: cache of previous flow inputs
                     subflow_path ->[[input1, output1], [input2, output2], ]
        vector_map: subflow inputs being called now
        subflow_path: filepath of subflow to be called
        outputs: outputs to add

    Returns:
        output vector map (return values from subflow)

    """
    if input_cache is None or subflow_path not in input_cache:
        # Carnac not ready as cache is not populated yet
        return None

    cached_flows = input_cache[subflow_path] # a list of flow_vec_g

    for in_out_list in cached_flows:

        if vector_map == in_out_list[0]:
            # we are calling the flow with input variables that
            # are already in the cache
            if outputs is not None:
                assert len(in_out_list) == 1

                # add to input cache
                in_out_list.append(outputs)
                return outputs

            elif len(in_out_list) > 1:
                return in_out_list[1]

    return None


class Frame(object):
    """Frame is responsible for managing program analysis within a single flow.

    Execution happens along each branch, which is assigned a branch state
    and branching xml element (e.g. Loop element or Decision element)

    Branch management is via maintaining a worklist consisting of branches
    that need to be processed, with each branch a tuple (State, branch elem)

    The worklist is processed as a double-ended queue, with new branches
    to be processed appended to the end and the next branch to process
    pulled from the front.

    When a subflow element is encountered, the frame builds a child frame
    and returns it to the Stack.

        wire.wire_processor --> parses current_elem to obtain data influence
                                statements and wires these into the State's
                                influence map.

        query.query_processor --> looks for flows into sources and sinks
                                  in the current elem, and stores findings
                                  in result instance

    """

    def __init__(self, current_flow_path: str | None = None, resolver: Resolver = None):

        #: this is a map : `(local flow_name, namespaced flow_name)` -> `flow_path` so
        #: that when we encounter a subflow we can load the file
        self.resolver: Resolver = resolver

        #: placeholder for fast-forward scans (not currently used)
        self.resolved_subflows: dict[Any, Any] = {}

        #: path of flow we are working on, needed when labelling inputs/outputs
        self.flow_path: str = current_flow_path

        #: name of flow we are working on. Needed for loading subflows
        self.flow_name: str | None = None

        #: XML parser instance
        self.parser: parse.Parser | None = None

        #: supplies next element and branch-state to process
        self.crawler: Crawler | None = None

        #: Subflow XML element that launched this flow (can be None)
        self.parent_subflow: ET.Element | None = None

        #: binary semaphore so when we return, we don't execute spawn the subflow again
        self.child_spawned: bool = False

        #: query processor instance
        self.query_manager: QueryManager | None = None

        #: current state being processed
        self.state: BranchState | None = None

        #: Caches the results of calling a subflow:
        #: subflow_path -> [input flow map, output flow map].
        #:
        #: Ideally a cache would be represented as a dict: key -> stored value
        #: in this case (flow input dataflows -> flow output dataflows) but python
        #: doesn't support dicts of dicts, and we are not certain of the carnac
        #: assumption, e.g. that subflows are pure functions for purpose of our flow analysis
        #: so in theory we may have (input vars -> output vars1, output vars2, ...)
        #: Therefore we use a list, where the first entry is the input and all subsequent
        #: entries are output.
        #:
        #: Thus, a list of lists [[input1, outpu1], [input2, output2], ...]
        #:
        #: Ideally, there will be only one or two entries in each list entry.
        self.subflow_call_cache: dict[str, list[list[flow_vec_g]]] | None = None

        #: cache of output *variables* in the subflow
        #: subflow path -> [(path, var name)]
        self.subflow_output_variable_cache: dict[str, list[tuple[str, str]]] | None = None

        #: store prediction of subflow outputs in child frame (for testing only)
        self.prediction = None

        #: store inputs of subflow in child frame (testing only)
        self.inputs = None

        #: whether execution is async or no
        self.is_async: bool = False

    @classmethod
    def build(cls, current_flow_path: str | None = None,
              resolver: Resolver = None,
              resolved_subflows: dict[Any, Any] = None,
              parent_subflow: ET.Element = None,
              query_manager: QueryManager = None) -> Frame:
        """Call this whenever program analysis starts or a subflow is reached

        Args:
            current_flow_path: current path of flow
            resolver: Resolves subflows to be scanned
            resolved_subflows: subflows that have been already processed
            parent_subflow: current subflow element that spawned this
                frame
            query_manager: manages query instances

        Returns:
            new Frame

        """

        if current_flow_path is None:
            raise ValueError("called with null argument")

        frame = Frame(current_flow_path=current_flow_path, resolver=resolver)

        # store subflow resolutions
        frame.resolved_subflows = resolved_subflows

        # grab a pointer to the query manager
        frame.query_manager = query_manager

        # store pointer to subflow
        frame.parent_subflow = parent_subflow

        # grab pointer to parser, so we have a copy of each parser
        # after the Query Manager forgets it (Query Manager
        # persists across all frames) but we want to do analysis
        # over collected frames at the end of the file scan
        frame.parser = query_manager.parser

        frame.crawler = Crawler.from_parser(frame.parser)

        # create state and initialize
        frame.state = BranchState.from_parser(frame.parser)

        frame.state.current_elem = frame.parser.get_start_elem()
        return frame

    def update_parent_frame(self, parent_frame: Frame, output_vector_map) -> None:
        """Updates the provided parent frame with the return values of the current frame.

        * Query Manager updated to have new parser
        * New Influence Paths that flow into the output variables of the subflow are pushed
          into the parent.

        Args:
            output_vector_map: map from tuples to output vectors of the child subflow
            parent_frame: frame which spawned the current frame via a
                subflow

        Returns:
            None

        """
        if parent_frame is None or self.parent_subflow is None:
            raise RuntimeError("Attempted to update a null parent frame")

        # update query_manager so it has the correct parser
        self.query_manager.parser = parent_frame.parser

        subflow_output_vars = list(self.parser.output_variables) # convert frozenset to list
        if parent_frame.subflow_output_variable_cache is None:
            parent_frame.subflow_output_variable_cache = {self.flow_path: list(subflow_output_vars)}

        elif self.flow_path not in parent_frame.subflow_output_variable_cache:
            parent_frame.subflow_output_variable_cache[self.flow_path] = list(subflow_output_vars)

        output_variable_map = get_output_variable_map(subflow_elem=self.parent_subflow,
                                                      subflow_output_vars=subflow_output_vars)

        # update parent frame with new flows
        parent_frame.state.add_vectors_from_other_flow(src_flow_path=self.flow_path,
                                                       output_vector_map=output_vector_map,
                                                       src2tgt_variable_map=output_variable_map,
                                                       transition_elem=self.parent_subflow,
                                                       is_return=True)

        if TRY_CARNAC:
            prediction = self.prediction
            if prediction is None:
                logger.info("Have not seen these inputs before. Adding to cache.")
                parent_frame.subflow_call_cache = add_outputs_to_call_cache(parent_frame.subflow_call_cache,
                                                                            self.inputs,
                                                                            output_vector_map,
                                                                            self.flow_path)
            elif prediction is not None and prediction == output_vector_map:
                logger.info("Carnac is right!")
            else:
                logger.info("Carnac was wrong!")
                assert False

    """
           For influence path consolidation:
           Each frame will store several branches representing execution paths 
           depending on conditionals. When the subflow exits, all of these
           need to be consolidated influence map so all possible variable evaluations
           are propagated to the parent.
    """

    def get_consolidated_output_vars(self) -> dict[tuple[str, str], flows.FlowVector]:
        """get all output variable vectors from all terminal BranchStates.

        Call this method after flow processing has completed for a subflow
        in order to return all possible output variables to the parent.

        Returns:
            a map (flow_path, variable name) -> FlowVector

        """

        # grab from current state

        # store current crawl_step
        old_crawl_step = self.state.current_crawl_step

        terminal_steps = self.crawler.terminal_steps

        accum = []
        for step in terminal_steps:
            self.state.load_crawl_step(crawl_step=step, crawler=self.crawler)
            accum = accum + (self.state.get_all_output_vectors())

        # restore
        self.state.load_crawl_step(crawl_step=old_crawl_step, crawler=self.crawler)

        new_map = {}
        for t, flow_vector in accum:
            if t in new_map:
                # we've seen this vector before (in a previous branch) so add it
                new_map[t] = flow_vector.add_vector(new_map[t])
            else:
                new_map[t] = flow_vector

        return new_map

    def spawn_child_frame(self, subflow: ET.Element,
                          sub_path: str,
                          input_map: dict[str, str],
                          vector_map: dict[tuple[str, str], flows.FlowVector]
                          ) -> Frame:
        """Spawn a child frame when entering subflow.


        Function Call and Return
        ============================

        When exiting a function, only those influence elements that survive are the output
        variables. These are then mapped to variables in the calling flow based on assignments
        in the subflow element.

        Entering: we have a map (filename_parent, var_parent) --> (filename_child, var_child)
        Exiting: another map (filename_child, var_child) ---> (filename_parent, var_parent)

        To spawn:

            1. get path of child flow
            2. Build frame with Frame.build
            3. Wire the input flows into the child and add them to the child's state
            4. set self.child_spawned = True (so when we return, we don't spawn again!)
            5. return the new Frame.

        .. NOTE:: the parser object remembers all the sources and sinks from the parent
                  and these are available to the child as well (the old parser is propagated
                  to the child, as is the old result instance)

        Args:
            sub_path: filepath of subflow being called
            input_map: map of output variables in child to input variables of subflow elem in parent
            vector_map: map from tuple to the flow vectors that will be pushed into the child
            subflow: subflow xml element

        Returns:
            updated child frame ready to begin processing

        """
        # build a parser for new subflow, which inherits variable info
        new_parser = parse.Parser.from_file(filepath=sub_path, old_parser=self.parser)

        # assign to query manager
        self.query_manager.parser = new_parser

        new_frame = Frame.build(current_flow_path=sub_path,
                                resolver=self.resolver,
                                parent_subflow=subflow,
                                query_manager=self.query_manager
                                )

        new_frame.state.add_vectors_from_other_flow(src_flow_path=self.flow_path,
                                                    output_vector_map=vector_map,
                                                    src2tgt_variable_map=input_map,
                                                    transition_elem=subflow)
        # propagate crawl history to child
        history = self.crawler.get_crawler_history_unsafe()
        last_index = self.crawler.get_current_step_index()-1 # index always points to *next* step

        if history is None:
            new_history = [(self.crawler, last_index)]
        else:
            new_history = history.insert(0, (self.crawler, last_index))

        new_frame.crawler.crawler_history = new_history

        self.child_spawned = True
        return new_frame

    def handle_subflows(self, current_elem: ET.Element) -> Frame | None:
        """Checks whether we have encountered a subflow elem.

        Different behavior required if we are returning from the element or entering into it.

        Args:
            current_elem: Flow element to check

        Returns:
            new Frame in case we are entering a new subflow, or None in
            case we are returning from the subflow.

        """

        if not FOLLOW_SUBFLOWS:
            # For testing/debugging, turn off FOLLOW_SUBFLOWS
            return None

        if self.child_spawned:
            # we are re-entering from a function call so update info and return:

            self.child_spawned = False
            return None

        elif parse_utils.is_subflow(current_elem):
            return self.process_subflow(current_elem)
        else:
            return None

    def execute(self) -> Frame | None:
        """Performs symbolic execution on the Frame.

        Returns:
            new Frame to process in case a subflow has been launched,
            and finally returning None when the Frame's processing is complete.

        """

        # once, we run queries at flow start:
        self.query_manager.lexical_query(parser=self.parser, crawler=self.crawler)
        self.query_manager.query(action=QueryAction.flow_enter, state=self.state, crawler=self.crawler)

        while True:

            crawl_step = self.state.load_crawl_step(self.crawler)

            if crawl_step is None:
                # we are done processing this flow
                return None

            # Now we have an element loaded and can proceed
            report(self.state, self.crawler.current_step, self.crawler.total_steps)

            # Look for variable assignments and update flows
            wire.wire(self.state, self.state.current_elem)

            # must be done *after* wiring.
            self.query_manager.query(action=QueryAction.process_elem, state=self.state)

            # follow subflows if necessary
            child_frame = self.handle_subflows(self.state.current_elem)

            if child_frame is not None:
                # child frame only returned if handling a subflow element
                return child_frame


    def process_subflow(self, current_elem):

        # If there is a problem, we return None and the parent
        # continues on as if the subflow did not exist

        try:
            sub_name = parse_utils.get_subflow_name(current_elem)
            sub_path = self.resolver.get_subflow_path(sub_name=sub_name, flow_path=self.flow_path)

            assert sub_path != self.flow_path

            if sub_path is None:
                # We can't find the path of the sub flow, so don't process
                logger.critical(f"No subflow path found for subflow {sub_name} "
                                f"called in flow {self.flow_path}")
                return None

            # parent variable name --> child input variable name
            input_map = public.parse_utils.get_subflow_input_map(current_elem)

            # this is the vector map we want to push into the child:
            vector_map = {(self.flow_path, x): self.state.get_or_make_vector(x) for x in input_map}

            prediction = call_carnac(input_cache=self.subflow_call_cache,
                                     vector_map=vector_map,
                                     subflow_path=sub_path,
                                     outputs=None)

            if TRY_CARNAC:
                # add inputs to cache:
                self.subflow_call_cache = add_inputs_to_call_cache(self.subflow_call_cache,
                                                                   sub_path,
                                                                   vector_map)
            if TRUST_CARNAC is True and prediction is not None:
                output_variable_map = get_output_variable_map(
                    subflow_elem=current_elem,
                    subflow_output_vars=self.subflow_output_variable_cache[sub_path]
                )

                # wire cached output variables to this influence map
                self.state.add_vectors_from_other_flow(src_flow_path=sub_path,
                                                       output_vector_map=prediction,
                                                       src2tgt_variable_map=output_variable_map,
                                                       transition_elem=current_elem)

                logger.info("fast forwarded through subflow as it was already invoked with the same input vars")

                return None

            else:
                print(f"\tprocessing subflow {sub_path}.. ")

                child_frame = self.spawn_child_frame(subflow=current_elem,
                                                     sub_path=sub_path,
                                                     input_map=input_map,
                                                     vector_map=vector_map)

                child_frame.inputs = vector_map

                child_frame.prediction = prediction

                return child_frame

        except Exception:
            logger.critical("Error processing subflow:\n" + traceback.format_exc())
            return None


def parse_flow(flow_path: str,
               requestor: str = None,
               report_label: str = None,
               result_id: str = None,
               service_version: str = None,
               help_url: str = None,
               query_module_path: str = None,
               query_class_name: str = None,
               query_preset: str = None,
               optional_queries: list[str] | None = None,
               query_manager: QueryManager | None = None,
               crawl_dir: str = None,
               resolver: Resolver = None,
               debug_query: str | None = None) -> QueryManager:
    """Main loop that performs control and dataflow analysis

    Args:
        flow_path: path (on filesystem) of flow-meta.xml file
        requestor: email address of scan recipient (optional)
        report_label: human-readable name for report (optional)
        result_id: id of report (for use in a jobs management system) (optional)
        service_version: version of jobs management system (optional)
        help_url: url to display on report for more info about results (optional)
        query_module_path: path of module where custom queries are stored
        query_class_name: name of query class to instantiate
        query_preset: name of preset to run
        optional_queries: list of optional queries to run
        query_manager: existing instance that invokes queries across entire run. Start with None
                       and one will be created.
        crawl_dir: directory of where to store crawl specifications
        resolver: used for looking up flow paths of subflows
        debug_query (str): pass this string to the query_manager constructor

    Returns:
        instance of ger_report.Result class that can be used to generate reports
        or passed to other flows.
    """

    # build parser
    parser = parse.Parser.from_file(filepath=flow_path)

    if crawl_dir is not None:
        cfg = ControlFlowGraph.from_parser(parser)
        schedule = crawl_spec.get_crawl_data(cfg)
        cleaned_path = flow_path.replace(os.sep, "_")

        with open(os.path.join(crawl_dir, f"{cleaned_path}__crawl_schedule.json"),
                  'w') as fp:
            json.dump(schedule, fp, cls=crawl_spec.CrawlEncoder, indent=4)

        with open(os.path.join(crawl_dir, f"{cleaned_path}_cfg.json"), 'w') as fp:
            crawl_spec.dump_cfg(cfg, fp)

    if query_manager is None:
        # 1. build result processor
        results = Results(requestor=requestor, report_label=report_label,
                          result_id=result_id, service_version=service_version,
                          help_url=help_url)
        results.scan_start = str(datetime.now())[:-7]

        # 2. build parser. This will also populate basic data
        parser = parse.Parser.from_file(filepath=flow_path)

        # 3. build query manager
        query_manager = QueryManager.build(results=results,
                                           parser=parser,
                                           requested_preset=query_preset,
                                           additional_queries=optional_queries,
                                           module_path=query_module_path,
                                           class_name=query_class_name,
                                           debug_query=debug_query)
    else:
        # we are continuing a run, so update parser to work on new file
        query_manager.parser = parser

    # build stack
    try:
        stack = Stack(root_flow_path=flow_path,
                      resolver=resolver,
                      query_manager=query_manager)
    except InvalidFlowException:
        logger.error(f"Error parsing flow {flow_path}, skipping")
        return query_manager

    # run program
    query_manager = stack.run()

    # update scan end time
    query_manager.results.scan_end = str(datetime.now())[:-7]

    # return back to __main__, which may scan again with another file
    return query_manager


def report(state: BranchState, current_step: int, total_steps: int) -> None:
    # TODO: this will be made pretty later
    msg = (f"flow: {state.flow_name}"
           f"step: {current_step}"
           f"total steps: {total_steps}"
           f"branch: {state.current_crawl_step.visitor}"
           f"elem name: {state.get_current_elem_name()}")
    logger.debug(msg)


def get_output_variable_map(subflow_elem: ET.Element, subflow_output_vars: list[var_g]) -> dict[str, str]:
    # output_variable_map: child name --> parent name the child influences
    auto, output_variable_map = public.parse_utils.get_subflow_output_map(subflow_elem)
    if auto:
        # the output variable map will not be populated if auto is True,
        # so populate it now with output_var_name (in source) -> subflow_name.name (in parent)
        subflow_name = parse_utils.get_name(subflow_elem)
        for (path, name_) in subflow_output_vars:
            output_variable_map[name_] = f"{subflow_name}.{name_}"

    return output_variable_map


def _consolidate_collected_frames(old_frames: list[Frame]) -> tuple[BranchState,]:
    to_return = []
    for frame in old_frames:
        to_keep = list(frame.crawler.terminal_steps)
        frame.state.filter_maps(steps=to_keep)
        to_return.append(frame)
    return tuple(to_return)


def report_map(vec_map: flow_vec_g) -> str:
    return '\n'.join([x.short_report() for x in vec_map.values()])
