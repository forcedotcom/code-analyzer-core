#
#
#
from __future__ import annotations

import json
import logging
import os
import traceback
import typing
import uuid
from collections.abc import Callable
from dataclasses import fields
from pathlib import Path
from typing import TYPE_CHECKING
from typing import Any, Sequence

from public.data_obj import VariableType
from public.enums import RunMode

if TYPE_CHECKING:
    pass

FLOW_EXTENSION = ".flow-meta.xml"
PACKAGE_FLOW_EXTENSION = ".flow"
PROJECT_JSON_NAME = "sfdx-project.json"
PACKAGE_XML_NAME = "package.xml"

CURR_DIR = os.getcwd()

"""
    Crawling limits
"""
MAX_WORKLIST_SIZE = 10000  # Emergency brake
MAX_STEP_SIZE = 100000  # Emergency brake

logger = logging.getLogger(__name__)


def get_flows_in_dirs(root_dirs: str) -> list[str]:
    """Searches recursively through for flows

    Args:
        root_dirs: csv list of directories in which to search

    Returns:
        list of all flows (recursively)
    """
    flow_paths = []
    for root_dir in root_dirs.split(','):
        for root, dir_names, filenames in os.walk(root_dir):
            for filename in filenames:
                if filename.endswith(".flow") or filename.endswith(".flow-meta.xml"):
                    f_path = os.path.abspath(os.path.join(root, filename))
                    flow_paths.append(f_path)

    return flow_paths


def get_local_label(filename: str) -> str:
    if filename.endswith(PACKAGE_FLOW_EXTENSION):
        short = filename[:-5]
    elif filename.endswith(FLOW_EXTENSION):
        short = filename[:-14]
    else:
        short = filename

    local_label = short.split('-')[0]
    return local_label


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
        if include_default:
            accum.append(default)
        if include_prop:
            accum.append(prop)
        if include_flow:
            accum.append(flow)
        return tuple(accum)

    return action


def build_equality_match(to_match) -> Callable:
    def equ_match(obj_to_match):
        return obj_to_match == to_match

    return equ_match


def match_all(x) -> bool:
    return True

def safe_dict_list_append(a_dict: dict[Any, Any], key:Any, val: Any) -> dict[Any, list[Any]]:
    if key not in dict:
        a_dict[key] = [val]
    else:
        a_dict[key].append(val)
    return a_dict

def safe_dict_list_add(a_dict: dict[Any, Any], key:Any, list_val: list[Any]) -> dict[Any, list[Any]]:
    if key not in dict:
        a_dict[key] = list_val
    else:
        a_dict[key] = a_dict[key] + list_val
    return a_dict


def safe_list_add(a_list, b_list) -> list | None:
    # this should be in standard library
    if a_list is None and b_list is None:
        return None
    elif a_list is None:
        return b_list
    elif b_list is None:
        return a_list
    else:
        return a_list + b_list


class Resolver(object):
    def __init__(self, all_flow_paths: list[str]) -> None:
        self.all_flow_paths = all_flow_paths

        #: folder path -> namespace
        cached_namespace_lookups = dict()

        resolver_map = dict()
        for f_path in all_flow_paths:
            # first check cache
            try:
                ns = next((cached_namespace_lookups[x] for x in cached_namespace_lookups.keys() if f_path.startswith(x)), None)

                # then check for sfdx-project.json or package.xml files
                if ns is None:
                    ns, cached_namespace_lookups = update_folder_ns(f_path, cached_namespace_lookups)

                # Now check directory structure
                scope, ns2, label = get_scope_ns_label(f_path, cached_namespace_lookups)

                # pick the best guess (ns2 is always not None)
                ns = ns or ns2

                if scope not in resolver_map:
                    resolver_map[scope] = {(ns, label): f_path}
                else:
                    # we assume the same directory/namespace does not have two files
                    # with the same label
                    resolver_map[scope][(ns, label)] = f_path
            except:
                logger.critical(f"Failed to resolve {f_path}, it will be skipped.")
                continue

        self.resolver_map = resolver_map
        self.cached_namespace_lookups = cached_namespace_lookups

    def get_subflow_path(self, sub_name: str, flow_path: str) -> str | None:
        # check if there is a namespace in the sub_name
        to_match = sub_name.lower()
        splits = to_match.split("__")

        if len(splits) > 1:
            # the target subflow is referenced by namespace
            ns = splits[0]
            label = splits[1]
            # check all scopes for this namespace
            for scope in self.resolver_map:
                if (ns, label) in self.resolver_map[scope]:
                    return self.resolver_map[scope][(ns, label)]
            # No match found
            return None

        else:
            # There is no namespace defined in the target subflow,
            # so check in the local scope and local namespace
            # for a full name match
            self_scope, self_ns, label = get_scope_ns_label(flow_path, self.cached_namespace_lookups)
            if (self_ns, to_match) in self.resolver_map[self_scope]:
                return self.resolver_map[self_scope][(self_ns, to_match)]
            else:
                return None

def get_scope_ns_label(f_path, cached_namespace_lookups):
    ns = next((cached_namespace_lookups[x] for x in cached_namespace_lookups.keys() if f_path.startswith(x)), None)

    # then check for sfdx-project.json or package.xml files
    if ns is None:
        ns, cached_namespace_lookups = update_folder_ns(f_path, cached_namespace_lookups)

    # Now check directory structure
    parts = Path(f_path).parts
    if len(parts) < 3:
        raise RuntimeError("paths must be absolute and contained in a folder: %s" % f_path)

    if parts[-3] == 'flows':
        namespace = ns or parts[-2].replace('-', '_').lower()
        scope = ''
    else:
        scope = os.path.dirname(f_path)
        namespace = ns or ''

    label = get_local_label(parts[-1]).lower()

    return scope, namespace, label


def update_folder_ns(f_path: str, cached_namespace_lookups: dict[str, str]) -> tuple[str | None, dict[str, str]]:
    """looks at the filepath and tries to find the namespace definition from either
    the package manifest or project-json file. Stores the results in a cache

    We do not infer from folder structure yet, just from the config files.

    package manifest assumes a folder structure like this:

    top -> /flows/file
    package.xml
     -- xml and can load and look at <namespacePrefix>PT1</namespacePrefix>
        under the <Package> xml root, with xmlns: "http://soap.sforce.com/2006/04/metadata"

    but we also support
    top -> second -> flows/file

    project-json assumes
    sfdx-project.json at the top of the project next to force-app
    -- can load and look at loaded["namespace"]

    and assumes a project structure of:
    force-app -> first -> second -> flows/file

    Args:
        f_path ():
        cached_namespace_lookups ():

    Returns:
        updated dict string (parent directory containing json/xml file) -> namespace
        the parent directory is an absolute path normalized so that
        we can tell whether a child flow is in this namespace by looking at
        path_of_child.startswith(path_in_dict) and then assign the corresponding namespace to it.

    """
    f = Path(f_path)
    # cached_namespace_lookups
    if f_path.endswith('.flow-meta.xml'):
        """ 
        this is a code-style layout or disorganized layout
        in code we look for sfdx-project.json at root. 
        
        layout can be:
        1) root -> force-app -> main -> default -> flows/myflow.flow
           'main' is for production code, and also replace with 'test' for test code
           
        2) root -> pkg_dir -> main -> default -> flows/myflow.flow
           'pkg_dir' can live alongside  force-app for multiple packages
        3) 'default' represents where code is pulled from, but packages can work with 
           other directories. 
        
        so in general we want to look for 'flows' as the immediate directory containing
        the code and then look up to 4 levels above where myflow.flow lives. 
        if no package-json is found, we return with no defined namespace. 
        
        """
        f_parent = f
        for i in range(5):
            f_parent = f_parent.parent
            if PROJECT_JSON_NAME in os.listdir(f_parent):
                ns = get_ns_from_package_json(os.path.abspath(os.path.join(f_parent, PROJECT_JSON_NAME)))
                if ns is not None:
                    cached_namespace_lookups[str(f_parent)] = ns
                return ns, cached_namespace_lookups
        return None, cached_namespace_lookups

    elif f_path.endswith('.flow'):
        """
        This is either a package-zip layout or repo layout. Only package zip
        has a package xml. 
        
        We look for package.xml in the parent 
        of the dir (where 'flows') is stored. E.g. 
        root -> flows -> my_flow.flow
        and search for package.xml in the root
        
        """
        f_parent = f
        for i in range(3):
            f_parent = f_parent.parent
            if PACKAGE_XML_NAME in os.listdir(f_parent):
                ns = get_ns_from_package_xml(os.path.abspath(os.path.join(f_parent, PACKAGE_XML_NAME)))
                if ns is not None:
                    cached_namespace_lookups[str(f_parent)] = ns
                return ns, cached_namespace_lookups
        return None, cached_namespace_lookups

    else:
        logger.critical(f"found illegal extension on flow file, skipping {f_path}")
        return None, cached_namespace_lookups


def get_ns_from_package_xml(package_path: str) -> str | None:
    """returns namespace or None

    Args:
        package_path (str): path to 'package.xml'

    Returns:
        namespace or None (if no namespace prefix in package xml)

    """
    try:
        with open(package_path, 'r') as package_xml:
            lines = package_xml.readlines()
            for line in lines:
                index = line.find('<namespacePrefix>')
                if index == -1:
                    continue
                index_end = line.find('</namespacePrefix>')
                namespace_prefix = line[index + 17:index_end]
                return namespace_prefix

            return None
    except:
        logger.error(f"Failed to read package xml {package_path}\n{traceback.format_exc()}")
        return None


def get_ns_from_package_json(package_path: str) -> str | None:
    try:
        with open(package_path, 'r') as p:
            json_data = json.load(p)
            namespace_prefix = json_data['namespace']
            if namespace_prefix is None or len(namespace_prefix) == 0:
                return None
            else:
                return namespace_prefix
    except:
        logger.error(f"Failed to read package json {package_path}\n{traceback.format_exc()}")
        return None


def case_insensitive_match(list_a: list[str], to_match: str) -> str | None:
    for item in list_a:
        if item.lower() == to_match.lower():
            return item
    return None


def find_cycles(target, history: tuple) -> tuple[int, tuple | None]:
    """Look for cycles in the history ending with target and return (# of cycles, cycle)

    The idea is to detect cycles. Say the history is
        history = [A B X Y Z X Y]
        and we are thinking of adding the target Z.

        But we don't want to add it if it will
        create a repeating pattern, as this corresponds to looping needlessly.
        So we look for the previous occurrence of Z in the history, and then look
        at history[right_index(Z):] = [Z X Y]
        Now we want to check whether the portion [X Y] also precedes Z. If so,
        we found a cycle ending at target, and we don't jump to that target.

    """
    if not history:
        return 0, None

    l = len(history)
    if history[-1] == target:
        cycle = (target,)
        index = l-1
        cycle_len = 1
    else:
        prev = next(((i for i in range(1, l+1) if history[l-i] == target)), None)
        if not prev:
            return 0, None
        else:
            index = l-prev
            cycle = history[index+1:] + (target,)
            cycle_len = prev

    counter = 1
    position = index

    if cycle_len == 1:
        while position >= 0:
            position -= 1
            if history[position] == target:
                counter += 1
                continue
            else:
                break

    else:
        while position >= cycle_len - 1:
            last_position = position
            position = position - cycle_len

            if history[position + 1: last_position + 1] == cycle:
                counter += 1
                continue
            else:
                break

    return counter, cycle


