"""Module to generate control flow graphs and crawl schedules

"""
from __future__ import annotations

import dataclasses
import json
from abc import ABC
from collections.abc import Generator
from dataclasses import dataclass, field
from typing import TextIO

import flow_parser.parse as parse
from flow_parser.parse import Parser
from public.data_obj import BranchVisitor, CrawlStep
from public.enums import ConnType
from public.flowtest_exceptions import InvalidFlowException
from public.parse_utils import (ET, get_name, get_conn_target_map,
                                is_subflow, is_loop, get_tag)


@dataclass(frozen=True)
class JSONSerializable(ABC):

    def to_dict(self):
        return {s: getattr(self, s) for s in self.__slots__}


@dataclass(frozen=True, eq=True, slots=True)
class Jump(JSONSerializable):
    """Class representing a connector

    """
    # name of element where jump is located
    src_name: str

    # where connector points to
    target: str

    # true if goto connector
    is_goto: bool

    # true if next-value
    is_loop: bool

    def priority(self) -> int:
        # lower is higher priority
        if self.is_loop:
            return 0
        else:
            return 1


@dataclass(frozen=True, eq=True, slots=True)
class Segment(JSONSerializable):
    # name of element at the start of the segment (jump target)
    label: str

    # list of elements (including label) in this segment (in order)
    traversed: [str]

    # list of traversal indexes that are subflow elements
    subflows: [int]

    # connectors at the end of this segment
    jumps: [Jump]

    # whether this segment may end execution
    is_terminal: bool

    # for tracking whether it has been visited
    seen_visitors: [(str, str)] = field(default_factory=list)

    def accept(self, visitor: BranchVisitor) -> [BranchVisitor] or None:
        """does the node accept the visitor

        Also updates visitor state

        Args:
            visitor: Branch Visitor trying to jump into node

        Returns:
            list of labels to process or None

        """

        prev = visitor.previous_label
        if (prev, visitor.token) not in self.seen_visitors:
            self.seen_visitors.append((prev, visitor.token))
            return self._send_outbound(visitor)

        else:
            return None

    def _send_outbound(self, visitor):
        # don't send an element right back to where it jumped from!
        jumps = [jmp for jmp in self.jumps if (jmp.src_name, jmp.target) not in visitor.history]
        jumps.sort(key=lambda x: x.priority())

        to_return = []
        for jmp in jumps:
            current_label = jmp.target
            previous_label = self.label
            history = visitor.history + ((jmp.src_name, jmp.target),)
            if jmp.is_goto is True:
                token = (jmp.src_name, jmp.target)
                to_add = dataclasses.replace(visitor,
                                             token=token,
                                             current_label=current_label,
                                             previous_label=previous_label,
                                             history=history
                                             )
            else:
                to_add = dataclasses.replace(visitor,
                                             current_label=current_label,
                                             previous_label=previous_label,
                                             history=history
                                             )
            to_return.append(to_add)
        return to_return

    @classmethod
    def build_from_parser(cls, parser: parse.Parser,
                          elem: ET.Element,
                          seen_names: [str] = None):

        label = get_name(elem)
        jumps = []
        if is_subflow(elem):
            subflows = [0]
        else:
            subflows = []
        conn_map = get_connector_map(elem, parser=parser)
        optional_values = [x[2] for x in conn_map.values() if x[2] is False]
        is_optional = len(optional_values) == 0
        curr_elem = elem
        traversed = []

        if len(conn_map) == 0:
            return Segment(label=label,
                           subflows=subflows,
                           traversed=[label],
                           jumps=[],
                           is_terminal=True)
        index = 0
        while len(conn_map) > 0:

            conn_map = get_connector_map(curr_elem, parser=parser)
            curr_name = get_name(curr_elem)
            if curr_name in traversed:
                # we are looping back in the segment. break here, and
                # the element will not be added to this segment.
                # It will then appear in some other segment pointing to this segment.
                #
                # If it points to an element somewhere in the middle of this segment,
                # that will be addressed in the `fix_duplicates` function below.
                break
            else:
                traversed.append(curr_name)

                if seen_names is not None:
                    if curr_name not in seen_names:
                        seen_names.add(curr_name)

            if is_subflow(curr_elem):
                subflows.append(index)

            if is_loop(curr_elem):
                # A loop can be missing a noMoreValues
                # in which case it terminates the program
                for conn, val in conn_map.items():
                    elem_is_loop = False
                    no_more_seen = False

                    if get_tag(conn) == 'noMoreValuesConnector':
                        is_optional = False
                        no_more_seen = True

                    if get_tag(conn) == 'nextValueConnector':
                        elem_is_loop = True
                        if no_more_seen is False:
                            is_optional = True

                    jumps.append(Jump(src_name=curr_name,
                                      target=val[0],
                                      is_goto=val[1] is ConnType.Goto,
                                      is_loop=elem_is_loop
                                      )
                                 )
                break

            elif len(conn_map) == 1:
                vals = list(conn_map.values())

                if vals[0][1] is not ConnType.Goto and vals[0][0] not in seen_names and is_optional is False:
                    curr_elem = parser.get_by_name(vals[0][0])
                    continue
                else:
                    jumps.append(Jump(src_name=curr_name,
                                      is_goto=vals[0][1] is ConnType.Goto,
                                      target=vals[0][0],
                                      is_loop=False))
                    break

            elif len(conn_map) > 1:
                for val in conn_map.values():
                    jumps.append(Jump(src_name=curr_name,
                                      target=val[0],
                                      is_goto=val[1] is ConnType.Goto,
                                      is_loop=False
                                      )
                                 )
                break

            # end of conditionals
            index += 1

        # end of while loop

        if len(jumps) == 0:
            # if there are no more jumps, this is a terminal element
            is_optional = True
        else:
            # sort jumps so nextValue is taken first
            jumps.sort(key=lambda x: x.priority())

        return Segment(label=label,
                       subflows=subflows,
                       jumps=jumps,
                       traversed=traversed,
                       is_terminal=is_optional)


@dataclass(frozen=True, eq=True, slots=True)
class ControlFlowGraph(JSONSerializable):
    # where to start
    start_label: str

    # map from segment label -> inbound jumps
    inbound: {str: [Jump]}

    # label -> segment
    segment_map: {str: Segment}

    @classmethod
    def from_parser(cls, parser: parse.Parser):
        start_elem = parser.get_start_elem()
        start_label = get_name(start_elem)
        visited_labels = []
        visited_elems = set()
        segment_map = {}
        to_visit = [start_elem]

        while len(to_visit) > 0:

            curr_elem = to_visit.pop(0)
            curr_segment = Segment.build_from_parser(parser=parser,
                                                     elem=curr_elem,
                                                     seen_names=visited_elems)

            segment_map[curr_segment.label] = curr_segment

            # add segment label to visited
            if curr_segment.label not in visited_labels:
                visited_labels.append(curr_segment.label)

            visited_elems.update(curr_segment.traversed)

            # update to_visit with new jumps
            for jmp in curr_segment.jumps:
                tgt = jmp.target
                tgt_elem = parser.get_by_name(tgt)
                if tgt not in visited_labels and tgt_elem not in to_visit:
                    to_visit.append(tgt_elem)

        # The resulting Segments are fine 99% of the time, but some flows
        # have undocumented gotos leading to duplicates. These are fixed here.
        _fix_duplicates(segment_map)

        # Now generate inbound:
        inbound = {}

        for seg in segment_map.values():
            for jmp in seg.jumps:
                if jmp.target in inbound:
                    inbound[jmp.target].append(jmp)
                else:
                    inbound[jmp.target] = [jmp]

        return ControlFlowGraph(start_label=start_label,
                                inbound=inbound,
                                segment_map=segment_map)


def _get_crawl_visits(cfg: ControlFlowGraph) -> {str: [BranchVisitor]}:
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

    for visitor, segment_names in crawl_iter(cfg=cfg):
        visits[visitor.current_label].append(visitor)

    return visits


@dataclass(frozen=True, eq=True, slots=True)
class CrawlSchedule(ABC):
    total_steps: int
    total_branches: int
    crawl: [{str: int | str}]
    branch_map: {((str, str),): BranchVisitor}
    branch_counts: {((str, str),): int}


def get_crawl_schedule(cfg: ControlFlowGraph) -> ((CrawlStep,), (CrawlStep,)):
    """Builds crawl schedule

    Args:
        cfg: Control Flow Graph

    Returns:
        (tuple of crawl steps, tuple of terminal steps)
    """

    generator = crawl_iter(cfg)
    crawl_steps = []
    terminal_steps = []
    step = 0

    for (visitor, segment) in generator:
        if segment.is_terminal is True:
            terminal_steps.append(
                CrawlStep(
                    step=step + len(segment.traversed) - 1,
                    visitor=visitor,
                    element_name=segment.traversed[-1]
                )
            )
        for el_name in segment.traversed:
            crawl_steps.append(
                CrawlStep(
                    step=step,
                    visitor=visitor,
                    element_name=el_name
                )
            )
            step += 1

    return tuple(crawl_steps), tuple(terminal_steps)


def crawl_iter(cfg: ControlFlowGraph) -> Generator[(BranchVisitor, [Segment]), None, None]:
    """crawls CFG

    Args:
        cfg: control flow graph

    Yields:
        current Branch visitor, list of flow elements to process, outgoing Branch Visitors
    """

    label = cfg.start_label
    visitor = BranchVisitor(label, previous_label=None)
    worklist = []

    while len(worklist) > 0 or visitor is not None:
        if visitor is None and len(worklist) > 0:
            # nowhere to jump, so pull from worklist
            visitor = worklist.pop(0)

        # skip orphaned references
        if visitor.current_label not in cfg.segment_map:
            visitor = None
            continue

        segment = cfg.segment_map[visitor.current_label]
        next_visitors = segment.accept(visitor)

        yield visitor, segment

        if next_visitors is not None and len(next_visitors) > 0:
            # depth-first search so take first branch and assign as current
            visitor = next_visitors[0]

            # Add to worklist
            [worklist.append(next_visitors[i]) for i in range(1, len(next_visitors))
             if next_visitors[i] not in worklist]

        else:
            # no more visitors means current branch is exhausted
            visitor = None


def get_visits_statistics(visit_map: {str: Jump or None}, cfg: ControlFlowGraph):
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
        visit_tuples = {(x.current_label, cfg.segment_map[x.previous_label].traversed[-1]) for x in label_visits
                        if x.previous_label is not None}
        inbound_tuples = {(x.target, x.src_name) for x in inbound[label]}
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


def _find_segments_with_elem(val: str, segment_map: {str: Segment}) -> [(str, Segment, int)]:
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
        try:
            # Note segment gen. algorithm doesn't allow a value to appear
            # more than once in the traversed history
            to_return.append((label, seg, seg.traversed.index(val)))
        except ValueError:
            pass

    return to_return


def _fix_duplicates(segment_map: {str: Segment}) -> None:
    """segment surgery to merge duplicate paths

    Sometimes we have::

       segment 1: A->B->C
       segment 2: X->A->B->C

    Which should be turned into::

       segment 1: A->B->C
       segment 2': X :jump A

    Or if we have::

        segment 3: X->Y->A
        segment 4: W->B->A

    Then this should be merged into:

        segment 3': X->Y jump A
        segment 4': W->B jump A
        new segment: A

    Args:
        segment_map: label -> Segment

    Returns:
        None. (Segments updated in place)
    """
    crawled = []
    segments = segment_map.values()
    for segment in segments:
        crawled = crawled + segment.traversed

    dupes = {x for x in crawled if crawled.count(x) > 1}
    if len(dupes) == 0:
        return
    # el: string name of dupe flow element
    # val: list (segment, index of traversed in segment)
    processed = []
    for val in dupes:
        if val in processed:
            continue

        dupes = _find_segments_with_elem(val, segment_map)
        new_segment = None

        # (segment, index)
        for (label, segment, val_index) in dupes:
            if val_index == 0:
                # the dupe *starts* a segment, so it is the entire segment
                new_segment = segment
            else:
                # the dupe is partway through the segment
                subflows = [x for x in segment.subflows if x < val_index]
                new_jump = Jump(src_name=segment.traversed[val_index - 1],
                                target=val,
                                is_loop=False,
                                is_goto=False,
                                )
                # replace the segment
                segment_map[label] = Segment(label=segment.label,
                                             traversed=segment.traversed[:val_index],
                                             subflows=subflows,
                                             jumps=[new_jump],
                                             is_terminal=False)
        # now, make the jump target
        if new_segment is not None:
            # we already have it, no need to add it.
            pass
        else:
            # make it. All dupes of the same value must end in the same way
            # so take the first
            (seg_index, segment, val_index) = dupes[0]
            new_segment = Segment(label=val,
                                  traversed=segment.traversed[val_index:],
                                  subflows=[x for x in segment.subflows if x >= val_index],
                                  jumps=segment.jumps,
                                  is_terminal=segment.is_terminal)

            segment_map[val] = new_segment

        # add all the traversed elems to processed
        # so we don't make more new segments unnecessarily
        processed = processed + new_segment.traversed


def validate_cfg(cfg: ControlFlowGraph, parser: parse.Parser) -> bool:
    # check that all elements are covered exactly once:
    all_elems = parser.get_all_traversable_flow_elements()
    all_elem_names = [get_name(x) for x in all_elems]
    crawled_elems = []

    for segment in cfg.segment_map.values():
        crawled_elems = crawled_elems + segment.traversed

    # ..check there are no missing crawlable elements
    missing = [x for x in all_elem_names if x not in crawled_elems]
    counts = {x: crawled_elems.count(x) for x in crawled_elems}

    # ..check there are no duplicates
    duplicates = [x for x in crawled_elems if counts[x] > 1]

    if len(duplicates) != 0:
        valid = False
        print("invalid crawl info")
        for x in duplicates:
            print(f"duplicate: {x}")
    else:
        valid = True
    for x in missing:
        # some flows include disconnected elements that can't be crawled.
        print(f"caution missing element found: {x}")

    return valid


class CrawlEncoder(json.JSONEncoder):
    def default(self, obj):
        if (isinstance(obj, JSONSerializable) or isinstance(obj, BranchVisitor)
                or isinstance(obj, CrawlStep)):
            return obj.to_dict()
        else:
            return json.JSONEncoder.default(self, obj)


class Crawler:
    """Class representing the crawl of a graph

    """

    def __init__(self, total_steps: int, crawl_schedule: (CrawlStep,),
                 terminal_steps: (CrawlStep,),
                 history_maps: {((str, str),): CrawlStep}):
        """Constructor

        .. WARNING:: For module use only

        Args:
            total_steps: how many steps in crawl
            crawl_schedule: tuple of :class:`public.data_obj.CrawlStep` in order of execution
            terminal_steps: tuple of :class:`public.data_obj.CrawlStep`
                            that can end program (note, *not* in any specific order)
            history_maps: map from history to last seen crawl_step with this history

        """
        #: int current step of crawl
        self.current_step = 0

        #: int total number of steps
        self.total_steps = total_steps

        #: crawl_step -> last seen ancestor
        self.history_maps = history_maps or {}

        #: tuple(:ref:`public.data_obj.CrawlStep`) all crawl steps in order of execution
        self.crawl_schedule = crawl_schedule

        #: tuple(:ref:`public.data_obj.CrawlStep`) steps that can terminate the program
        self.terminal_steps = terminal_steps

    @classmethod
    def from_parser(cls, parser: parse.Parser):
        """Builds a crawl schedule (recommended builder)

        Args:
            parser: :obj:`flow_parser.parse.Parser` instance

        Returns:
            :obj:`Crawler` instance

        """
        cfg = ControlFlowGraph.from_parser(parser)
        crawl_schedule, terminal_steps = get_crawl_schedule(cfg)
        total_steps = len(crawl_schedule)

        return Crawler(
            total_steps=total_steps,
            crawl_schedule=crawl_schedule,
            terminal_steps=terminal_steps,
            history_maps=None
        )

    def get_crawl_step(self) -> CrawlStep | None:
        """Retrieve the next crawl step

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

    def set_step(self, step: int) -> None:
        self.current_step = step

    def get_last_ancestor(self, crawl_step) -> CrawlStep | None:
        """Get latest ancestor branch that was last visited

        Useful for knowing which influence map to clone

        Args:
            crawl_step: step whose history is sought

        Returns:
            CrawlStep instance or None

        """
        history = crawl_step.visitor.history
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


def get_connector_map(elem: ET.Element,
                      parser: Parser) -> {ET.Element: (str, ConnType, bool)}:
    """
    Wrapper for getting connectors that handles start elements and missing
    connector targets, which requires a parser. 
    
    Args:
        elem: element to search for connectors
        parser: parser containing global file data

    Returns:
        connector map

    """
    raw = get_conn_target_map(elem)

    # make sure the target elem exists
    return {x: v for x, v in raw.items() if v[0] in parser.all_names}


def dump_cfg(x, fp: TextIO):
    json.dump(x, indent=4, fp=fp, cls=CrawlEncoder)
