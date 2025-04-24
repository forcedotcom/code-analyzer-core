#
#
#
from __future__ import annotations

import logging
import os
import pathlib
import typing
import uuid
from collections.abc import Callable
from dataclasses import fields
from typing import TYPE_CHECKING
import json
import traceback

from public.data_obj import VariableType
from public.enums import RunMode

if TYPE_CHECKING:
    pass

FLOW_EXTENSION = ".flow-meta.xml"
PACKAGE_FLOW_EXTENSION = ".flow"
PROJECT_JSON_NAME = "sfdx-project.json"

CURR_DIR = os.getcwd()


"""
    Crawling limits
"""
MAX_WORKLIST_SIZE = 10000  # Emergency brake
MAX_STEP_SIZE = 100000  # Emergency brake

logger = logging.getLogger(__name__)


def get_flows_in_dir(root_dir: str) -> {str: str}:
    """Searches recursively through for flows

    Args:
        root_dir: directory in which to search

    Returns:
        Returns a tuple of (T1, T2) where T1 is the list of flows
         to be scanned and T2 is a map:
         (local label, fully qualified label | None) -> [path of flow with these labels]
    """
    flow_paths = dict()
    for root, dir_names, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(".flow") or filename.endswith(".flow-meta.xml"):
                f_path = os.path.join(root, filename)
                flow_paths[get_label(root, filename)] = f_path

    return flow_paths


def get_flows_in_dir_with_ns(root_dir: str) -> ([str], {str: str}):
    """Searches recursively through for flows

    Args:
        root_dir: directory in which to search

    Returns:
        Returns a tuple of (T1, T2) where T1 is the list of flows
         to be scanned and T2 is a map:
         (local label, fully qualified label | None) -> [path of flow with these labels]
    """
    flow_paths = dict()
    current_ns = None
    for root, dir_names, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith(".flow") or filename.endswith(".flow-meta.xml"):
                flow_paths[get_label(root, filename)] = os.path.join(root, filename)

    return flow_paths


def extract_ns_from_project_root(project_root_dir: str) -> str | None:
    """Looks in the provided directory for a project json file and tries to extract the namespace

    Args:
        project_root_dir: directory in which to search

    Returns: namespace string or none

    """
    candidate_path = os.path.join(project_root_dir, PROJECT_JSON_NAME)
    if (not os.path.exists(project_root_dir) or
            not os.path.exists(candidate_path)):

        return None
    else:
        try:
            obj = json.loads(project_root_dir)
            ns = obj["namespace"]
            logger.info(f"found namespace {ns} in project root {project_root_dir}")
            return ns

        except Exception:
            logger.info(f"Failed to extract namespace from project root "
                        f"dir when searching in f{project_root_dir} for f{PROJECT_JSON_NAME}:\n"
                        f"{traceback.format_exc()}")
            return None


def get_label(root: str, filename: str) -> (str, str):
    """get flow label as used in other flows to reference this subflow

    Returns a tuple (namespaced label, local label)

    For the local label, it changes `foo-1` to `foo` and
    the namespaced label would be `parent_dir__foo`

    Args:
        root: parent directory containing filename
        filename: filename of flow

    Returns:
        tuple (namespaced_label, local_label)

    """
    if filename.endswith(PACKAGE_FLOW_EXTENSION):
        short_fname = filename[:-5]
    elif filename.endswith(FLOW_EXTENSION):
        short_fname = filename[:-14]
    else:
        short_fname = filename

    local_label = short_fname.split('-')[0]
    full_parent_dirname = os.path.split(os.path.abspath(root))[0]
    parent_dirname = os.path.split(full_parent_dirname)[-1]
    if parent_dirname is not None and len(parent_dirname) > 0 and parent_dirname != 'flows':
        # This works when scanning core flows
        namespaced_label = f"{parent_dirname}__{local_label}"
    else:
        # TODO: get namespace from manifest file
        namespaced_label = local_label
    return namespaced_label, local_label


"""
    Simple Variable Type Propagation
"""


def propagate(src_type: VariableType, dest_type: VariableType, **replacements) -> VariableType:
    """Propagate attributes across flows.

    For example, if we know that a variable
    of type 'Account' is passed into loop, then we want to remember
    that the object type of this loop is Account. This works if we leave
    all properties none unless we are certain of their values and then
    adopt this simple method. Longer term, we may need to put conditional
    logic, but now add a replacement field for manual override.

    Args:
        src_type: start Variable Type
        dest_type: end Variable Type
        replacements: property overrides

    Returns:
        Variable Type, modified with sources populating empty dest entries.

    """

    prop_names = [x.name for x in fields(VariableType) if x is not None]
    new_props = {x: dict.get(replacements, x) or getattr(dest_type, x) or getattr(src_type, x) for x in prop_names}

    return VariableType(**new_props)


"""
                    Transmission of context in subflows

    A master Flow running in system context will cause actions run in the SubFlow 
    to be run in system context as well, 
    regardless of whether the SubFlow was originally created and configured to run in user context.
    A master Flow running in user context that has a SubFlow running in system context 
    will proceed to run the actions in the SubFlow in system context.
"""


def make_id() -> str:
    """Generates unique id strings

    Returns:
        8 digit unique id as str

    """
    return str(uuid.uuid4())[:8]


def get_effective_run_mode(parent_sharing: RunMode | None, current_sharing: RunMode) -> RunMode:
    if (parent_sharing is None or current_sharing is RunMode.SystemModeWithoutSharing or
            current_sharing is RunMode.SystemModeWithSharing):
        return current_sharing
    else:
        return parent_sharing


def sane_index(my_tuple: tuple, to_match):
    try:
        index = my_tuple.index(to_match)
    except ValueError:
        index = -1

    return index


"""
    Callables for dealing with property maps
"""


def is_non_null(entry) -> bool:
    return entry is not None


def is_null(entry) -> bool:
    return entry is None


def id_(*entry) -> typing.Any:
    return entry


def build_match_on_null(prop: str = None) -> Callable:
    def prop_match(prop_to_match: str):
        if prop is None:
            return True
        else:
            return prop == prop_to_match

    return prop_match


def build_action_filter(include_default: bool = True,
                        include_prop: bool = True,
                        include_flow: bool = True) -> Callable:
    def action(default, prop, flow):
        accum = []
        if include_default is True:
            accum.append(default)
        if include_prop is True:
            accum.append(prop)
        if include_flow is True:
            accum.append(flow)
        return tuple(accum)

    return action


def build_equality_match(to_match) -> Callable:
    def equ_match(obj_to_match):
        return obj_to_match == to_match

    return equ_match


def match_all(x) -> bool:
    return True


def resolve_name(all_flow_paths: {(str, str): str}, sub_name: str) -> str | None:
    """return path of subflow to load based on subflow label

    Args:
        all_flow_paths: all flow paths in scan scope in the form (abs label, local label) --> abs_flow_path
        sub_name: subflow label

    Returns:
        subflow path

    """
    targets = [x for x in all_flow_paths.keys() if sub_name in x]
    sub_path = None
    if len(targets) == 0:
        logger.critical(f"Could not find subflow to load with name: {sub_name}. "
                        f"Please check that all flow files are in the directory to scan. Skipping..")
        return None
    if len(targets) == 1:
        sub_path = all_flow_paths[targets[0]]

    if len(targets) >= 1:
        # we have more than one flow with a matching label.
        # We choose the local label if there is a unique match
        # as local resolution takes precedence.
        local_targets = [x for x in targets if sub_name == x[1]]
        if len(local_targets) == 1:
            sub_path = all_flow_paths[local_targets[0]]
        if len(local_targets) == 0:
            # No local target, let's look for namespaced
            namespaced_targets = [x for x in targets if sub_name == x[0]]
            if len(namespaced_targets) == 1:
                sub_path = all_flow_paths[namespaced_targets[0]]

    if sub_path is None:
        logger.critical(f"Could not resolve subflow with name: {sub_name}. "
                        f"Please check that all flow files are in the directory to scan. Skipping..")

        return None

    return sub_path


def safe_list_add(a_list, b_list) -> list:
    # this should be in standard library
    if a_list is None and b_list is None:
        return None
    elif a_list is None:
        return b_list
    elif b_list is None:
        return a_list
    else:
        return a_list + b_list
