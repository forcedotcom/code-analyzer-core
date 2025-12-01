"""Module to generate control flow graphs and crawl schedules

"""
from __future__ import annotations

import dataclasses
import json
import logging
import traceback
from collections.abc import Generator
from dataclasses import dataclass, field
from typing import TypeAlias, TYPE_CHECKING
import public.custom_parser as CP

import flow_parser.parse as parse
import flow_scanner.util as util
from flow_parser.parse import Parser
from public import parse_utils
from public.contracts import AbstractSegment, AbstractControlFlowGraph, AbstractCrawler, FlowParser
from public.data_obj import BranchVisitor, CrawlStep, Jump, JSONSerializable
from public.enums import ConnType
from public.flow_scanner_exceptions import InvalidFlowException
from public.parse_utils import (get_name, get_conn_target_map,
                                is_subflow, is_loop, get_tag)

El: TypeAlias = CP.ET.Element

if TYPE_CHECKING:
    # False at run time, only for type checker
    from _typeshed import SupportsWrite

MAX_VISITS_PER_SEGMENT = 20

logger = logging.getLogger(__name__)

# a tuple of (flow filename, flow element name)
var_t: TypeAlias=tuple[str, str]

# (element name, element tag)
el_t: TypeAlias=tuple[str, str]

@dataclass(frozen=True, eq=True, slots=True)
class Segment(JSONSerializable, AbstractSegment):
    # name of element at the start of the segment (jump target)
    label: str

    # list of (element names, element tags) (including label) in this segment (in order)
    traversed: list[el_t]

    # list of traversal indexes that are subflow elements
    subflows: list[int]

    # connectors at the end of this segment. Empty list if no jumps.
    jumps: list[Jump]

    # whether this segment may end execution
    is_terminal: bool

    # is multiple-inbound
    is_multiple_inbound: bool=False

    # label ->
    seen_tokens: dict[str, list[tuple[tuple[str,str], ...]]] = field(default_factory=dict)


    def accept(self, visitor: BranchVisitor) -> list[BranchVisitor] | None:
        """does the node accept the visitor

        Also updates visitor state

        Args:
            visitor: Branch Visitor trying to jump into node

        Returns:
            list of labels to process or None

        """
        if not self.jumps:
            return None

        prev_label = visitor.previous_label

        if prev_label in self.seen_tokens and visitor.token in self.seen_tokens[prev_label]:
            return None

        # We must allow one cycle to traverse loops fully
        count, cycle = util.find_cycles(target=self.label, history=visitor.history)
        if count > 1 or (count == 1 and len(cycle) == 1):
            return None
        else:
            if prev_label in self.seen_tokens:
                self.seen_tokens[prev_label].append(visitor.token)
            else:
                self.seen_tokens[prev_label] = [visitor.token]
            return self._send_outbound(visitor)


    def _send_outbound(self, visitor):
        jumps = self.jumps

        to_return = []
        loop_context = visitor.loop_context or tuple()

        if visitor.history is None:
            visitor.history = tuple()

        history = visitor.history + (self.label,)

        for jmp in jumps:
            current_label = jmp.target
            previous_label = self.label

            if jmp.is_loop:
                # we are entering a loop context
                loop_context = loop_context + ((jmp.src_name,ConnType.Loop),)

            if jmp.is_fault:
                loop_context = loop_context + ((jmp.src_name, ConnType.Exception),)

            if jmp.is_no_more_values:
                # exiting loop context
                z = _right_find(my_iter=loop_context, val_to_find=ConnType.Loop)
                if z == -1:
                    logger.critical("Found a loop exit without loop entrance")
                    continue
                else:
                    # remove everything before the entrance to the loop
                    loop_context = loop_context[:z]

            if self.is_multiple_inbound:
                new_token = visitor.token

                to_add = (visitor.previous_label, visitor.current_label)
                if visitor.token is None:
                    new_token = (to_add,)

                elif to_add not in visitor.token:
                    new_token = (to_add,) + visitor.token

                outbound_to_add = dataclasses.replace(visitor,
                                                 token=new_token,
                                                 current_label=current_label,
                                                 previous_label=previous_label,
                                                 history=history,
                                                 loop_context=loop_context
                                                 )
            else:
                outbound_to_add = dataclasses.replace(visitor,
                                                 current_label=current_label,
                                                 previous_label=previous_label,
                                                 history=history,
                                                 loop_context=loop_context
                                                 )

            to_return.append(outbound_to_add)
        return to_return

    # noinspection PyTypeChecker
    @classmethod
    def build_from_parser(cls, parser: parse.Parser, start_elem: El) -> Segment:
        """Build a segment starting at this element

        Args:
            parser: flow parser instance
            start_elem: first element in this segment

        Returns:
            segment
        """
        inbound_map = parser.get_traversable_inbound()
        label = get_name(start_elem)
        if label is None:
            pass
        if len(inbound_map[label]) > 1:
            is_multiple_inbound = True
        else:
            is_multiple_inbound = False

        elem = start_elem
        elem_name = get_name(elem)
        elem_tag = get_tag(elem)

        # elements traversed within this segment
        traversed = [(elem_name, elem_tag)]
        # outbound jumps
        subflows = []
        index = 0

        while True:
            try:
                jumps, is_terminal = get_jumps_and_terminal(elem_name, elem_tag, elem)

                if is_subflow(elem):
                    subflows = [index]

                if len(jumps) == 1 and elem_tag != 'loops' and not is_terminal:
                    # now check that the next elem has only one inbound
                    next_elem = parser.get_by_name(jumps[0].target)
                    next_name = get_name(next_elem)

                    # some flows are missing target elements even
                    # though the target is specified in the connector. WTF.
                    if next_name in inbound_map:
                        next_inbound = inbound_map[next_name]
                    else:
                        next_inbound = []

                    if len(next_inbound) == 1:
                        # we continue in the segment
                        elem = next_elem
                        elem_name = next_name
                        elem_tag = get_tag(elem)

                        assert (elem_name, elem_tag) not in traversed
                        traversed.append((elem_name, elem_tag))
                        index += 1
                        continue

                return Segment(label=label,
                               subflows=subflows,
                               traversed=traversed,
                               jumps=jumps,
                               is_multiple_inbound=is_multiple_inbound,
                               is_terminal=is_terminal
                               )
            except:
                logger.critical(f"Could not crawl flow {parser.get_filename()} {traceback.format_exc()}")
                raise InvalidFlowException("Could not crawl flow", flow_path=parser.get_filename())


def get_jumps_and_terminal(el_name: str, el_tag:str, elem: El) -> tuple[list[Jump], bool]:
    """Return list of jumps for this element, is_terminal (bool)"""

    jumps = []
    conns = get_conn_target_map(elem)

    if not conns:
        # no outbound connectors means the element is terminal
        return jumps, True

    if is_loop(elem):
        no_more_seen = False
        # loops will be terminal without a noMoreValues connector
        for key, val in conns.items():
            conn_tag = get_tag(key)
            if conn_tag == 'noMoreValuesConnector':
                is_no_more = True
                no_more_seen = True
            else:
                is_no_more = False

            jumps.append(Jump(src_name=el_name,
                              target=val[0],
                              is_goto=val[1] is ConnType.Goto,
                              is_loop=is_no_more is False,
                              is_no_more_values=is_no_more,
                              is_fault=False
                              )
                         )
        # If the loop does not have a noMoreValuesConnector, then it is terminal
        jumps.sort(key=lambda x: x.priority())
        return jumps, no_more_seen is False

    for key, val in conns.items():
        jumps.append(Jump(src_name=el_name,
                          is_goto=val[1] is ConnType.Goto,
                          target=val[0],
                          is_loop=False,
                          is_no_more_values=False,
                          is_fault=val[1] is ConnType.Exception))


    jumps.sort(key=lambda x: x.priority())

    # Now we need to decide if the element is terminal.
    #
    # If a decision
    is_terminal = False
    if el_tag == 'decisions':
        is_terminal = next((x for x in conns.keys() if get_tag(x) == 'defaultConnector'), False) is False

    elif len(conns) == 1 and list(conns.values())[0][1] is ConnType.Exception:
        # we may also have the case where the only outbound connector is a faultHandler
        is_terminal = True

    return jumps, is_terminal


@dataclass(frozen=True, eq=True, slots=True)
class ControlFlowGraph(JSONSerializable, AbstractControlFlowGraph):
    # where to start
    start_label: str

    # map from segment label -> inbound jumps
    inbound: dict[str, list[Jump]]

    # label -> segment
    segment_map: dict[str, Segment]

    @classmethod
    def from_parser(cls, parser: parse.Parser):
        start_elem = parser.get_start_elem()
        start_label = get_name(start_elem)
        visited_labels = []
        visited_elems = []
        segment_map = {}
        to_visit = [start_elem]

        # segment label -> jumps that reach it
        inbound_jumps = {}
        while len(to_visit) > 0:

            curr_elem = to_visit.pop(0)
            curr_segment = Segment.build_from_parser(parser=parser, start_elem=curr_elem)
            curr_name = curr_segment.label
            segment_map[curr_name] = curr_segment

            # add segment label to visited
            if curr_segment.label not in visited_labels:
                visited_labels.append(curr_segment.label)
                visited_elems = visited_elems + curr_segment.traversed

            # update to_visit with new jumps
            for jmp in curr_segment.jumps:
                tgt = jmp.target

                tgt_elem = parser.get_by_name(tgt)

                # handle case of missing targets in malformed flows
                if tgt_elem is None:
                    continue

                if tgt not in visited_labels and tgt_elem not in to_visit:
                    to_visit.append(tgt_elem)
                    inbound_jumps[tgt] = [jmp]
                else:
                    inbound_jumps[tgt].append(jmp)

        return ControlFlowGraph(start_label=start_label,
                                inbound=inbound_jumps,
                                segment_map=segment_map)

def get_crawl_data(cfg: ControlFlowGraph) -> \
        tuple[tuple[CrawlStep, ...],
         tuple[CrawlStep, ...],
         dict[str, list[CrawlStep]]]:
    """Builds crawl schedule

    Args:
        cfg: Control Flow Graph

    Returns:
        (tuple of crawl steps, tuple of terminal steps, dict of element to list of crawl steps)

    """

    generator = _crawl_iter(cfg)
    crawl_steps = []
    terminal_steps = []
    el_2_cs = dict() # mapping el_name to list of crawl steps
    step = 0

    for (visitor, segment) in generator:

        if segment.is_terminal:
            el = segment.traversed[-1][0]
            tag = segment.traversed[-1][1]
            cs = CrawlStep(
                    step=step + len(segment.traversed) - 1,
                    visitor=visitor,
                    element_name=el,
                    element_tag=tag,
                    local_index= len(segment.traversed) - 1
                )

            terminal_steps.append(cs)

        for local_index, (el_name, el_tag) in enumerate(segment.traversed, start=0):
            cs = CrawlStep(
                    step=step,
                    visitor=visitor,
                    element_name=el_name,
                    element_tag=el_tag,
                    local_index=local_index
                )

            crawl_steps.append(cs)

            vals = el_2_cs.get(el_name, None)
            if vals is None:
                el_2_cs[el_name] = [cs]
            else:
                vals.append(cs) # noqa

            step += 1

    return tuple(crawl_steps), tuple(terminal_steps), el_2_cs

def get_visits_statistics(visit_map: dict[str, list[Jump] | None], cfg: ControlFlowGraph):
    # first check that every label has been visited:
    missed = []
    for label in cfg.segment_map:
        if len(visit_map[label]) == 0:
            print(f"not visited: {label}")
            missed.append(label)

    # check that every jump has been traversed:
    missing_inbound = []
    inbound = cfg.inbound
    for label in inbound:
        label_visits = visit_map[label]
        try:
            visit_tuples = {(x.current_label, cfg.segment_map[x.previous_label].traversed[-1][0]) for x in label_visits
                            if x.previous_label is not None}
            inbound_tuples = {(x.target, x.src_name) for x in inbound[label]}
        except:
            print(f"{traceback.format_exc()}")
            raise
        for inbound_t in inbound_tuples:
            if inbound_t not in visit_tuples:
                missing_inbound.append(inbound_t)
    if len(missing_inbound) > 0:
        [print(f"missing inbound jumps: {x}") for x in missing_inbound]

    # get total number of visits:
    all_visits = 0
    for visit in visit_map.values():
        all_visits = all_visits + len(visit)

    all_inbound = 0
    for x in cfg.inbound.values():
        all_inbound = all_inbound + len(x)

    report_str = (f"total number of visits: {all_visits}\n"
                  f"total number of visits per node: {all_visits / len(visit_map)}\n"
                  f"total number of visits per inbound: {all_visits / max(all_inbound, 1)}\n"
                  f"total number of missed inbound: {len(missing_inbound)}")

    return missed, missing_inbound, report_str


def _get_crawl_visits(cfg: ControlFlowGraph) -> dict[str, list[BranchVisitor]]:
    """For testing and analysis.

    Args:
        cfg: control flow graph

    Returns:
        map from label to BranchVisitor
    """
    # for testing and analysis
    # initialize visits
    visits = {label: [] for label in cfg.segment_map.keys()}
    visits[cfg.start_label] = [BranchVisitor(cfg.start_label, previous_label=None)]

    for visitor, segment_names in _crawl_iter(cfg=cfg):
        visits[visitor.current_label].append(visitor)

    return visits


def _crawl_iter(cfg: ControlFlowGraph) -> Generator[tuple[BranchVisitor, Segment], None, None]:
    """crawls CFG

    Args:
        cfg: control flow graph

    Yields:
        current Branch visitor (that points to the current segment),
        the segment (list of flow elements to process, and outgoing visitors)
    """

    label = cfg.start_label
    visitor = BranchVisitor(label, previous_label=None)
    worklist = []
    visitor_counts = {}
    visited_jumps = []

    while len(worklist) > 0 or visitor is not None:
        if visitor is None and len(worklist) > 0:
            # nowhere to jump, so pull from worklist, but pull intelligently to prioritize
            # unvisited edges. If no edge is unvisited, then pick the first element in the list
            x = next((x for x in enumerate(worklist)
                        if (x[1].previous_label, x[1].current_label) not in visited_jumps),
                     (0, worklist[0])
                )

            worklist.pop(x[0])
            visitor = x[1]

        curr_label = visitor.current_label
        prev_label = visitor.previous_label
        visited_jumps.append((prev_label, curr_label))

        # skip orphaned references
        if curr_label not in cfg.segment_map:
            visitor = None
            continue

        # emergency brake
        if curr_label not in visitor_counts:
            visitor_counts[curr_label] = 1
        else:
            visitor_counts[curr_label] += 1
            if visitor_counts[curr_label] > MAX_VISITS_PER_SEGMENT:
                logger.info(f"Attempting to visit {curr_label} {visitor_counts[curr_label]} "
                                f"times, stopping this visitor.")
                visitor = None
                continue

        segment = cfg.segment_map[visitor.current_label]

        yield visitor, segment

        next_visitors = segment.accept(visitor)

        if next_visitors is None or len(next_visitors) == 0:
            visitor = None

        else:
            # depth-first search so take first branch and assign as current
            visitor = next_visitors[0]

            # Add to worklist if not already in worklist
            for i in range(1, len(next_visitors)):
                if next_visitors[i] not in worklist:
                    worklist.append(next_visitors[i])




def _find_segments_with_elem(val: str, segment_map: dict[str, Segment]) -> list[tuple[str, Segment, int]]:
    """Find segments that also contain an element.

    Args:
        val: string name of element
        segment_map: label -> segment

    Returns:

        * list of segments that have this element along with their label
          and the index of the found element in the form
          (label, segment, dupe_index)

        * Empty set if no segments found

    """
    if segment_map is None or len(segment_map) == 0:
        return []

    to_return = []
    for label, seg in segment_map.items():
        if seg.traversed is None or len(seg.traversed) == 0:
            continue
        # Note segment gen. algorithm doesn't allow a value to appear
        # more than once in the traversed history
        for index, dupe_tuple in enumerate(seg.traversed):
            if dupe_tuple == val:
                to_return.append((label, seg, index))
                break

    return to_return

class CrawlEncoder(json.JSONEncoder):
    def default(self, obj):
        if (isinstance(obj, JSONSerializable) or isinstance(obj, BranchVisitor)
                or isinstance(obj, CrawlStep)):
            return obj.to_dict()
        else:
            return json.JSONEncoder.default(self, obj)


class Crawler(AbstractCrawler):
    """Class representing the crawl of a graph

    """

    def __init__(self, total_steps: int, cfg: ControlFlowGraph,
                 crawl_schedule: tuple[CrawlStep,...],
                 terminal_steps: tuple[CrawlStep,...],
                 history_maps: dict[tuple[tuple[str, str], ...], CrawlStep] | None,
                 flow_path: str,
                 el_2_cs: dict[str, list[CrawlStep]] | None = None):
        """Constructor

        .. WARNING:: For module use only

        Args:
            total_steps: how many steps in crawl
            cfg: control flow graph
            crawl_schedule: tuple of :class:`public.data_obj.CrawlStep` in order of execution
            terminal_steps: tuple of :class:`public.data_obj.CrawlStep`
                            that can end program (note, *not* in any specific order)
        """
        #: int current step of crawl
        self.current_step: int = 0

        #: int total number of steps
        self.total_steps: int = total_steps

        #: control flow graph
        self.cfg: ControlFlowGraph = cfg

        #: tuple(:ref:`public.data_obj.CrawlStep`) all crawl steps in order of execution
        self.crawl_schedule: tuple[CrawlStep, ...] = crawl_schedule

        #: tuple(:ref:`public.data_obj.CrawlStep`) steps that can terminate the program
        self.terminal_steps: tuple[CrawlStep, ...] = terminal_steps

        #: crawl_step -> last seen ancestor
        self.history_maps: dict[tuple[tuple[str, str], ...], CrawlStep] = history_maps or {}

        #: previous subflow/action elements that spawned the current crawler.
        # None if this is the first. if we are 3 frames deep, this is descending order:
        #       history = [(parent_subflow, parent_path), (grandparent_subflow, grandparent_path), ...]
        self.subflow_parents: list[tuple[El, str]] | None = None

        #: file path
        self.flow_path: str | None = flow_path

        #: map from element to all crawl_steps in which it has been crawled
        self.el_2_cs: dict[str, list[CrawlStep]] | None = el_2_cs

        #: traversable elem name -> list of other elements that point to it
        self.traversable_inbound: dict[str, list[str]] | None = None

        #: all traversable element tuples (names, tags) connected to the start
        self.crawlable_elem_tuples: list[tuple[str, str]] | None = None

    @classmethod
    def from_parser(cls, parser: parse.Parser):
        """Builds a crawl schedule (recommended builder)

        Args:
            parser: :obj:`flow_parser.parse.Parser` instance

        Returns:
            :obj:`Crawler` instance

        """
        cfg = ControlFlowGraph.from_parser(parser)
        crawl_schedule, terminal_steps, el_2_cs = get_crawl_data(cfg)
        total_steps = len(crawl_schedule)

        return Crawler(
            total_steps=total_steps,
            cfg=cfg,
            crawl_schedule=crawl_schedule,
            terminal_steps=terminal_steps,
            history_maps=None,
            flow_path=parser.flow_path,
            el_2_cs=el_2_cs
        )

    def get_crawl_schedule(self)->tuple[CrawlStep, ...]:
        return self.crawl_schedule

    def get_flow_path(self) -> str | None:
        return self.flow_path

    def get_subflow_parents(self) -> list[tuple[El, str]]:
        """READ ONLY

        Returns:
            history of crawlers encountered during crawl, together with the current step (int)
            when they entered a child flow.
        """
        return self.subflow_parents

    def get_cfg(self)-> ControlFlowGraph:
        return self.cfg

    def get_current_step_index(self)->int:
        """Retrieve current crawl step (read-only)"""
        return self.current_step


    def load_crawl_step(self) -> CrawlStep | None:
        """Retrieve the current crawl step and advance counter (irreversible)

        Returns:
            :obj:`public.data_obj.BranchVisitor` and flow element name to process

        """
        if self.current_step >= self.total_steps:
            return None
        else:
            to_return = self.crawl_schedule[self.current_step]
            self.history_maps[to_return.visitor.history] = to_return
            self.current_step += 1
            return to_return


    def get_last_ancestor(self, crawl_step) -> CrawlStep | None:
        """Get latest ancestor branch that was last visited at crawl_step

        Useful for knowing which influence map to clone

        Args:
            crawl_step: step whose history is sought

        Returns:
            CrawlStep instance or None

        """
        history = crawl_step.visitor.history

        # first check if we are moving forward or if we need to backtrack

        res = None
        while res is not None:
            res = dict.get(self.history_maps, history, None)
            if len(history) == 0:
                break
            else:
                history = history[:-1]
        if res is None:
            # not present
            return None
        else:
            return res

    def get_elem_to_crawl_step(self, elem_name: str) -> list[CrawlStep]:
        """returns a list of all crawl steps in which this element has been visited
         during the crawl of this flow. If not visited, the empty list is returned.

        Args:
            elem_name (str): element name (use '*' for the start element)

        Returns:
            list of :obj:`CrawlStep` instances that visit this element

        """
        if self.el_2_cs is None:
            logger.error(f"requested element to crawlstep but "
                         f"the map has not been set for the crawler at {self.flow_path}")
            return []
        else:
            return dict.get(self.el_2_cs, elem_name, list())

    def get_crawlable_elem_tuples(self) -> list[tuple[str, str]] | None:
        """Returns all traversable element name, tag tuples that are connected to the start element
        """
        if self.crawlable_elem_tuples is None:
            accum = []
            for seg in self.cfg.segment_map.values():
                accum = accum + seg.traversed

            self.crawlable_elem_tuples = accum
        return self.crawlable_elem_tuples

    def get_call_chain(self, source_el: El, source_path: str,
                       sink_el: El, source_parser: FlowParser) -> list[tuple[El, str]] | None:
        """sink_el must be in the current flow. source_el can be in an ancestor
        flow. Only returns paths currently crawled, so this must be called
        every time a specific frame is loaded.

        Returns:
            A list starting with the source and ending with the sink in which the each is an
            ancestor caller of the succeeding element.
            [(element, element flow path)]

        """
        source_el_tag = parse_utils.get_tag(source_el)
        source_el_name = parse_utils.get_name(source_el)
        sink_el_name = parse_utils.get_name(sink_el)

        if source_el_tag in parse_utils.START_ELEMS:
            local_source_influenced = [x[0] for x in self.get_crawlable_elem_tuples()]
        else:
            local_source_influenced = source_parser.get_traversable_descendents_of_elem(source_el_name)

        if not local_source_influenced:
            return None

        if source_path == self.flow_path:
            if sink_el_name in local_source_influenced:
                if sink_el_name == source_el_name:
                    return [(source_el, source_path)]
                else:
                    return [(source_el, source_path), (sink_el, source_path)]
            else:
                return None

        else:
            # sink is in a subflow of the source
            if not self.subflow_parents:
                return None

            reversed_subs = list(reversed(self.subflow_parents))
            subs_start_in_src = [(index, sub_entry) for
                                 (index, sub_entry) in enumerate(reversed_subs)
                                 if (sub_entry[1] == source_path and parse_utils.get_name(sub_entry[0]) in local_source_influenced)]

            if not subs_start_in_src:
                return None
            else:
                # take last one, which is the shortest path of subflow calls
                # from source to current location
                index, x = subs_start_in_src[-1]
                result_path = reversed_subs[index:] + [(sink_el, self.flow_path)]
                return result_path


def dump_cfg(cfg: ControlFlowGraph, fp: SupportsWrite[str]) -> None:
    """Writes to file pointer

    Args:
        cfg (ControlFlowGraph): graph to serialize (JSON)
        fp (TextIO): file pointer:

    Returns:
        None

    """
    json.dump(cfg, indent=4, fp=fp, cls=CrawlEncoder)

def validate_cfg(cfg: ControlFlowGraph,
                 parser: parse.Parser, missing_only=False) -> list[tuple[str, str]] | bool:

    # check that all elements are covered exactly once:
    all_elems = parser.get_all_traversable_flow_elements()
    all_elem_tuples = [(get_name(x), get_tag(x)) for x in all_elems]
    crawled_elems = []

    for segment in cfg.segment_map.values():
        crawled_elems = crawled_elems + segment.traversed

    # ..check there are elements not in the cfg
    missing = [x for x in all_elem_tuples if x not in crawled_elems]

    # make sure this is not a disconnected flow:
    inbound = parser.get_traversable_inbound()
    is_disconnected = next((x is not None for x in inbound if
                            (not inbound[x] and x != '*')), False)
    if is_disconnected is True:
        not_orphaned = []
    else:
        not_orphaned = missing

    if missing_only:
        return not_orphaned

    else:
        # continue to gather other statistics
        counts = {x: crawled_elems.count(x) for x in crawled_elems}

        # ..check there are no duplicates
        duplicates = [x for x in crawled_elems if counts[x] > 1]

        if len(duplicates) != 0 or len(not_orphaned) != 0:
            valid = False
            print("invalid crawl info")
            for x in duplicates:
                print(f"duplicate: {x}")
            for x in not_orphaned:
                # some flows include disconnected elements that can't be crawled.
                print(f"caution missing element found: {x}")
        else:
            valid = True

        return valid

def _get_connector_map(elem: El,
                       parser: Parser) -> dict[El, tuple[str, ConnType, bool]]:
    """
    Wrapper for getting connectors that handles start elements and missing
    connector targets, which requires a parser. 
    
    Args:
        elem: element to search for connectors
        parser: parser containing global file data

    Returns:
        connector map (connector elem: name of target, type of connector, is_optional)

    """
    raw = get_conn_target_map(elem)

    # make sure the target elem exists
    return {x: v for x, v in raw.items() if v[0] in parser.all_names}

def tuple_trace(x: tuple[tuple[str, str], ...]) -> frozenset[tuple[str, str]]:
    return frozenset([t for t in x])


def _right_find(my_iter: tuple[str, ConnType], val_to_find) -> int:
    """
        returns -1 if val_to_find is not in the second value of my_iter
    """
    iter_len = len(my_iter)
    if iter_len == 0:
        return -1
    else:
        for index, x in enumerate(reversed(my_iter)):
            if x[1] == val_to_find:
                return iter_len - index
        return -1

