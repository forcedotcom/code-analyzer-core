"""Module to generate control flow graphs and crawl schedules

"""
from __future__ import annotations

import dataclasses
import json
import logging
import traceback
from collections.abc import Generator
from dataclasses import dataclass, field
from typing import TextIO, TypeAlias

import flow_parser.parse as parse
from flow_parser.parse import Parser
from public.contracts import AbstractSegment, AbstractControlFlowGraph, AbstractCrawler
from public.data_obj import BranchVisitor, CrawlStep, Jump, JSONSerializable
from public.enums import ConnType
from public.parse_utils import (ET, get_name, get_conn_target_map,
                                is_subflow, is_loop, get_tag)

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

    # connectors at the end of this segment
    jumps: list[Jump]

    # whether this segment may end execution
    is_terminal: bool

    # for tracking whether it has been visited
    seen_tokens: list[tuple[tuple[str, str], ...]] = field(default_factory=list)


    def accept(self, visitor: BranchVisitor, multiple_inbound: bool=False) -> list[BranchVisitor] | None:
        """does the node accept the visitor

        Also updates visitor state

        Args:
            visitor: Branch Visitor trying to jump into node
            multiple_inbound: Whether this segment accepts more than
                              a single inbound, in which case it will
                              need to assign tokens for the extra inbounds.
                              Whether an inbound is 'extra' is decided by
                              order of visit.
        Returns:
            list of labels to process or None

        """
        if not self.jumps:
            return None

        if visitor.token in self.seen_tokens:
            return None

        else:
            self.seen_tokens.append(visitor.token)
            if multiple_inbound:
                return self._send_outbound(visitor, add_token=True)
            else:
                return self._send_outbound(visitor)


    def _send_outbound(self, visitor, add_token=False):
        jumps = self.jumps

        to_return = []
        loop_context = visitor.loop_context or tuple()

        history = visitor.history + ((visitor.previous_label, visitor.current_label),)

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

            if add_token:
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

    @classmethod
    def build_from_parser(cls, parser: parse.Parser, elem: ET.Element) -> Segment:
        """Build a segment starting at this element

        Args:
            parser: flow parser instance
            elem: first element in this segment

        Returns:
            segment
        """

        label = get_name(elem)
        start_tag = get_tag(elem)
        jumps = []

        if is_subflow(elem):
            subflows = [0]
        else:
            subflows = []

        conn_map = _get_connector_map(elem, parser=parser)
        optional_values = [x[2] for x in conn_map.values() if x[2] is True]
        is_optional = len(optional_values) > 0
        curr_elem = elem

        # elements traversed within this segment,
        # so always initialized to zero
        traversed = []

        if len(conn_map) == 0:
            return Segment(label=label,
                           subflows=subflows,
                           traversed=[(label, start_tag)],
                           jumps=[],
                           is_terminal=True)
        index = 0

        while len(conn_map) > 0:
            curr_name = get_name(curr_elem)
            curr_tag = get_tag(curr_elem)
            assert curr_tag is not None

            if (curr_name, curr_tag) in traversed:
                # we are looping back in the segment. break here, and
                # the element will not be added to this segment.
                # It will then appear in some other segment pointing to this segment.
                #
                # If it points to an element somewhere in the middle of this segment,
                # that will be addressed in the `fix_duplicates` function below.
                break
            else:
                traversed.append((curr_name, curr_tag))

            if is_subflow(curr_elem):
                subflows.append(index)

            if is_loop(curr_elem):
                # loops always terminate a segment
                for conn, val in conn_map.items():
                    elem_is_loop = False
                    no_more_seen = False

                    if get_tag(conn) == 'noMoreValuesConnector':
                        is_optional = False
                        no_more_seen = True

                    if get_tag(conn) == 'nextValueConnector':
                        elem_is_loop = True
                        # there may be no values at all,
                        # in which case this branch may never be taken
                        is_optional = True

                    jumps.append(Jump(src_name=curr_name,
                                      target=val[0],
                                      is_goto=val[1] is ConnType.Goto,
                                      is_loop=elem_is_loop,
                                      is_no_more_values=no_more_seen,
                                      is_fault=False
                                      )
                                 )
                break

            elif len(conn_map) == 1:
                vals = list(conn_map.values())
                is_optional = vals[0][2]

                if (vals[0][1] is not ConnType.Goto and
                    not is_optional):

                    # this is a normal connector that must always be followed
                    curr_elem = parser.get_by_name(vals[0][0])
                    conn_map = _get_connector_map(curr_elem, parser=parser)
                    continue

                else:
                    # although there is only one connector, it is optional
                    # which means the current element terminates the segment
                    # and *may* terminate the flow
                    # and the connector is turned into a jump
                    jumps.append(Jump(src_name=curr_name,
                                      is_goto=vals[0][1] is ConnType.Goto,
                                      target=vals[0][0],
                                      is_loop=False,
                                      is_no_more_values=False,
                                      is_fault=vals[0][1] is ConnType.Exception))

                    break

            elif len(conn_map) > 1:
                is_optional = True
                # There is more than one connector, so
                for val in conn_map.values():

                    # a single non-optional connector makes the segment non-terminal
                    if not val[2]:
                        is_optional = False
                    jumps.append(Jump(src_name=curr_name,
                                      target=val[0],
                                      is_goto=val[1] is ConnType.Goto,
                                      is_loop=False,
                                      is_no_more_values=False,
                                      is_fault=val[1] is ConnType.Exception
                                      )
                                 )
                break

            # end of conditionals
            index += 1

        # end of while loop

        # Check if the last element in a segment that may also end the flow
        if len(conn_map) == 0:
            curr_tag = get_tag(curr_elem)
            curr_name = get_name(curr_elem)
            if (curr_name, curr_tag) not in traversed:
                traversed.append((curr_name, curr_tag))

                if is_subflow(curr_elem):
                    subflows.append(index)

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
        visited_elems = set()
        segment_map = {}
        to_visit = [start_elem]

        while len(to_visit) > 0:

            curr_elem = to_visit.pop(0)
            curr_segment = Segment.build_from_parser(parser=parser,
                                                     elem=curr_elem)

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

        # The resulting Segments are fine except for
        # gotos leading to duplicates. These are fixed here.
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
    max_visit = 100

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
                vals.append(cs)

            step += 1

    return tuple(crawl_steps), tuple(terminal_steps), el_2_cs

def get_visits_statistics(visit_map: dict[str, Jump | None], cfg: ControlFlowGraph):
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
    first_seen_inbound = {} #: segment_label -> visitor.previous_label

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
                logger.critical(f"Attempting to visit {curr_label} {visitor_counts[curr_label]} "
                                f"times, stopping this visitor.")
                visitor = None
                continue

        segment = cfg.segment_map[visitor.current_label]

        yield visitor, segment

        # todo: cache this
        if segment.label == '*':
            is_multiple = False
        else:
            inbounds = cfg.inbound[segment.label]
            if len(inbounds) <= 1:
                is_multiple = False

            elif curr_label not in first_seen_inbound:
                is_multiple = False
                first_seen_inbound[curr_label] = prev_label

            else:
                is_multiple = prev_label != first_seen_inbound[curr_label]

        next_visitors = segment.accept(visitor, multiple_inbound=is_multiple)

        if next_visitors is None or len(next_visitors) == 0:
            visitor = None
            """
            # no more visitors means current branch is exhausted
            # if the current branch was not visited, then yield it now
            history = visitor.history + ((visitor.previous_label, visitor.current_label),)
            last_visitor = dataclasses.replace(visitor,
                previous_label=label,
                current_label=None,
                history=history
            )
            yield last_visitor, segment
            visitor = None
            """
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


def _fix_duplicates(segment_map: dict[str, Segment]) -> None:
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
                new_jump = Jump(src_name=segment.traversed[val_index - 1][0],
                                target=val[0],
                                is_loop=False,
                                is_goto=False,
                                is_no_more_values=False,
                                is_fault=False
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
            new_segment = Segment(label=val[0],
                                  traversed=segment.traversed[val_index:],
                                  subflows=[x for x in segment.subflows if x >= val_index],
                                  jumps=segment.jumps,
                                  is_terminal=segment.is_terminal)

            segment_map[val[0]] = new_segment

        # add all the traversed elems to processed
        # so we don't make more new segments unnecessarily
        processed = processed + new_segment.traversed

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

        #: previous crawlers, None if this is the first
        #: if we are 3 frames deep, this is descending order: history = [(crawler 2, int 2), (crawler 1, int 1)]
        self.crawler_history: list[tuple[Crawler, int]] | None = None

        #: file path
        self.flow_path: str | None = flow_path

        #:
        self.el_2_cs: dict[str, list[CrawlStep]] | None = el_2_cs

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

    def get_control_influence_from_source(self, influenced_var: str,
                                                source_var: var_t) ->tuple[var_t, ...] | None:
        """Both the influenced and source variables are top level flow elements.
           The influenced variable is in the current flow path, the source variable may be in
           a different flow path (so we need the tuple (path, varname)). If the source variable control
           influences the influenced_variable, then a chain of (path, element name) will be returned starting
           at the source and leading to the influenced variable. The chain only contains branches
           and subflow chains, not every step, but every step could be reconstructed if desired
           by adding in the segment traversals.

           This must be run at every frame load, because a subflow may be loaded multiple times, with a larger
           set of control influencers each time it is called.

           For example, in frame A, we have start --> branch 1, branch 2, and each branch may call the same subflow.
           So a given element in the subflow will be control influenced by branch 1 the first time it is called,
           and by both branch 1 and branch 2 the second time it is entered. So to get a global control
           influencing answer, you need to call this function on every subflow load. You do not need to wait
           until a given subflow is fully crawled, as the full crawl info is generated by the parser when the
           flow is loaded.

        Args:
            influenced_var (str): top level (traversable) flow element name in the flow crawled by this current crawler.
            source_var (str, str): flow_path, element name in either the current flow or in another flow that may or
                                   may not be an ancestor in the call chain.

        Returns:
            None if there is no influence, or a set of crawl steps linking the source to the influenced.
            Only a single chain of crawl steps is returned, there may be other control influence chains.

        """
        if source_var is None or influenced_var is None:
            return None

        # case 1: (Local Analysis) everything is in the same flow
        src_path = source_var[0]
        if self.flow_path == src_path:
            if influenced_var == source_var[1]:
                # trivial case
                return (src_path, influenced_var)

            res = self._get_local_control(influenced_var, source_var)
            if res is None:
                return None
            else:
                return tuple([(src_path, x) for x in res])

        # case 2: the source is in a subflow descendent. Because all elements
        # are connected to the start, we only care about the chain of start elements/subflow
        # elems connecting to the source elem.

        # set of (call-chain height, (crawler, crawler_step_index))
        candidates = [(index, x) for (index, x) in enumerate(self.crawler_history) if x[0].flow_path == src_path]

        if len(candidates) == 0:
            return None
        else:
            for index, (crawler, step_index) in candidates:
                tail = self._get_local_control(crawler.crawl_schedule[step_index].element_name, source_var[1])
                if tail is not None:
                    result = [(self.flow_path, influenced_var)]
                    # we have a chain from source -> subflow that exited the frame.
                    # Now, fill in until we get to the start element of the current frame.
                    for i in range(index):
                        c = self.crawler_history[i][0]
                        step = self.crawler_history[i][1]
                        elem = c.crawl_schedule[step].element_name
                        path = c.flow_path
                        result.append((path, elem))

                    [result.append((src_path, el)) for el in tail]
                    return tuple(result)

            return None

    def get_crawl_schedule(self)->tuple[CrawlStep, ...]:
        return self.crawl_schedule

    def get_flow_path(self) -> str | None:
        return self.flow_path

    def get_crawler_history_unsafe(self) -> list[tuple[Crawler, int]]:
        """READ ONLY

        Returns:
            history of crawlers encountered during crawl, together with the current step (int)
            when they entered a child flow.
        """
        return self.crawler_history

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
        """returns a list of all crawlsteps in which this element has been visited
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

    def _get_local_control(self, influenced_el: str, influencer_el) -> tuple[var_t, ...] | None:
        sink_crawl_steps = self.el_2_cs.get(influenced_el, [])
        source_crawl_steps = self.el_2_cs.get(influencer_el, [])

        if len(sink_crawl_steps) == 0 or len(source_crawl_steps) == 0:
            return None
        else:
            for source in source_crawl_steps:  #
                # Because of how this info is built, the first element is likely
                # to have the smallest branch history, which speeds things up.
                sink = sink_crawl_steps[0]

                sin_l = len(sink.visitor.history)
                src_l = len(source.visitor.history)
                if sin_l > src_l and (sink.visitor.history[0:len(source.visitor.history)] == source.visitor.history):

                    # we choose jump target arbitrarily - it doesn't matter
                    # as long as we are consistent since this is for the auditor's own info
                    return ((source.element_name,) + tuple([x[1] for x in sink.visitor.history[src_l + 1:]])
                            + (sink.element_name,))

                elif sin_l == src_l and sink.visitor.history == source.visitor.history:
                    # Both the sink and source are already on the same segment, so
                    # we only need to check if src is dominant.
                    if sink.local_index > source.local_index:
                        # sink is downstream of source, so source dominates
                        return source.element_name, sink.element_name
                    else:
                        return None

        return None

def dump_cfg(cfg: ControlFlowGraph, fp: TextIO) -> None:
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

    # ..check there are no missing crawlable elements
    missing = [x for x in all_elem_tuples if x not in crawled_elems]

    if missing_only:
        return missing

    else:
        # continue to gather other statistics
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

def _get_connector_map(elem: ET.Element,
                       parser: Parser) -> dict[ET.Element, tuple[str, ConnType, bool]]:
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

