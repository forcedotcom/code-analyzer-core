import json
import os
import re
import sys
import logging
import argparse
import traceback

import flowtest.executor as executor
import flowtest.util as util
import flowtest.version as version
import queries.default_query as default_query
from flowtest.util import make_id
from public.data_obj import PresetEncoder

"""
    Status reporting will be written to stdout and prepended with 
    STATUS_LABEL and will end with "**"
    
"""
STATUS_LABEL = "**STATUS:"
STATUS_STARTED = "Processing Start**"  # parse arguments, get job details
STATUS_DISCOVERY = "Discovering flows**"  # search for flows in dir
# When flows are being scanned, a percentage will be shown via get_status_msg
STATUS_REPORT_GEN = "Generating Report**"  # generating report
STATUS_COMPLETE = "Job Complete**"  # job stop

CURR_DIR = os.getcwd()


def get_status_msg(curr, total):
    percentage = round(100 * float(curr) / float(total), 1)
    return f"{STATUS_LABEL}{percentage}% flows scanned** "


def check_file_exists(x: str) -> str:
    """checks if the file exists, otherwise it raises an ArgumentTypeError

    Args:
        x: filepath

    Returns:
        filepath
    """
    if not os.path.exists(x):
        raise argparse.ArgumentTypeError("{0} does not exist".format(x))
    return x


def check_dir_exists(x: str) -> str:
    """Checks if the argument is a valid directory. Raises ArgumentTypeError if not.

    Args:
        x: string to check

    Returns:
        None
    """
    if not os.path.isdir(x):
        raise argparse.ArgumentTypeError("{0} is not a directory".format(x))
    return x


def check_dir_exists_or_create(x: str) -> str:
    """Checks if the argument is a valid directory. Creates directory if it doesn't exist.

    Args:
        x: string to check

    Returns:
        None
    """
    os.makedirs(x, exist_ok=True)
    return x


def check_not_exist(x: str) -> str:
    """lambda that checks if this path exists or not. Raises an error if it does exist.

    Args:
        x: string to check

    Returns:
        string
    """
    if os.path.exists(x):
        raise argparse.ArgumentTypeError("{0} already exists!".format(x))
    return x


def get_flow_paths_from_file(file_path: str):
    try:
        with open(file_path, 'r', encoding='utf-8') as fp:
            data = fp.read()
    except UnicodeDecodeError:
        # CP1252 is used on older windows systems
        try:
            with open(file_path, 'r', encoding='cp1252') as fp:
                data = fp.read()
        except UnicodeDecodeError:
            print("Unable to input file")
            raise

    splits = re.split(r',|\n', data)
    trimmed = [x.strip() for x in splits]
    cleaned = [os.path.abspath(check_file_exists(x)) for x in trimmed if x is not None and len(x) > 0]
    return cleaned


def get_flow_paths(args: argparse.Namespace) -> (list[str], {str: str}):
    """Given the arguments parsed by argparse, returns the flow filenames and names
    that should be processed.

    Args:
        args: argparse Namespace (parsed arguments)

    Returns:
        a tuple of (list of all flows to scan, dict: flow_name ->
        flow_path)
    """
    arg_file = args.infile
    arg_flow = args.flow
    arg_dir = args.dir
    count = 0
    flow_map = None

    # file takes precedence and others are ignored
    if arg_file is not None:
        flow_paths = get_flow_paths_from_file(arg_file)

    # next are the flows passed as a csv list in an argument
    elif arg_flow is not None:
        flow_paths = [os.path.abspath(x) for x in arg_flow.split(",")]

    # finally we scan an entire directory (including subdirectories)
    else:
        if arg_dir is None:
            arg_dir = CURR_DIR

        flow_map = util.get_flows_in_dir(arg_dir)
        flows = list(flow_map.values())
        flow_paths = [os.path.abspath(x) for x in flows]

    # Once we have flow paths, we determine labels and namespaces
    if flow_map is None:
        flow_map = {}
        for a_flow in flow_paths:
            label = util.get_label(os.path.dirname(a_flow), os.path.basename(a_flow))
            if label is not None:
                if label in flow_map:
                    print(f"alert, label {label} in map already")
                else:
                    flow_map[label] = a_flow

    count = len(flow_paths)
    if count > 0:
        print(f"found {count} flows to scan")
        return flow_paths, flow_map
    else:
        print("No flow files found to scan. Exiting...")
        sys.exit(1)


def parse_args(my_args: list[str], default: str = None) -> argparse.Namespace:
    """Defines parameters for argument parsing

    Args:
        default: unique id for this scan. If None provided, one is generated.
        my_args: argument list (complete, so my_args[0] is the program
            name)

    Returns:
        argparse Namespace (parsed arguments)
    """
    if default is None:
        default = make_id()

    parser = argparse.ArgumentParser(
        prog=my_args[0].split(os.sep)[-1],
        description="Static Analysis of Salesforce Flows",
        epilog="Please reach out to your security contact with feedback and bugreports",
    )
    """
        options that display status and tool info
    """
    parser.add_argument("-v", "--version", action='version',
                        version='%(prog)s ' + version.__version__)
    parser.add_argument("-p", "--preset_info", action='store_true',
                        help="return information on default preset and exit")

    """
        Options for which flows to scan    
    """
    paths = parser.add_mutually_exclusive_group()

    paths.add_argument("-f", "--flow", help=("path of flow files scan, csv separated. "
                                             "If provided, only these will be scanned."),
                       required=False)
    paths.add_argument("-d", "--dir", help=("directory containing flow-meta.xml files "
                                            "subdirectories are also searched. Defaults to working directory. If no"
                                            "flows specified all flows in directory will be scanned, otherwise only"
                                            "subflows in this directory will be scanned"),
                       type=check_dir_exists)

    paths.add_argument("--infile", help="path of file containing csv separated lists of flows to scan."
                                        "No other flows will be processed", type=check_file_exists)

    """
        Options for debug/log handling
    """
    parser.add_argument("--log_file", default=f".flowtest_log_{default}.log",
                        help="path to store logs. If missing, one will be generated",
                        type=check_not_exist)

    parser.add_argument("--debug", action='store_true', help="whether to set logging level to debug")
    parser.add_argument("--no_log", action='store_true', help="disables logging")

    """
        Options for crawl-spec generation
    """
    parser.add_argument("--crawl_dir", default=None,
                        help="where to store crawl specification",
                        type=check_dir_exists)
    """
        Options for storing reports
    """
    parser.add_argument("-j", "--json", default=None,
                        help="path to store json report file.",
                        type=check_not_exist)
    parser.add_argument("-x", "--xml", required=False,
                        help="path to store xml report file.",
                        type=check_not_exist)
    parser.add_argument("-t", "--html", required=False,
                        help="Path to store html report", type=check_not_exist)

    """
        Options for labeling reports
    """
    parser.add_argument("-i", "--id", default=default,
                        help="Id of generated report.")
    parser.add_argument("-r", "--requestor", required=False, help="email address of report recipient.")

    parser.add_argument("-u", "--url", required=False, help="URL to put into report for more information.")
    parser.add_argument("-l", "--label", required=False, help="human readable label to put in report.")
    parser.add_argument("--service_version", default=version.__version__, help="version of system running the command")
    """
        Options for custom query loads
    """
    parser.add_argument("--query_path", required=False, help="path of custom query python file")
    parser.add_argument("--query_class", required=False, help="name of class to instantiate in query_path")
    parser.add_argument("--preset", required=False, help="name of preset to use (consumed by query code)")

    return parser.parse_args(my_args[1:])


# For testing, we allow specifying an argv to main
def main(argv: list[str] = None) -> str | None:
    """Main entry point to CLI command. For testing, we allow specifying
    the argv list.

    Args:
        argv: (for testing) list of arguments passed into CLI command

    Returns:
        None
    """
    default = make_id()

    if argv is None:
        argv = sys.argv

    args = parse_args(argv, default=default)

    # check if the user wants only a description of the default queries
    if args.preset_info is True:
        # if user has specified a preset, use that or None
        preset_name = args.preset
        preset = default_query.build_preset(preset_name)
        queries = preset.queries
        query_info = [x.to_dict() for x in list(queries)]
        sorted_query_info = sorted(query_info, key=lambda x: x['query_id'])
        desc = json.dumps(sorted_query_info, indent=4, cls=PresetEncoder)
        # print to stdout so user can redirect or examine
        print(desc)

        return

    # logging
    if args.no_log is True:
        logging.getLogger().setLevel(logging.CRITICAL + 1)
    else:
        if args.debug is True:
            log_level = logging.DEBUG

        else:
            log_level = logging.WARNING

        setup_logger(level=log_level, log_file=args.log_file)

    if args.query_path is not None and args.query_class is None:
        raise argparse.ArgumentTypeError("A query_class must be provided if a query_path is set")

    elif args.query_path is None and args.query_class is not None:
        raise argparse.ArgumentTypeError("A query_path must be provided if a query_class is set")

    print(f"{STATUS_LABEL} {STATUS_DISCOVERY}")

    flow_paths, all_flows = get_flow_paths(args)
    if args.label is None:
        if len(flow_paths) == 1:
            label = f"scan of {flow_paths[0]}"
        else:
            tmp = args.dir or CURR_DIR
            tmp = tmp.split(os.path.sep)[-1]
            label = f"flowscan of {tmp}"
    else:
        label = args.label

    query_manager = None

    # make sure a report has been chosen
    if args.html is None and args.xml is None and args.json is None:
        raise argparse.ArgumentTypeError("No report format chosen")

    for (index, flow_path) in enumerate(flow_paths):
        total_paths = len(flow_paths)
        status_message = get_status_msg(index, total_paths)
        print(f"{status_message} scanning {flow_path}...")
        try:
            # top level loop in case something goes wrong
            # specifically we have noticed it's now possible
            # to save malformed flows :(
            query_manager = executor.parse_flow(flow_path,
                                                requestor=args.requestor,
                                                report_label=label,
                                                result_id=args.id,
                                                service_version=args.service_version,
                                                help_url=args.url,
                                                query_manager=query_manager,
                                                query_module_path=args.query_path,
                                                query_class_name=args.query_class,
                                                query_preset=args.preset,
                                                crawl_dir=args.crawl_dir,
                                                all_flows=all_flows)
        except:
            print(f"error processing flow {flow_path}")
            print(traceback.format_exc())
            print("...continuing to next flow..")

    if query_manager is None:
        print("No flow could be scanned. Exiting.")
        sys.exit(-1)

    print("scanning complete.")
    print(f"{STATUS_LABEL} {STATUS_REPORT_GEN}")
    if args.xml is not None:
        xml_rep = query_manager.results.get_cx_xml_str()
        with open(args.xml, 'w') as fp:
            fp.write(xml_rep)

        print(f"xml result file written to {args.xml}")

    if args.html is not None:
        query_manager.results.write_html(args.html)

        print(f"html result file written to {args.html}")

    if args.json is not None:
        with open(args.json, 'w') as fp:
            query_manager.results.dump_json(fp)

        print(f"json result file written to {args.json}")

    print(f"{STATUS_LABEL} {STATUS_COMPLETE}")


def setup_logger(level, log_file: str):
    """Setup logger for scan run

    Args:
        level: logging.Level
        log_file: path to store logs

    Returns:
        None
    """
    # create logger
    logger = logging.getLogger()
    logger.setLevel(level)

    # create file handler for regular logging
    fh = logging.FileHandler(log_file)
    fh.setLevel(level)
    ch = logging.StreamHandler(sys.stderr)
    ch.setLevel(logging.CRITICAL)

    # create formatter
    formatter = logging.Formatter('%(asctime)s | %(name)s | %(levelname)s | %(message)s')

    # add formatter to fh
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)

    # add to logger
    logger.addHandler(fh)
    logger.addHandler(ch)

    print(f"logfile is {log_file}")


if __name__ == "__main__":
    main()
