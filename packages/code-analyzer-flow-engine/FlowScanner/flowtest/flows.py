"""Flow propagation data structures and algorithms

    @author: rsussland@salesforce.com

"""
from __future__ import annotations
import logging
import copy
import json
import typing
from collections.abc import Callable
from dataclasses import dataclass, replace

import flowtest.util
from flowtest.util import is_non_null, id_, match_all
from public.data_obj import DataInfluencePath

#: module logger
logger = logging.getLogger(__name__)


@dataclass(frozen=True, eq=True, slots=True)
class FlowVector:
    """Common data structure for both vectors and scalars.

     FlowVector supports vectorization, so that we can accurately
     track taint as follows::

              taint --> Case.Subject
              Case  --> Case2
              Case2.Status  --> sink1  // detect not tainted
              Case2.Subject --> sink2  // detect tainted

    """
    # For each default path, this list has the overrides.
    # An override is a map: "property name" --> {DataInfluencePaths} that
    # influence this property
    property_maps: dict[DataInfluencePath: dict[str: set[DataInfluencePath]]]

    # TODO: revisit this later if a property spec is needed
    # property_spec: set[str] | None

    @classmethod
    def from_flows(cls, default: {DataInfluencePath} = None) -> FlowVector:
        """Builds a vector from the provided flows.

        Flows must all have the same influencer_name and no flow can have a non-null influencer_property.

        Notes:
            Do not use FlowVector constructor outside the ``flows`` module, use this method instead
            and build FlowVectors up using the provided instance methods as a result of parsing program
            elements.

            This method should be used to initialize variables by building the initialization flow
            (where a variable influences itself)

        Args:
            default {`DataInfluencePath`}: each of these paths should be assigned to their own default

        Returns:
            FlowVector instance with the provided flows as defaults

        Raises:
            ValueError if the flows have different influenced_name, or if default is empty.
        """
        # we make an exception:
        if isinstance(default, DataInfluencePath):
            default_ = {default}
        elif not isinstance(default, set):
            raise ValueError("Please call with set argument")
        else:
            default_ = default
        # add guards
        if default_ is None or len(default_) == 0:
            raise ValueError("Called builder with empty default")

        check = list(set([(x.influenced_name, x.influenced_property) for x in default_]))

        if len(check) != 1 or check[0][1] is not None:
            raise ValueError("When creating a FlowVector, all flows need to influence the same variable name"
                             " and have null influenced_property")

        # build the map, initializing the property map to None for each dataflow
        property_map = {}
        for flow in default_:
            property_map[flow] = None

        return FlowVector(property_maps=property_map)

    def short_report(self, indent=2) -> str:
        """Brief string serialization of the FlowVector (for testing and reporting)


        Args:
            indent: number of spaces for indentation

        Returns:
            summary of defaults and property maps

        """

        str_prop_map = {}
        for curr_default, val in self.property_maps.items():
            def_str = curr_default.short_report(arrows=True)
            if val is not None:
                str_props = list(val.keys())
                tmp = {}
                for prop in str_props:
                    if val[prop] is not None:
                        # each property maps to a set of flows,
                        # which should be sorted and converted to strings
                        str_flowset = [x.short_report(arrows=True) for x in list(val[prop])]
                        str_flowset.sort()
                        tmp[prop] = str_flowset
            else:
                # no property maps for this default
                tmp = None

            str_prop_map[def_str] = tmp

        return json.dumps(str_prop_map, indent=indent, sort_keys=True)

    def report_dict(self) -> {str: {str: {str}}}:
        """get brief object dict with stringified flows

        flows are replaced with arrow and star notation
        in :meth:`DataInfluencePath.short_report` and are
        sorted alphabetically in all keys and (non-None) values.

        Returns:
            dict with the following schema::

                {default flows : {property_name: {flows}} | None }

        """
        loaded = json.loads(self.short_report())
        # json notation does not support sets, so turn the list of prop flows into a set
        for default in loaded:
            if loaded[default] is not None:
                for prop in loaded[default]:
                    if loaded[default][prop] is not None and len(loaded[default][prop]) > 0:
                        loaded[default][prop] = set(loaded[default][prop])
                    else:
                        loaded[default][prop] = loaded[default][prop] and None

        return loaded

    def get_flows_by_prop(self, member_name: str | None = None) -> {DataInfluencePath}:
        """Returns this vector's flows with the requested influenced property name.

        Args:
           member_name: If None, returns all flows (including overrides)
                        Otherwise, returns all flows for the named property.

        Returns:
            The requested flows associated to *all default indexes* consolidated into a set,
            or empty set if no match.
        """
        to_return = set()
        defaults = set(self.property_maps.keys())

        # match anything if None, or require an exact name match if one was requested
        prop_match = flowtest.util.build_match_on_null(member_name)

        # make sure everything matches as we need to know if there are no flows for this prop
        flow_match = match_all

        # will return requested (default, prop flows)
        action = _build_action_restrict_if_no_prop(wanted_prop=member_name)
        res = self._search_props(prop_matcher=prop_match,
                                 flow_matcher=flow_match,
                                 action=action)

        # add in only the properties in the tuple returned by the action
        to_return.update([x[1] for x in res])

        # Now, after querying the properties, we add in defaults
        if member_name is None:
            # requesting no property means all paths are returned
            to_return.update(defaults)
        else:
            # Now need to add missing flows, for example if a default had no properties
            # at all, then action will not find it. So we compare the returned
            # defaults from the prop query to make sure we have full coverage
            # for all primary paths:
            seen_defaults = {x[0] for x in res}
            [to_return.add(_restrict(x, member_name))
             for x in defaults if x not in seen_defaults]

        return to_return

    def add_vector(self, vector: FlowVector) -> FlowVector:
        """Create new vector that adds flows of self and ``vector``.

        Notes:
            * Both must be at the same variable name

        Args:
            vector: vector containing new flow information

        Returns: new FlowVector representing the sum

        ==============
        Adding Vectors
        ==============

        In flows, the concept of "adding" objects or scalars
        is overloaded to mean either

            1) adding an element to a collection (object or scalar), or
            2) combining two scalar values (e.g. string concatenation)

        For dataflow analysis, we are adding sets of influence paths,
        for example when exiting a flow.

        This means that all the influencers of
        the first are added to the influencers of the second (which
        can create a doubling of flow paths) via set-addition.

        Care must be taken when the generic case is the same but overrides
        differ. Imagine program execution along two branches, followed
        by combining the branches (say a function return). Then we
        know that in reality, only one branch can be taken in an execution
        run, but there is the possibility of cross-contamination. E.g.
        in branch 1, Account.Name can change, and in branch 2, Account.Description,
        but when we merge, we need to decide whether to combine both into "account"
        and merge the overrides or to keep them as separate vectors with different
        overrides. This boils down to whether the default vector is a key for the
        override map or whether the better data structure is a tuple of a vector
        and its overrides, with the addition operation always adding new tuples.

        Presently we opt for first approach - merging the overrides
        of the two vectors, because in principle, we still retain all the
        information in the override dataflow histories - for example, we can store
        the state branch id in each path - and it is the examination of the overrides
        where fine-grained exclusion analysis should happen.

        This choice forces us to create dummy (induced) overrides because
        the nature of overrides is that they are always selected, so if `A.Name` has
        an override, `foo` in path `A`, but not in path `B`, then we want to get both
        `A.Name` and `foo` when requesting the override of the sum of path A and path B.

        """

        if vector is None:
            return copy.deepcopy(self)

        new_property_map = {}
        # default in self but not in vector
        for x in self.property_maps:
            if x not in vector.property_maps:
                new_property_map[x] = copy.deepcopy(self.property_maps[x])

        # default in self and vector
        for other_def in vector.property_maps:
            if other_def in self.property_maps:
                # The merge-override method is where we create induced paths
                new_property_map[other_def] = _merge_override(other_def, copy.deepcopy(self.property_maps[other_def]),
                                                              copy.deepcopy(vector.property_maps[other_def]))

        # default in vector but not self:
        for x in vector.property_maps:
            if x not in self.property_maps:
                new_property_map[x] = copy.deepcopy(vector.property_maps)[x]

        return FlowVector(property_maps=new_property_map)

    def push_via_flow(self, extension_path: DataInfluencePath, influenced_vec: FlowVector,
                      assign: bool = True,
                      cross_flow: bool = False) -> FlowVector:
        """Build new FlowVector with all influence paths in self pushed into ``vec`` via the extension_path.

        For example, if the current vector corresponds to influencers of ``A``, and ``vec`` to ``B``,
        then we can push A into B as follows:

        ``1.   A.x --> B``
            Then ``B`` must be a scalar and the default of ``B`` is populated with the extended influencers
            of ``A``'s x property. If ``assign`` is ``False``, then the existing influencers of ``B``'s x
            property are added to those pushed forward from ``A``.

        ``2.   A --> B.x``
            Then ``A`` must be a scalar and the defaults of ``A`` are pushed forward into ``B``'s x-property
            influencers. If ``assign`` is ``False``, then ``B``'s existing property influencers are also kept.

        ``3.   A.x --> B.x``
            Then ``A`` and ``B`` must be Objects, and the x-property influencers of ``B`` are reassigned
            to those pushed forward from ``A.x``, and if `assign` is `False`, B also retains its existing
            x-property influencers.

        ``4.   A --> B``
            Then all the influencers of A are pushed forward to B, either replacing ``B`` or
            adding to ``B``'s existing influencers.

        Args:
            extension_path: DataInfluencePath to push forward by
            influenced_vec: The target vector that is influenced by the statement
            assign: ``True`` for assignment and ``False`` for addition. Note that
                object addition corresponds to enlarging a collection.
            cross_flow: if ``True``, allows this extension to cross flows, which requires
                                     the flow being extended by to cross flows.

        Returns:
            new FlowVector

        Raises:
            ValueError if there is a variable name mismatch.

        """
        if extension_path.influenced_property is None:
            # the entire vector is pushed
            pushed_vec = self._extend_by_path(flow=extension_path, cross_flow=cross_flow)
            if assign is False:
                # we add the pushed values to the present values
                return influenced_vec.add_vector(pushed_vec)

            else:
                # pushed vec replaces vec
                return pushed_vec

        else:
            # A.x ---> B.y or
            # scalar --> B.y
            # we want to use assign_or_add_property_flows()
            # and we need to extend the flows of A selected by x to B
            to_extend = self.get_flows_by_prop(extension_path.influencer_property)
            if to_extend is None or len(to_extend) == 0:
                return FlowVector(property_maps=copy.deepcopy(influenced_vec.property_maps))
            else:
                accum = set()
                for flow_ in to_extend:
                    accum.add(
                        DataInfluencePath.combine(
                            start_flow=flow_,
                            end_flow=extension_path,
                            cross_flow=cross_flow
                        )
                    )

                return influenced_vec._assign_or_add_property_flows(accum, assign=assign)

    #
    #
    #           End of FlowVector Public API
    #
    #

    def _extend_by_path(self, flow: DataInfluencePath, cross_flow: bool = False) -> FlowVector:
        """Creates a new flow vector by *pushing forward* this vector's flows.

        ===========================
        Pushing FlowVectors Forward
        ===========================

        Consider the vector ``A`` with a simple influencer vector::

                            A: default: B --> A  (path 1)
                            A.x:  C.y --> A.x    (path 2)
                            A.y:  t ----> A.y    (path 3)

        When we apply the influence map: ``A --f--> D``, this generates a
        new vector at D::

                fA  default: B ---> D  (combine path 1 with f)
                    D.x: C.y ---> D.x  (combine path 2 with f restricted to x)
                    D.y:   t ---> D.y  (combine path 3 with f restricted to y)

        Suppose the influence vector has an influencer_property, so it is
        ``A.x --g--> Z`` (Note that Z must be a scalar variable). The new flows
        will be::

                gA  default: C.y ---> Z  (combine path 2 with g)
                    Z.x: None
                    Z.y: None

        Because ``property_maps`` *always override* the default. Notice that
        if there are N DataInfluencePaths influencing ``Z.x``, then the pushed
        forward vector will have N defaults. So neither the size ``defaults``
        field nor ``property_maps`` is preserved by the
        push-forward operation when overrides are picked up (but it is otherwise
        in the generic, e.g. non-singular, case).

        As a last example, suppose the ``influencer_property`` of the pushing flow is
        not in the property map: ``A.v --h--> Z``.

        Then the pushed vector is::

                hA  default: B.v ---> Z  (combine path 1 with g)
                    Z.x: None
                    Z.y: None

        Notes:
            In order to use this function:

            1) `flow.influenced_property` must be None, otherwise we are in
               the singular case and the image is not a full FlowVector
            2) `flow.influenced_name` of the flow must match the flow.influenced_name
               properties of all the flows in this vector.

        Args:
            flow: The DataInfluencePath to extend by

            cross_flow: True if the new vector is in a different flow than
                        the current one (default to False).

        Returns:
            Flow Vector pushed forward by the influence path.

        """
        if flow.influenced_property is not None:
            raise ValueError(f"called with flow {flow} that has a non-null influencer."
                             "This means the flow only inserts into a portion of "
                             "a vector and so cannot be used to generate a new vector. "
                             "To push this vector into part of an existing vector, "
                             " please use the combine_via_path method and provide "
                             "the target vector.")

        new_property_maps = dict()
        tgt_prop = flow.influencer_property

        if tgt_prop is None:

            # structures are preserved. flow is A --> B
            # push default forward
            for curr_default in self.property_maps:
                pushed_default = DataInfluencePath.combine(
                    start_flow=curr_default, end_flow=flow, cross_flow=cross_flow)

                # and push all property maps forward *if they exist*
                # otherwise the method will return None
                if self.property_maps[curr_default] is not None:
                    # initialize:
                    new_property_maps[pushed_default] = {}

                    # take *all* property_overrides and push them forward
                    for prop in self.property_maps[curr_default]:
                        if (self.property_maps[curr_default][prop] is not None and
                                len(self.property_maps[curr_default][prop]) > 0):
                            new_property_maps[pushed_default][prop] = {
                                DataInfluencePath.combine(
                                    start_flow=override,
                                    end_flow=_restrict(flow, prop),
                                    cross_flow=cross_flow
                                ) for override in self.property_maps[curr_default][prop]}

                else:
                    new_property_maps[pushed_default] = None
        else:
            # tgt_prop is not None, so the flow is A.x --> B
            # Therefore the target is a scalar and will have
            # null overrides and more defaults. This
            # is tracked with new counter:
            for curr_default in self.property_maps:

                if self.property_maps[curr_default] is None or tgt_prop not in self.property_maps[curr_default]:

                    # there is no override for tgt_prop, but the flow wants it, so
                    # induce a property from defaults via restriction, e.g.
                    # old flow: A->B->C
                    # map: C.x->D
                    #
                    # we restrict: A.x->B.x->C.x, and then combine C.x->D
                    pushed_default = DataInfluencePath.combine(
                        start_flow=_restrict(curr_default, tgt_prop),
                        end_flow=flow,
                        cross_flow=cross_flow
                    )
                    assert pushed_default not in new_property_maps
                    new_property_maps[pushed_default] = None

                else:
                    # There is an override for target prop, so push all its flows into the property_maps
                    pushed_defaults = [DataInfluencePath.combine(
                        start_flow=x,
                        end_flow=flow,
                        cross_flow=cross_flow
                    ) for x in self.property_maps[curr_default][tgt_prop]]
                    for x in pushed_defaults:
                        assert x not in new_property_maps
                        new_property_maps[x] = None

        # end of if-statement
        return FlowVector(property_maps=new_property_maps)

    def _search_props(self, defaults_matcher: Callable[[DataInfluencePath], bool] = is_non_null,
                      prop_matcher: Callable[[str | None], bool] = is_non_null,
                      flow_matcher: Callable[[DataInfluencePath | None], bool] = is_non_null,
                      action: Callable[[DataInfluencePath, str, DataInfluencePath], typing.Any] = id_
                      ) -> typing.Any:
        """Searches through FlowVector based on match conditions.

        .. WARNING:: Be careful when removing flows from vectors,
                     as override relationships are lost.

        The intention of this module is to simplify bookkeeping logic
        associated to FlowVectors, which are primarily accounting containers
        to track property overrides.

        For example:

            * return all overrides for a specific property in all defaults
            * return all defaults and all overrides
            * return all defaults that have no override for a specific property

        As our data structure is a recursive dictionary, repeatedly nesting
        for-loops with additional handling of null cases
        is error-prone and creates logic that is difficult to maintain.

        All such queries should be replaced with appropriate match callables and passed
        into this function.

        Notes:
            * All callables are optional, as is the action.

            * All matching tuples are returned regardless of the action callable

            * The action callable is passed matching tuples in flattened form,
              just as the return values.

              E.g.::

                    (default_name, prop_name, function1)
                    (default_name, prop_name, function2)

              and the result of action for each tuple is returned by the function.

            * The defaults matcher will never match to None.

            * The default ``action`` callable is the identity.

            * If a prop matcher or override matcher matches None,
              then None will be passed into the match tuples for the action
              callable.

            * If no callable is provided for an entry, one that matches
              any non-null will be used. Thus, calling this
              method with no arguments returns a flattened property map with
              all non-null entries.

            * matches short circuit, so matchers in the next level are only
              invoked on matches in the previous level. The action is invoked
              on the flattened matches when the search is complete.

            * Callables should be pulled from the util module.

        Args:
            defaults_matcher: callable to match on :attr:`FlowVector.defaults`
            prop_matcher: callable to match on property names
            flow_matcher: callable to match on DataInfluencePaths in overrides
            action: function that accepts a matched values (DataInfluencePath, str, DataInfluencePath)

        Returns:
            results of applying ``action`` to matches. None values from action are not returned.

        """
        assert action is not None
        assert prop_matcher is not None
        assert flow_matcher is not None
        assert defaults_matcher is not None

        # TODO: clean this up with iters, but it's good enough for now
        accum = set()
        for current_default, prop_map in self.property_maps.items():
            if defaults_matcher(current_default):
                if (prop_map is None and prop_matcher(None) and
                        flow_matcher(None)):
                    accum.add((current_default, None, None))
                elif prop_map is None:
                    continue
                else:
                    for prop in prop_map:
                        if prop_matcher(prop):
                            if prop_map[prop] is None and flow_matcher(None):
                                accum.add((current_default, prop, None))
                            elif prop_map[prop] is None:
                                continue
                            else:
                                for flow in prop_map[prop]:
                                    if flow_matcher(flow):
                                        accum.add((current_default, prop, flow))

        if action is not None:
            to_return = set()
            for (default, prop, flow) in accum:
                action_res = action(default, prop, flow)
                if action_res is not None:
                    to_return.add(action_res)

            return to_return

        else:
            return accum

    def _assign_or_add_property_flows(self, flows: {DataInfluencePath}, assign: bool = True
                                      ) -> FlowVector:
        """Injects DataInfluencePaths into vector.

        .. WARNING:: Expert use only as FlowVector can be corrupted by adding the wrong flows.

        Flows are unstructured, so where the flow is placed depends on
        the :attr:`DataInfluencePath.influenced_property` attribute of each flow.
        All flows must have a non-null influencer property, otherwise
        the entire vector is being pushed and the :meth:`FlowVector.extend_by_path` method
        should be used instead of this (injective) method.

        Notes:
            * Use this method to model the injection of different property flows, for example::
                        A.x --f-> B.y

            * Would cause the y-member flows of B to change by the path ``f``.

            * When paths are 'added', induced maps need to be created when target
              overrides are missing, otherwise the added override will always take
              over, and we lost the ability to keep both added and original resolutions.

        Args:
            flows: A set of flows each of which should have a non-null influenced_property
                   attribute.
            assign: if (True), the existing flows are replaced, otherwise they are added to the
                    existing flows.
        Returns:
            new FlowVector

        Raises:
            ValueError if a flow is passed with a null influenced_property.
        """

        if flows is None or len(flows) == 0:
            return self

        new_property_maps = copy.deepcopy(self.property_maps)
        for flow in flows:
            prop = flow.influenced_property
            if prop is None:
                raise ValueError(f"Received flow {flow} with null influencer.")

            for default_ in self.property_maps:
                if self.property_maps[default_] is None or prop not in self.property_maps[default_]:
                    _safe_add(new_property_maps, default_, flow, assign)

                elif assign is True:
                    new_property_maps[default_][prop] = {flow}

                else:
                    # property maps index has this property and we are adding
                    new_property_maps[default_][prop].update({flow})

        return FlowVector(property_maps=new_property_maps)


"""

simple lambda for sorting

"""


def _sort_key(x):
    return x.short_report(arrows=True)


def _merge_override(default: DataInfluencePath,
                    first: {str: {DataInfluencePath}},
                    second: {str: {DataInfluencePath}}) -> {str: {DataInfluencePath}}:
    """Take the property map for a specific default and combine it with another
    Args:
        default: default flow for this map
        first: map from properties to sets of flows
        second: map from properties to sets of flows

    Returns:
        New map that is the combination of the two or None if both maps are None
    """

    # Take care of degeneracies
    if first is None and second is None:
        return None

    keys_to_update = set()
    keys_to_update.update(second and second.keys() or set())
    keys_to_update.update(first and first.keys() or set())

    if None in keys_to_update:
        keys_to_update.remove(None)

    accum = {}
    for key in keys_to_update:
        induced_set = {_restrict(default, key)}

        first_set = (first and dict.get(first, key, induced_set)) or induced_set
        second_set = (second and dict.get(second, key, induced_set)) or induced_set
        first_set.update(second_set)
        accum[key] = first_set
    return accum


"""

Callable builders 

"""


def _build_action_restrict_if_no_prop(wanted_prop: str) -> Callable:
    def action(default: DataInfluencePath, curr_prop: str | None,
               flow: DataInfluencePath) -> (DataInfluencePath, DataInfluencePath):

        # The matchers will ensure we have a prop-wanted prop match,
        # but we still need the wanted prop variable because a wanted prop
        # of 'None' may be passed, in which case everything is wanted.

        if wanted_prop is None:
            # When the caller does not specify a desired property,
            # then all requested, so return all flows if they exist
            if flow is not None:
                return default, flow

        if wanted_prop is not None and flow is None:
            # we don't have an override, so we return the restricted default
            # Both endpoints are restricted, since we have an object map:
            # e.g. Account_var1 --> Account_var2, so the request for
            # Account_var.Name induces the flow
            #    from Account_var1.Name -> Account_var2.Name
            return default, _restrict(default, wanted_prop)

        if wanted_prop is not None and flow is not None:
            # sanity check to make sure the filters are working
            assert curr_prop == wanted_prop
            return default, flow

        return None

    return action


"""
    
        Property Map manipulation functions

"""


def _safe_add(my_prop_map: {DataInfluencePath: {str: {DataInfluencePath}}},
              my_default: DataInfluencePath,
              flow: DataInfluencePath, assign: bool = True) -> None:
    """add function that provides the induced flow if needed

    Need to add the induced flow from the default
    as well as the flow to the corresponding key.

    Args:
        my_prop_map: full property map
        my_default: default being updated
        flow: flow being added
        assign: True if elements are being assigned, False if added

    Returns:
        None, the passed in map is updated.

    """
    prop = flow.influenced_property

    if assign is True:
        to_add = {flow}
    else:
        induced_flow = _restrict(my_default, prop)
        to_add = {flow, induced_flow}
    if my_prop_map[my_default] is None:
        my_prop_map[my_default] = dict()
        my_prop_map[my_default][prop] = to_add

    elif prop not in my_prop_map[my_default] or my_prop_map[my_default][prop] is None:
        my_prop_map[my_default][prop] = to_add
    else:
        # there is already a flow for this property so no need to add
        # an induced default even if 'add' was requested.
        my_prop_map[my_default][prop].update({flow})


def _safe_update(prop: str, x: set, old_map: {str: set}) -> None:
    """Merges a set into a map at the specified property

    Args:
        prop: string (not null)
        x: must not be None
        old_map: must not be None, but can be none on any property

    Returns:
        new map that merges both

    """
    assert x is not None

    if prop not in old_map or old_map[prop] is None:
        old_map[prop] = x
    else:
        old_map[prop].update(x)


def _restrict(dataflow: DataInfluencePath, prop: str) -> DataInfluencePath:
    """Restricts path to a member property

    Args:
        dataflow: path
        prop: restriction

    Returns: 
        restricted path

    """
    if prop is None:
        return dataflow

    return replace(dataflow,
                   influencer_property=prop,
                   influenced_property=prop)
