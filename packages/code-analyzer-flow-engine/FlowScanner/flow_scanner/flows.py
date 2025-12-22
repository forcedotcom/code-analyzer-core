"""Flow propagation data structures and algorithms.

This module implements the FlowVector data structure and algorithms for
propagating data influence paths through flow elements.
"""
from __future__ import annotations
import logging
import json
import typing
from collections.abc import Callable
from dataclasses import dataclass, replace

import flow_scanner.util
from flow_scanner.util import is_non_null, id_, match_all
from public.data_obj import InfluencePath
from public.contracts import AbstractFlowVector

#: module logger
logger = logging.getLogger(__name__)

# --- Type Definitions ---
# A map of property names to the sets of paths influencing them
# Note: Values can be None, representing no overrides for that property
PropertyOverrides = dict[str, set[InfluencePath] | None]

# A map of Default Paths to their specific Property Overrides
# Note: Values can be None, representing no property overrides for that default
VectorPropertyMap = dict[InfluencePath, PropertyOverrides | None]


def _copy_property_maps(prop_maps: VectorPropertyMap) -> VectorPropertyMap:
    """Shallow copy of property_maps structure.

    Since InfluencePath and all nested structures contain only immutable objects,
    we only need to copy the container structure, not the contents.
    """
    result = {}
    for key, value in prop_maps.items():
        if value is None:
            result[key] = None
        else:
            # Shallow copy the inner dict: keys are strings (immutable),
            # values are sets of InfluencePath (immutable) or None
            result[key] = {prop: flows.copy() if flows is not None else None
                           for prop, flows in value.items()}
    return result


def _copy_property_map_entry(entry: PropertyOverrides | None) -> PropertyOverrides | None:
    """Copy a single property map entry (None or dict)."""
    if entry is None:
        return None
    # Shallow copy: dict keys are strings (immutable), set elements are InfluencePath (immutable)
    return {prop: flows.copy() if flows is not None else None
            for prop, flows in entry.items()}


@dataclass(frozen=True, eq=True, slots=True)
class FlowVector(AbstractFlowVector):
    """Common data structure for both vectors and scalars."""

    # For each default path, this list has the overrides.
    property_maps: VectorPropertyMap

    @classmethod
    def from_flows(cls, default: set[InfluencePath] = None) -> FlowVector:
        """Build a vector from the provided flows.

        Args:
            default: Set of InfluencePath objects to initialize the vector with.
                Can also be a single InfluencePath (converted to set).

        Returns:
            New FlowVector instance.

        Raises:
            ValueError: If default is empty, None, or flows don't influence
                the same variable name with null influenced_property.
        """
        # we make an exception:
        if isinstance(default, InfluencePath):
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

    def short_report(self, indent: int = 2) -> str:
        """Generate brief string serialization of the FlowVector.

        Args:
            indent: Number of spaces for indentation. Defaults to 2.

        Returns:
            String representation of the FlowVector for testing and reporting.
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
                tmp = None

            str_prop_map[def_str] = tmp

        return json.dumps(str_prop_map, indent=indent, sort_keys=True)

    def report_dict(self) -> dict[str, dict[str, set[str]]]:
        """Get brief object dictionary with stringified flows.

        Returns:
            Dictionary representation with flows converted to strings.
        """
        loaded = json.loads(self.short_report())
        # JSON notation does not support sets, so turn the list of prop flows into a set
        for default in loaded:
            if loaded[default] is not None:
                for prop in loaded[default]:
                    if loaded[default][prop] is not None and len(loaded[default][prop]) > 0:
                        loaded[default][prop] = set(loaded[default][prop])
                    else:
                        loaded[default][prop] = loaded[default][prop] and None

        return loaded

    def get_flows_by_prop(self, member_name: str | None = None) -> set[InfluencePath]:
        """Get this vector's flows with the requested influenced property name.

        Args:
            member_name: Property name to filter by. If None, returns all flows.

        Returns:
            Set of InfluencePath objects matching the property name.
        """
        to_return = set()
        defaults = set(self.property_maps.keys())

        # match anything if None, or require an exact name match if one was requested
        prop_match = flow_scanner.util.build_match_on_null(member_name)

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
            # Now need to add missing flows
            seen_defaults = {x[0] for x in res}
            [to_return.add(_restrict(x, member_name))
             for x in defaults if x not in seen_defaults]

        return to_return

    def add_vector(self, vector: FlowVector) -> FlowVector:
        """Create new vector that combines flows of self and vector.

        Args:
            vector: FlowVector to add to this one.

        Returns:
            New FlowVector with combined flows from both vectors.
        """

        if vector is None:
            return FlowVector(property_maps=_copy_property_maps(self.property_maps))

        new_property_map = {}

        # 1. Default in self but not in vector: Copy from self
        for x in self.property_maps:
            if x not in vector.property_maps:
                new_property_map[x] = _copy_property_map_entry(self.property_maps[x])

        # 2. Default in self and vector: Merge
        for other_def in vector.property_maps:
            if other_def in self.property_maps:
                # The merge-override method creates new sets via union,
                # so we can safely pass the original maps without pre-copying.
                new_property_map[other_def] = _merge_override(
                    other_def,
                    self.property_maps[other_def],
                    vector.property_maps[other_def]
                )

        # 3. Default in vector but not self: Copy from vector
        for x in vector.property_maps:
            if x not in self.property_maps:
                new_property_map[x] = _copy_property_map_entry(vector.property_maps[x])

        return FlowVector(property_maps=new_property_map)

    def push_via_flow(self, extension_path: InfluencePath, influenced_vec: FlowVector,
                      assign: bool = True,
                      cross_flow: bool = False) -> FlowVector:
        """Build new FlowVector with all influence paths in self pushed into vec.

        Args:
            extension_path: InfluencePath to extend through.
            influenced_vec: FlowVector being influenced.
            assign: Whether this is an assignment operation. Defaults to True.
            cross_flow: Whether this crosses flow boundaries. Defaults to False.

        Returns:
            New FlowVector with extended influence paths.
        """
        if extension_path.influenced_property is None:
            # the entire vector is pushed
            pushed_vec = self._extend_by_path(flow=extension_path, cross_flow=cross_flow)
            if not assign:
                # we add the pushed values to the present values
                return influenced_vec.add_vector(pushed_vec)

            else:
                # pushed vec replaces vec
                return pushed_vec

        else:
            # A.x ---> B.y or scalar --> B.y
            to_extend = self.get_flows_by_prop(extension_path.influencer_property)
            if to_extend is None or len(to_extend) == 0:
                return FlowVector(property_maps=_copy_property_maps(influenced_vec.property_maps))
            else:
                accum = set()
                for flow_ in to_extend:
                    accum.add(
                        InfluencePath.combine(
                            start_flow=flow_,
                            end_flow=extension_path,
                            cross_flow=cross_flow
                        )
                    )

                return influenced_vec._assign_or_add_property_flows(accum, assign=assign)

    #
    #           End of FlowVector Public API
    #

    def _extend_by_path(self, flow: InfluencePath, cross_flow: bool = False) -> FlowVector:
        """Create a new flow vector by pushing forward this vector's flows.

        Args:
            flow: InfluencePath to extend through.
            cross_flow: Whether this crosses flow boundaries. Defaults to False.

        Returns:
            New FlowVector with extended paths.

        Raises:
            ValueError: If flow has a non-null influenced_property.
        """
        if flow.influenced_property is not None:
            raise ValueError(f"called with flow {flow} that has a non-null influencer.")

        new_property_maps = dict()
        tgt_prop = flow.influencer_property

        if tgt_prop is None:

            # structures are preserved. flow is A --> B
            # push default forward
            for curr_default in self.property_maps:
                pushed_default = InfluencePath.combine(
                    start_flow=curr_default, end_flow=flow, cross_flow=cross_flow)

                # and push all property maps forward *if they exist*
                if self.property_maps[curr_default] is not None:
                    new_property_maps[pushed_default] = {}

                    # take *all* property_overrides and push them forward
                    for prop in self.property_maps[curr_default]:
                        if (self.property_maps[curr_default][prop] is not None and
                                len(self.property_maps[curr_default][prop]) > 0):
                            new_property_maps[pushed_default][prop] = {
                                InfluencePath.combine(
                                    start_flow=override,
                                    end_flow=_restrict(flow, prop),
                                    cross_flow=cross_flow
                                ) for override in self.property_maps[curr_default][prop]}

                else:
                    new_property_maps[pushed_default] = None
        else:
            # tgt_prop is not None, so the flow is A.x --> B
            for curr_default in self.property_maps:

                if self.property_maps[curr_default] is None or tgt_prop not in self.property_maps[curr_default]:
                    # induce a property from defaults via restriction
                    pushed_default = InfluencePath.combine(
                        start_flow=_restrict(curr_default, tgt_prop),
                        end_flow=flow,
                        cross_flow=cross_flow
                    )
                    assert pushed_default not in new_property_maps
                    new_property_maps[pushed_default] = None

                else:
                    # There is an override for target prop, so push all its flows
                    pushed_defaults = [InfluencePath.combine(
                        start_flow=x,
                        end_flow=flow,
                        cross_flow=cross_flow
                    ) for x in self.property_maps[curr_default][tgt_prop]]
                    for x in pushed_defaults:
                        assert x not in new_property_maps
                        new_property_maps[x] = None

        return FlowVector(property_maps=new_property_maps)

    def _search_props(self, defaults_matcher: Callable[[InfluencePath], bool] = is_non_null,
                      prop_matcher: Callable[[str | None], bool] = is_non_null,
                      flow_matcher: Callable[[InfluencePath | None], bool] = is_non_null,
                      action: Callable[[InfluencePath, str, InfluencePath], typing.Any] = id_
                      ) -> typing.Any:
        """Search through FlowVector based on match conditions.

        Args:
            defaults_matcher: Function to match default paths.
            prop_matcher: Function to match property names.
            flow_matcher: Function to match flows.
            action: Function to apply to matched items.

        Returns:
            Set of results from applying action to matched items.
        """
        assert action is not None
        assert prop_matcher is not None
        assert flow_matcher is not None
        assert defaults_matcher is not None

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

    def _assign_or_add_property_flows(self, flows: set[InfluencePath], assign: bool = True
                                      ) -> FlowVector:
        """Inject DataInfluencePaths into vector.

        Args:
            flows: Set of InfluencePath objects to inject.
            assign: Whether to assign (replace) or add flows. Defaults to True.

        Returns:
            New FlowVector with injected flows.

        Raises:
            ValueError: If flows contain paths with null influenced_property.
        """
        if flows is None or len(flows) == 0:
            return self

        new_property_maps = _copy_property_maps(self.property_maps)
        for flow in flows:
            prop = flow.influenced_property
            if prop is None:
                raise ValueError(f"Received flow {flow} with null influencer.")

            for default_ in self.property_maps:
                if self.property_maps[default_] is None or prop not in self.property_maps[default_]:
                    _safe_add(new_property_maps, default_, flow, assign)

                elif assign:
                    new_property_maps[default_][prop] = {flow}

                else:
                    new_property_maps[default_][prop].update({flow})

        return FlowVector(property_maps=new_property_maps)


"""
    
    Helper Functions

"""


def _sort_key(x: InfluencePath) -> str:
    """Generate sort key for an InfluencePath.

    Args:
        x: InfluencePath to generate key for.

    Returns:
        String representation for sorting.
    """
    return x.short_report(arrows=True)


def _merge_override(default: InfluencePath,
                    first: PropertyOverrides | None,
                    second: PropertyOverrides | None) -> PropertyOverrides | None:
    """Take the property map for a specific default and combine it with another.

    Args:
        default: default flow for this map
        first: map from properties to sets of flows
        second: map from properties to sets of flows

    Returns:
        New map that is the combination of the two or None if both maps are None
    """

    if first is None and second is None:
        return None

    keys1 = first.keys() if first else set()
    keys2 = second.keys() if second else set()

    # Union of keys, remove None if it accidentally crept in
    all_keys = (keys1 | keys2) - {None}

    accum = {}
    for key in all_keys:
        # Create induced flow set fresh every time to avoid shared reference issues
        induced_set = {_restrict(default, key)}

        # 1. Retrieve the value (set or None)
        # .get(key) returns None if key is missing, or if key exists and value is None.
        val1 = first.get(key) if first else None
        val2 = second.get(key) if second else None

        # 2. Resolve to set
        # If the value is None (missing or explicit None), we use the induced set.
        set1 = val1 if val1 is not None else induced_set
        set2 = val2 if val2 is not None else induced_set

        # 3. Create new set via union (non-mutating)
        accum[key] = set1 | set2

    return accum


def _build_action_restrict_if_no_prop(wanted_prop: str) -> Callable:
    """Build an action function that restricts flows if no property override exists.

    Args:
        wanted_prop: Property name to restrict to, or None for all.

    Returns:
        Callable function that takes (default, curr_prop, flow) and returns
        tuple of (default, flow) or None.
    """
    def action(default: InfluencePath, curr_prop: str | None,
               flow: InfluencePath) -> tuple[InfluencePath, InfluencePath] | None:

        if wanted_prop is None:
            # return all flows if they exist
            if flow is not None:
                return default, flow

        if wanted_prop is not None and flow is None:
            # we don't have an override, so we return the restricted default
            return default, _restrict(default, wanted_prop)

        if wanted_prop is not None and flow is not None:
            assert curr_prop == wanted_prop
            return default, flow

        return None

    return action


def _safe_add(my_prop_map: VectorPropertyMap,
              my_default: InfluencePath,
              flow: InfluencePath, assign: bool = True) -> None:
    """Add flow to property map, providing induced flow if needed.

    Args:
        my_prop_map: Property map to modify.
        my_default: Default InfluencePath.
        flow: InfluencePath to add.
        assign: Whether to assign (replace) or add. Defaults to True.
    """
    prop = flow.influenced_property

    if assign:
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


def _restrict(dataflow: InfluencePath, prop: str) -> InfluencePath:
    """Restrict path to a member property.

    Args:
        dataflow: InfluencePath to restrict.
        prop: Property name to restrict to.

    Returns:
        New InfluencePath with both influencer_property and influenced_property
        set to prop, or original path if prop is None.
    """
    if prop is None:
        return dataflow

    return replace(dataflow,
                   influencer_property=prop,
                   influenced_property=prop)