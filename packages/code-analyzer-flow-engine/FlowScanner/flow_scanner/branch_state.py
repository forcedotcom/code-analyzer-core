"""Maintains data influence map for each crawl step.

    BranchState manages the influence maps of all variables under study
    and exposes an API to propagate the maps and to query the maps to determine
    whether a variable is influenced by another.


    @author: rsussland@salesforce.com
"""
from __future__ import annotations

import copy
import logging
import traceback

from typing import TypeAlias
from flow_parser import parse
from flow_scanner.control_flow import Crawler
from flow_scanner.flows import FlowVector
from flow_scanner.util import propagate
from public.contracts import State
from public.custom_parser import ET
from public.data_obj import InfluencePath, InfluenceStatement, CrawlStep
from public.parse_utils import get_name, get_elem_string, get_line_no

"""
 * * Important Type Aliases * * 
"""

"""
A unique flow vector exists for each variable, and variables are globally 
define by a tuple (flow path, variable name) to support dataflow 
analysis across subflows. Therefore the full state of the system at any
stage of execution can be defined by a "flow_map" which is a map
from (str, str) -> FlowVector

"""
flow_map_t: TypeAlias = dict[tuple[str, str], FlowVector]


"""
An influence path is also defined only for each variable. Moreover,
each variable can have a set of influence paths, due to different
execution flow histories. The difference between an influence map
and a flow map is that the influence map is never vectorized, e.g. 
it applies only to scalars or the common case, and so is suitable 
for things like formulas, not vectors. 

The flow map is built from influence maps by having a general case
and then property overrides. See the flows module for how this is done.
"""
infl_map_t: TypeAlias = dict[tuple[str, str], set[InfluencePath]]


"""
A local influence map drops the flow path and only considers lists,

variable name --> list of influence paths influencing this variable.

this is when there is no need for looking at cross flow dataflows. This
is only used as a building block for flow maps and influence maps.
"""

local_infl_map_t: TypeAlias = dict[str, list[InfluenceStatement]]

"""
Flow variables are a set of tuples (flow path, variable name) as two flows
can have variables of the same name.
"""

flow_vars_t: TypeAlias = set[tuple[str, str]]

"""
a variable in a flow is tracked by a tuple (flow path, variable name) as two flows
can have variables of the same name.
"""

var_t: TypeAlias = tuple[str, str]


#: string to use in :class:`public.DataInfluenceStatement` comments
SUBFLOW_WIRE_COMMENT = "output via subflow assignment"

#: string to use in :class:`public.DataInfluenceStatement` comments
INITIALIZATION_COMMENT = "Initialization"

MAX_FORMULA_DUPLICATES = 3

#: module logger
logger = logging.getLogger(__name__)


class BranchState(State):
    """Instances of BranchState track dataflows within a given flow

        * the current element being processed
        * all influence flows seen on this branch and up to this element

    All interaction with influence flows must be done via public APIs
    exposed by BranchState. Instantiate only with a builder method.

    A shallow copy of the influence map is made at each crawl
    step (the influence map contains only immutable elements).

    Prior to exiting a subflow, all branches must be consolidated so that
    all execution paths are available as return values.

    """

    def __init__(self, parser: parse.Parser):
        # api to query flow xml elements

        #: reference to current parser
        self.parser: parse.Parser = parser

        #: current crawl step
        self.current_crawl_step: CrawlStep | None = None

        #: CrawlStep -> map[(flow_path, variable_name)--> FlowVectors]
        self.__influence_map: dict[CrawlStep, flow_map_t] = {}

        #: default map populated with globals available to the flow
        self.__default_map: flow_map_t = {}

        #: Name of Element being currently processed (for convenience)
        #: (The first element in a flow is start and has no name.)
        self.current_elem_name: str = '*'

        #: current Flow element (xml)
        self.current_elem: ET.Element | None = None

        #: resolves formulas and templates (late binding indirect references)
        self.formula_map: infl_map_t = {}

        #: flow label (unique within a given package)
        self.flow_name: str | None = None

        #: filename of flow when working in variables across a flow
        self.flow_path: str | None = None

    @classmethod
    def from_parser(cls, parser: parse.Parser) -> BranchState:
        """Returns a state instance with variable defaults populated

        This instance is *not* ready to be used until it is loaded
        with a crawl step. Only the defaults have been added.

        Args:
            parser: parser instance for this flow

        Returns:
            Branch State instance
        """
        state = BranchState(parser=parser)
        state.flow_path = parser.flow_path
        state.flow_name = parser.get_flow_name()
        state.formula_map = _build_formula_map(parser, parser.flow_path)
        _populate_defaults(state, parser)

        return state

    def get_parser(self) -> parse.Parser:
        """Retrieve current parser associated to this flow.

        Useful if processing old states for subflows and the current
        parser is no longer available.

        Returns:
            Parser instance
        """
        return self.parser

    def get_current_elem(self) -> ET.Element:
        """Get current element being processed

        Returns:
            xml element associated to the flow's crawl step
        """
        return self.current_elem

    def get_current_elem_name(self) -> str:
        """Get name of element

        Returns:
            Flow Element name of the current crawl step
        """
        return self.current_elem_name

    def filter_maps(self, steps: list[CrawlStep]):
        """Removes all influence maps except those in `steps`

        .. WARNING:: Destructive operation, only call after flow
                     processing is complete.

        Args:
            steps: CrawlSteps to keep

        Returns:
            None. The influence map is filtered in place.

        """

        to_delete = [step for step in self.__influence_map.keys() if step not in steps]
        for step in to_delete:
            del self.__influence_map[step]

    def get_all_output_vectors(self) -> list[tuple[var_t, FlowVector]]:
        """Return output variable FlowVectors

        Returns:
            {((flow path, variable name), FlowVector from current state)}
            or empty set if no such variables exist
        """
        output_vars = self.parser.output_variables
        if output_vars is None or len(output_vars) == 0:
            return []
        else:
            return [(var_tuple, self.get_or_make_vector(name=var_tuple[1], flow_path=var_tuple[0]))
                    for var_tuple in self.parser.output_variables]

    def propagate_flows(self, statement: InfluenceStatement,
                        assign: bool = True,
                        store: bool = True,
                        **type_replacements
                        ) -> FlowVector | None:
        """Propagates the BranchState.influence_map by the DataInfluenceStatement.

        Main method to call for building a dataflow graph.

        Args:
            statement: Statement to extend flows by. The influenced of
                       this statement is the variable of interest whose
                       dataflows we want to determine.
            assign: If true, then statement is an assignment, E.g. a =
                    b, otherwise it's an addition, e.g. or a = a+b, in which
                    case all the old influencers of 'a' are preserved and
                    added to those of b. (Note that populating a collection
                    is done by assignment)
            store: whether to actually update the flow vector with the
                   flows (True) or only return the vector

            **type_replacements: override type attributes during propagation [Expert Use]

        Returns:
            If no influencer flows are present,
            then we return the original vector (which will just be initialization,
            or self-influence). Else the vector representing all influencers
            via the statement is returned.

        """
        # Don't propagate string literal flows
        if statement.influencer_var == parse.STRING_LITERAL_TOKEN:
            return None
        # make a flow out of statement:
        statement_flow = _build_path_from_history(history=(statement,), parser=self.parser,
                                                  **type_replacements)

        head_flows = {statement_flow}

        formula_map = self.formula_map
        (stmt_end_parent, stmt_end_member) = (statement_flow.influencer_name, statement_flow.influencer_property)

        # This is painful because formula evaluation needs to be done now
        if formula_map is not None and (statement.flow_path, stmt_end_parent) in formula_map:
            assert stmt_end_member is None  # formulas only map scalars to scalars

            # we are in the situation foo <--- {!formula}, so resolve
            # foo <-- formula_resolution <-- other vars
            head_flows = _extend_formula_map_by_flows(head_flows, formula_map, add_missing=True)

        # Now we have a set of flows:
        #   {foo <-- formula <--- var1, foo <-- formula <-- Account.Name, ...}
        # or if no formula, our original statement made into a flow
        #   {foo <-- var}
        # so the next step is to wire the *end* of these flows into our vectored flows:
        # Perhaps here we should send an alert if something is used before initialized?
        tgt_vec = self.get_or_make_vector(statement_flow.influenced_name, store=False)

        accum = self._propagate_flows_to_vec(vec=tgt_vec, flows=head_flows, assign=assign)

        if accum is None:
            accum = self.get_or_make_vector(statement_flow.influenced_name, store=False)

        if store:
            # add to influence map
            self._get_influence_map()[(self.flow_path, statement_flow.influenced_name)] = accum

        return accum

    def load_crawl_step(self, crawler: Crawler, crawl_step: CrawlStep = None) -> CrawlStep | None:
        """Updates the state after crawling to next Flow Element

        Args:
            crawler: crawler
            crawl_step: step to load

        Returns:
             CrawlStep that was loaded

        """
        if crawl_step is None:
            next_cs = crawler.load_crawl_step()
        else:
            next_cs = crawl_step

        if next_cs is None:
            # nothing left to crawl
            return None

        # find the appropriate parent map to clone:
        if self.current_crawl_step is None:
            # we are just starting the crawl
            old_map = self.__default_map

        elif next_cs.visitor == self.current_crawl_step.visitor:
            # the next element is on the same branch as current elem
            old_map = self.__influence_map[self.current_crawl_step]

        else:
            old_history = self.current_crawl_step.visitor.history
            new_history = next_cs.visitor.history

            if old_history == ():
                # we are on the first branch, so no backtracking
                old_map = self.__influence_map[self.current_crawl_step]

            elif len(new_history) >= len(old_history) and new_history[0:len(old_history)] == old_history:
                # the new branch is a continuation of old branch so no backtracking
                old_map = self.__influence_map[self.current_crawl_step]

            else:
                # the new history is a different branch, and we need to backtrack
                old_cs = crawler.get_last_ancestor(next_cs)
                if old_cs is None:
                    # no predecessor, so we use default
                    old_map = self.__default_map
                else:
                    old_map = self.__influence_map[old_cs]

        # make shallow copy because flow vectors are immutable
        self.__influence_map[next_cs] = copy.copy(old_map)

        # load current element and step info
        self.current_crawl_step = next_cs
        self.current_elem = self.parser.get_by_name(next_cs.element_name)
        self.current_elem_name = next_cs.element_name

        return next_cs

    def get_flows_from_sources(self, influenced_var: str,
                               source_vars: set[var_t],
                               all_steps=False, restrict: str | None=None) -> set[InfluencePath] | None:
        """Finds which flows originate in the source variables.

        returns all flows into influencer_var that originate in the
        source_vars. Variables can be unresolved but *must*
        resolve to named Flow elements. ``influencer_var`` can be a
        formula.

        Args:
            influenced_var: the (raw, unresolved) variable name
            source_vars: raw (unresolved) source variable names,
                         but with a path tuple.
            all_steps: whether flows should be loaded from
                       all crawl steps or just the current step
            restrict: only consider flows that originate with the variable restricted to the
                      specified property of the source vars.
        Notes:
            * Only queries for names in the current flow-path
              (This should be handled automatically as sources
              are pushed forward via output variable assignments)

        Returns:
            None if no tainted flows found, else it returns the set of
            DataInfluencePaths tuples, corresponding to flows from the
            source vars into the taint statement. The histories of these
            paths should be passed into the results collector, but the
            entire flow is provided to assist in type analysis if
            needed.


        """
        if source_vars is None or len(source_vars) == 0:
            return None
        if influenced_var is None:
            return None

        # we assume this is being called in the same flow as the influenced variable
        path = self.flow_path
        (parent, member, type_info) = self.parser.resolve_by_name(influenced_var)
        var_tuple = (path, parent)

        if var_tuple in self.formula_map:
            # (The issue is that influencer_var may be a formula field,
            # otherwise we'd just grab the vec and be done.)
            formula_flows = self.formula_map[var_tuple]
        else:
            formula_flows = None

        if not all_steps:
            steps_to_check = [None]
        else:
            steps_to_check = [self.__influence_map.keys()]

        to_return = set()
        for step in steps_to_check:
            tgt_vec = self._get_or_make_FlowVector(parent=parent, type_info=type_info, path=path,
                                                   store=False, step=step)
            if formula_flows is not None:
                vec_influencers = self._propagate_flows_to_vec(flows=formula_flows,
                                                               vec=tgt_vec, assign=True,
                                                               step=step)
            else:
                # we do not have a formula:
                vec_influencers = self.get_or_make_vector(name=parent, store=False, step=step)

            if vec_influencers is None:
                continue
            else:
                candidate_flows = vec_influencers.get_flows_by_prop(member)

                for path in candidate_flows:
                    if (path.history[0].flow_path, path.history[0].influencer_var) in source_vars:
                        # now filter if requested
                        if restrict is not None and path.influencer_property != restrict:
                            continue
                        else:
                            to_return.add(path)

        # end of for-loop return all results
        if len(to_return) == 0:
            return None
        else:
            return to_return

    def get_or_make_vector(self, name: str, flow_path: str = None,
                           store=False, step: CrawlStep = None) -> FlowVector | None:
        """Retrieve vector and if none exists, create it.

        If used with the current flow_path (or flow_path set to None) then
        we create a vector if it doesn't exist and return it.

        If used with some other path, then returns none if the vector doesn't exist.

        Args:
            name: name to lookup (can be a variable name, the method
                  will resolve)
            flow_path: optional flow_path (if None, will use the
                       filepath of current flow)
            store: whether to store the vector in the influence_map
                   or just return the dummy flow (if adding to an influence chain)
            step: Crawl step to use


        Returns:
            vector or None if the Name cannot be parsed or does not exist in this flow-path.

        """
        path_to_use = flow_path or self.flow_path
        res = self.parser.resolve_by_name(name=name)

        if res is None:
            logger.warning(f"Could not resolve {name} in path {self.flow_path}")
            return None
        else:
            (parent, member, type_info) = res

        res = self._get_vector(flow_path=path_to_use, name=parent, step=step)
        # TODO: refactor this by providing a new method as we already have all the type info and
        # resolutions done
        if res is not None:
            return res
        else:
            # TODO: this is ugly, we need to rework this
            return self._get_or_make_FlowVector(parent=parent, type_info=type_info, store=store, step=step)

    def is_in_map(self, var_name: str) -> bool:
        """checks if the name is in map

        Args:
            var_name: fully resolved name (no member)

        Returns:
            True if in map
        """
        influence_map = self._get_influence_map()
        if var_name.startswith('$') or var_name == parse.STRING_LITERAL_TOKEN:
            # These are globals that are always available
            return True
        else:
            return (self.flow_path, var_name) in influence_map

    def add_vectors_from_other_flow(self, src_flow_path: str, output_vector_map: flow_map_t,
                                    src2tgt_variable_map: dict[str, str], transition_elem: ET.Element,
                                    is_return=False
                                    ) -> flow_map_t | None:
        """Pushes vectors in the source to vectors in the target, by wiring a flow across flow boundaries::

                old path: src A (=terminal in src)
                new path: src A -> target Y (=start in target)

        This operation is used when extending parent flows to child on subflow launch
        and extending flows from the subflow to the parent on return.

        It should be called as an instance method of the *target* state, in which the new path
        is added.

        N.B. As the src and target are variables (and not member accesses of other variables),
        we assume they have None members but the flows within the flow vector will often have member targets
        and these flows need to be resolved. E.g. the src output variable may contain flows such as::

                scalar --> src_var.Name

        And then this flow needs to be propagated individually to the .Name
        field of the target, and then all these flows added to the target vector.

        Args:
            is_return: True if we are returning from a subflow
            output_vector_map: vectors that should be pushed to target::

                                  (src path, src name) --> src FlowVector

            src2tgt_variable_map: variable name in ``src name -> target``
                                  variable name in (raw name, not a tuple)
            transition_elem: xml of subflow element
            src_flow_path: filename of child subflow

        Returns:
             map (path, variable name) -> FlowVector for all added tuples

        """

        if (src2tgt_variable_map is None or len(src2tgt_variable_map) == 0 or
                output_vector_map is None or len(output_vector_map) == 0):
            return None

        added = {}
        subflow_name = get_name(transition_elem)
        subflow_src = get_elem_string(transition_elem)
        # noinspection PyUnresolvedReferences
        subflow_line_no = transition_elem.sourceline
        out_path = self.flow_path

        vec_to_process = {}
        for x in src2tgt_variable_map:
            if (src_flow_path, x) in output_vector_map:
                vec_to_process[x] = output_vector_map[(src_flow_path, x)]

        # Now build a DataInfluencePath from the src to the target
        # use the subflow element for reporting

        # when returning from a subflow, the source_path is the target path
        # when entering a subflow, the source_path is the source path
        if is_return:
            src_path = out_path
        else:
            src_path = src_flow_path

        for (src_name, src_vec) in vec_to_process.items():
            target_var = src2tgt_variable_map[src_name]
            (tgt_parent, tgt_member, tgt_type) = self.parser.resolve_by_name(target_var)

            connect_path = InfluencePath(
                history=(InfluenceStatement(
                    influenced_var=target_var,
                    influencer_var=src_name,
                    element_name=subflow_name,
                    source_text=subflow_src,
                    line_no=subflow_line_no,
                    flow_path=out_path,
                    source_path=src_path,
                    comment=SUBFLOW_WIRE_COMMENT,
                ),),
                influencer_name=src_name,
                influencer_property=None,
                influenced_name=target_var,
                influenced_property=None,
                influencer_filepath=src_flow_path,
                influenced_filepath=out_path,
                influenced_type_info=tgt_type
            )

            # grab a reference to the target vector:
            tgt_vec = self._get_or_make_FlowVector(parent=target_var, type_info=tgt_type, path=out_path)

            # now push the src vector into the target via the connecting flow:
            tgt_vec_new = src_vec.push_via_flow(extension_path=connect_path,
                                                influenced_vec=tgt_vec,
                                                assign=True,
                                                cross_flow=True)

            # add to cache
            added[(out_path, target_var)] = tgt_vec_new

            # update influence map with the return value of the flow
            self._set_vector(vec=tgt_vec_new, variable_name=target_var, flow_path=out_path)

        return added


    def initialize_variables_from_elems(self, elems: list[ET.Element] | None) -> None:
        """Adds variables to the influence map (if not already present)

            .. WARNING:: Expert use. Only to initialize from named elements that are actually
                         Initialized. API users should use the :meth:`get_or_make` method

            Args:
                elems: XML elements to initialize

            Returns:
                None

            Raises:
                ValueError if element cannot be resolved
        """
        if elems is None:
            return None

        [self._init_vec_from_elem(x, store=True) for x in elems]
        return None

    #
    #           End of BranchState Public API
    #
    #

    def _get_or_make_FlowVector(self, parent: str, type_info: parse.VariableType, path: str = None,
                                store=False, step: CrawlStep = None)-> FlowVector:
        """Retrieve or make vector based on Variable Type

        Args:
            parent: parent object name
            type_info: Variable Type info for vector
            path: flow path
            store: True if the vector should be added to the influence map
            step: Crawl Step whose map the vector should be added to (If None, use
                  the current crawl step)

        Returns:
            Flow Vector

        """
        if path is None:
            path = self.flow_path

        infl_map = self._get_influence_map(crawl_step=step)


        var_ = (path, parent)

        if var_ in infl_map:
            return infl_map[var_]

        logger.info(f"variable {var_} not found in influence map at step {step} in flow {path}, "
                    f"creating new flow vector for it.")
        # try to get the element for better reporting:
        var_elem = self.parser.get_by_name(parent)

        if var_elem is not None:
            # noinspection PyUnresolvedReferences
            line_no = var_elem.sourceline
            source_text = get_elem_string(var_elem)
        else:
            line_no = 0
            source_text = "[builtin]"

        dfr = InfluenceStatement(
            influenced_var=parent,
            influencer_var=parent,
            element_name=parent,
            source_text=source_text,
            line_no=line_no,
            flow_path=path,
            source_path=path,
            comment=INITIALIZATION_COMMENT
        )

        flow_path = InfluencePath(history=(dfr,), influenced_name=parent, influenced_filepath=path,
                                  influencer_name=parent, influencer_filepath=path, influencer_property=None,
                                  influenced_property=None, influenced_type_info=type_info
                                  )
        flow_vector = FlowVector.from_flows(default={flow_path})
        if store:
            # add to influence map
            infl_map[var_] = flow_vector
            logger.info(f"Added {var_} to influence map at step {step} in flow {path}")
        return flow_vector

    def _get_influence_map(self, crawl_step: CrawlStep = None) -> flow_map_t | None:
        """retrieves current influence map instance for the given crawl step

        Args:
            crawl_step: key to influence map. If None, the map corresponding to the
                        current map is returned.

        Returns:
            map (str, str) -> FlowVector

        """
        if crawl_step is None:
            cs = self.current_crawl_step
        else:
            cs = crawl_step
        if cs is None:
            return self.__default_map
        else:
            return dict.get(self.__influence_map, cs, None)


    def _propagate_flows_to_vec(self, flows: set[InfluencePath],
                                vec: FlowVector, assign: bool = True,
                                step: CrawlStep = None) -> FlowVector:
        """Pushes influencers into vec

        Args:
            flows: flows to push (the endpoint vector will be pushed via the flow)
            vec: the target vector we are pushing to
            assign: True if assignment or False if addition (keep the vector's
                    old influence maps and add the pushed ones)
            step: CrawlStep (version of influence map) to use

        Returns:
            Flow vector of pushed-forward flows

        """
        accum = None
        for head_flow in flows:
            (end_parent, end_member, end_path) = (head_flow.influencer_name, head_flow.influencer_property,
                                                  head_flow.influencer_filepath)
            # auto-initialize
            if not self.is_in_map(end_parent):
                logger.warning(f"variable used in assignment {end_parent} is not initialized.")

            # Initialization happens here, as the tail must be in the map
            tail_vec = self._get_or_make_FlowVector(parent=end_parent,
                                                    type_info=head_flow.influenced_type_info, store=True, step=step)

            # Push all flows to the head of the statement for each element of head-flows
            new_vec = tail_vec.push_via_flow(influenced_vec=vec, extension_path=head_flow, assign=assign,
                                             cross_flow=False)
            # Add these in
            accum = new_vec.add_vector(accum)
        return accum

    def _set_vector(self, vec: FlowVector, variable_name: str, flow_path: str | None = None) -> None:
        """Set this vector to be in the influence map.

        .. WARNING:: Expert use. The normal evolution of the influence map
                     should be by propagating flows in the wiring module and not by manually
                     adjusting this map.

        Args:
            vec: Vector to set
            variable_name: Must be a fully resolved variable name (no properties!)
            flow_path: path if different from the current flow path of the state

        Returns:
            None
        """
        my_path = flow_path or self.flow_path
        self._get_influence_map()[(my_path, variable_name)] = vec

    def _get_vector(self, flow_path: str, name: str, step: CrawlStep = None) -> FlowVector | None:
        """returns vector from influence map if present

        .. WARNING:: 'name' must be the parent name. Variable names not supported.

        Args:
            flow_path: vector flow path.
            name: name of the vector.
            step: crawl step to use

        Returns:
            vector retrieved from influence map
        """

        return dict.get(self._get_influence_map(crawl_step=step), (flow_path, name))

    def _init_vec_from_elem(self, elem: ET.Element, store=True) -> FlowVector | None:
        """Initializes a FlowVector from the provided (named) xml element

        Args:
            elem: XML Element whose name is the vector's parent
            store: whether to store the initialization in the influence map
        Returns:
            Initialized FlowVector
        Raises:
            ValueError if the element cannot be resolved
        """
        influence_map = self._get_influence_map()
        if self.flow_path is None:
            raise RuntimeError("A flow path must be set")

        parent = get_name(elem)
        type_data = parse.build_vartype_from_elem(elem)
        if type_data is None:
            # TODO: support a tolerant mode for production, but for now we want to fail fast
            raise ValueError(f"VariableType.from_elem() could not recognize the type of {parent}. "
                             f"Check the argument and then ensure it is correctly"
                             f" handled in the VariableType.from_elem() method.")

        el_tuple = (self.flow_path, parent)
        if el_tuple in influence_map:
            return influence_map[el_tuple]

        dfr = InfluenceStatement(
            influenced_var=parent,
            influencer_var=parent,
            element_name=parent,
            source_text=get_elem_string(elem),
            line_no=get_line_no(elem),
            flow_path=self.flow_path,
            source_path=self.flow_path,
            comment=INITIALIZATION_COMMENT
        )

        flow_path = _build_path_from_history(history=(dfr,), parser=self.parser)
        flow_vector = FlowVector.from_flows(default={flow_path})
        if store:
            # add to influence map
            influence_map[el_tuple] = flow_vector
        return flow_vector

    """
        Utility methods for unit tests
    """

    def _test_only_set_influence_map(self, another_map: dict[CrawlStep, flow_map_t]) -> None:
        """set influence map for state

        .. DANGER:: Test only

        Args:
            another_map: map to add

        Returns:

        """
        self.__influence_map = another_map

    def _test_only_get_influence_map(self) -> dict[CrawlStep, flow_map_t]:
        """get influence map

        .. DANGER:: Test only function

        Returns:
            the entire influence map
        """
        # only for testing
        return self.__influence_map

    def filter_input_variables(self, output_vars: flow_map_t) -> flow_map_t | None:
        """filters vectors to remove flows starting in input variables in the current flow

        Args:
            output_vars: output variables

        Returns:
            filtered output variables

        """
        flow_path = self.flow_path
        if output_vars is None or len(output_vars) == 0:
            return None

        to_return = {}

        for var_tuple, vec in output_vars.items():

            if var_tuple[0] != flow_path:
                # only filter variables in the current flow
                to_return[var_tuple] = vec
                continue
            else:
                # we may need to filter the current flow vector
                new_maps = {}
                filtered = False

                for default, overrides in vec.property_maps.items():
                    if default.influencer_filepath != flow_path:
                        # always add these
                        new_maps[default] = overrides
                        continue

                    if default.influencer_filepath == flow_path:

                        if overrides is None:
                            if (flow_path, default.influencer_name) not in self.parser.input_variables:
                                # keep these
                                new_maps[default] = overrides
                                continue

                        else:
                            # we may need to filter property overrides
                            for prop, flow_set in overrides.items():
                                if flow_set is not None:
                                    for influence_path in flow_set:
                                        if (flow_path, influence_path.influencer_name) in self.parser.input_variables:
                                            # skip these
                                            filtered = True
                                            continue

                                        if filtered:
                                            # we skipped some properties, so we need to create a new
                                            # flow vector with the purged properties and add to the return accum
                                            if default not in new_maps:
                                                new_maps[default] = dict()
                                            if prop in new_maps[default]:
                                                new_maps[default][prop].add(influence_path)
                                            else:
                                                new_maps[default][prop] = {influence_path}

                if filtered:
                    to_return[var_tuple] = FlowVector(property_maps=new_maps)

                else:
                    # nothing was skipped, so just add the vector
                    to_return[var_tuple] = vec

        return to_return


def _build_path_from_history(parser: parse.Parser, history: tuple[InfluenceStatement, ...],
                             strict=False, **type_replacements) -> InfluencePath:
    """Creates a Dataflow Influence Path from the tuple of influence statements

        Args:
            parser: parser that can convert variables in statements to
                element names and properties, as well as extract type
                information from the flow xml file.
            history: tuple of DataflowInfluenceStatement
            type_replacements: [expert use] name/value pairs for property overrides

        Returns:
            DataflowInfluencePath
        """

    if history is None or len(history) == 0:
        raise ValueError("Attempted to construct a DataInfluencePath with null history")

    last = history[-1]
    first = history[0]

    try:
        (first_parent, first_member, first_type) = parser.resolve_by_name(first.influencer_var, strict=strict)
        (last_parent, last_member, last_type) = parser.resolve_by_name(last.influenced_var, strict=strict)
    except TypeError as e:
        print(f"Resolver error for {first.influencer_var} or {last.influenced_var} ")
        print(traceback.format_exc())
        raise e

    my_type = propagate(src_type=first_type, dest_type=last_type, **type_replacements)

    return InfluencePath(history=history,
                         influenced_name=last_parent,
                         influencer_name=first_parent,
                         influencer_filepath=first.flow_path,
                         influenced_filepath=last.flow_path,
                         # this is critical or else it will go in the wrong slot
                         influenced_property=last_member,
                         influencer_property=first_member,
                         influenced_type_info=my_type
                         )


def _build_formula_map(parser: parse.Parser, flow_path: str) -> infl_map_t:
    """Formulas and Templates need to be resolved at each invocation, so this map
    returns a ready-made set of dataflows to wire in case a formula appears in a
    data influence statement.

    Args:
        parser: instance to build dataInfluencePaths
        flow_path: filepath of current flow

    Returns:
        a fully resolved map:: {(flow_path, elem_name) --> [DataflowInfluencePaths]}
    """
    raw_formula_map = _get_raw_formula_map(parser, flow_path)
    flow_path = parser.flow_path
    to_return = {}

    for x in raw_formula_map:
        to_return[(flow_path, x)] = _resolve_influencers(x, raw_formula_map, parser)
    return to_return


def _get_raw_formula_map(parser: parse.Parser, flow_path: str) -> local_infl_map_t:
    """
    Args:
        parser: parser instance
        flow_path: path of current flow

    Returns:
        {name of formula_elem --> [DataInfluenceStatements] that
        influence the formula }
    """
    accum = {}
    ns_len = len(parse.ns)
    tuples = parser.get_all_indirect_tuples()
    for (var_name, elem) in tuples:
        formula_name = parse.get_name(elem)
        short_tag = elem.tag[ns_len:]
        stmt = InfluenceStatement(
            influenced_var=formula_name,
            influencer_var=var_name,
            element_name=formula_name,
            comment=f"Parsed from {short_tag}",
            line_no=get_line_no(elem),
            source_text=get_elem_string(elem),
            flow_path=flow_path,
            source_path=flow_path
        )
        if formula_name in accum:
            accum[formula_name].append(stmt)
        else:
            # initialize as a list of DIRs
            accum[formula_name] = [stmt]
    return accum


def _extend_formula_map_by_flows(start_flows: set[InfluencePath],
                                 formula_map: infl_map_t,
                                 add_missing: bool = True) -> set[InfluencePath]:
    """Resolves a flow if the influencer is a formula in terms of real variables.

        .. WARNING:: This function does not perform any vectorization!
                     Use only with formula/template flows (which are all scalars)

        If start flows = ``[B->A]``,
        and the flow_map has ``[X->B]`` and ``[Y->B]``, then
        the result will be 2 flows: ``[X->A], [Y->A]``.

        If start flows = ``[W -> A]`` and there is no extending flow, then we at least
        return ``[W->A]`` if add_missing is ``True``. This is equivalent to initializing
        the variable and adding it to the influence map before proceeding.

    Args:
        start_flows: a set of DataInfluencePaths
        formula_map: flow map to extend by
        add_missing: whether to ensure that all start influencers are included.

    Returns:
        a set of DataInfluence paths consisting of all possible
        extensions of flows by the map.

    """
    if start_flows is None or len(start_flows) == 0:
        raise ValueError("Cannot extend an empty set")

    accum = set()

    if formula_map is None:
        formula_map = {}

    for flow in start_flows:
        flow_influencer = (flow.influencer_filepath, flow.influencer_name)
        if flow_influencer in formula_map:
            map_influencing = formula_map[flow_influencer]
            [accum.add(InfluencePath.combine(x, flow)) for x in map_influencing]

        elif add_missing:
            #  a match was not found, so we add the original flow:
            accum.add(flow)

    return accum


def _resolve_influencers(elem_ref_name: str,
                         raw_formula_map: local_infl_map_t,
                         parser: parse.Parser) -> set[InfluencePath]:
    """Resolves indirect references

    This function exists to handle recursion in formulas/templates::

        formula1 expression:  {!formula2} + {!var1} + {!template3}

    Then the raw formula map will have::

        formula1 = {
                      formula1 <-- var2,
                      formula1 <-- formula2,
                      formula1 <-- template3,
                      }

    Keep unpacking this with a double ended queue, creating
    longer influence paths, until all influence paths start with
    direct elements (elements not in the formula map).
    and then this set of influence paths is stored in the formula_map::

       formula_map[formula1] = {
            formula1 <-- formula2 <-- var1,
            formula1 <-- var2,
            formula1 <-- template3 <-- var7
            }

    Args:
        elem_ref_name: the formula or template elem name to resolve
        raw_formula_map: the raw map
        parser: parser to create influence paths

    Returns:
        value of the formula map for elem_ref_name
    """
    # we should only be resolving indirect references
    assert elem_ref_name in raw_formula_map

    accum = set()
    # Raw map has DFR, so turn these into flows
    to_resolve = [_build_path_from_history(history=(x,), parser=parser, strict=False)
                  for x in raw_formula_map[elem_ref_name]]

    seen_resolvers = set()

    while len(to_resolve) > 0:
        curr_flow = to_resolve.pop()
        if (curr_flow.influencer_name in raw_formula_map and
                curr_flow.influencer_name not in seen_resolvers):

            seen_resolvers.add(curr_flow.influencer_name)

            to_resolve = to_resolve + [InfluencePath.combine(
                _build_path_from_history(history=(x,), parser=parser), curr_flow
            ) for x in raw_formula_map[curr_flow.influencer_name]
            ]
        else:
            accum.add(curr_flow)

    # Now prune
    # TODO: this is inefficient, but is only done once on flow initialization
    # We assume all formula maps resolve -- e.g. there are no loops where
    # {!formula1} = {!formula2} + {!var1}
    # {!formula2} = {!formula1} + {!var3}
    # therefore the fully resolved map will not reference any formulas as influencers
    # But the map as constructed above includes intermediate steps. E.g. if
    # formula1 <- formula2 <- var
    # then the accum will have
    # formula1 <- formula2 and
    # formula1 <- formula2 <- var
    # ...so we remove the intermediate flows here:
    duplicates = set()
    for x in accum:
        if x.influencer_name in raw_formula_map:
            duplicates.add(x)
            # no need to look for other occurrences in raw_formula_map
            continue

    deduped = accum - duplicates

    # next, we limit how many times the same influencer can appear
    # NOTE: this will result in some loss of accuracy, because it's
    # possible than the same variable will influence an expression in
    # different ways, only one of which are security relevant, and this
    # analysis may hide that info by pruning meaningful dataflow paths.
    #
    # However, we want to limit dataflow explosion so there is a trade off.
    #
    # TODO: consider doing this only for large formula maps

    seen_influencers = {}
    excess_influencers = set()

    for x in deduped:
        if x.influencer_name not in seen_influencers:
            seen_influencers[x.influencer_name] = 1
        else:
            if seen_influencers[x.influencer_name] == MAX_FORMULA_DUPLICATES:
                excess_influencers.add(x)
            else:
                seen_influencers[x.influencer_name] += 1

    return deduped - excess_influencers


def _populate_defaults(state: BranchState, parser: parse.Parser) -> None:
    """Adds globals to default influence map

    Args:
        state: :class:`BranchState` to populate
        parser: parser associated to flow file

    Returns:
        None

    """
    # all variables
    all_vars = parser.get_all_variable_elems() or []
    all_templates = parser.get_templates()
    all_formulas = parser.get_formulas()
    all_choices = parser.get_choices()
    all_constants = parser.get_constants()
    state.initialize_variables_from_elems(all_vars + all_templates + all_formulas
                                          + all_choices + all_constants)
