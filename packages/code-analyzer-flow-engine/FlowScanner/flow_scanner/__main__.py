import argparse
import json
import logging
import math
import os
import re
import sys
import traceback
import uuid

import flow_scanner.executor as executor
import flow_scanner.query_manager
import flow_scanner.util as util
import flow_scanner.version as version
import flow_scanner.db_storage as db_storage

from flow_scanner.query_manager import validate_qry_list, get_all_queries
from flow_scanner.util import make_id
from public.data_obj import PresetEncoder
from public.parse_utils import quick_validate

"""
    Status reporting will be written to stdout and prepended with 
    STATUS_LABEL and will end with "**"
    
"""
STATUS_LABEL = "**STATUS:"
STATUS_STARTED = "Processing Start**"  # parse arguments, get job details
STATUS_DISCOVERY = "Discovering flows**"  # search for flows in dir
# When flows are being scanned, a percentage will be shown via get_status_msg
STATUS_REPORT_GEN = "Generating Report**"  # generating report
STATUS_CHUNK_GEN = "Generating Report for Chunk**"
STATUS_COMPLETE = "Job Complete**"  # job stop

MINIMUM_CHUNK_SIZE = 5
MAXIMUM_CHUNK_SIZE = 1000

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


def check_dirs_exist(x: str) -> str:
    """Checks if the argument is a valid directory. Raises ArgumentTypeError if not.

    Args:
        x: string to check

    Returns:
        None
    """
    dir_list = clean_str_list(x.split(','))
    for entry in dir_list:
        if not os.path.isdir(entry):
            raise argparse.ArgumentTypeError(f"{entry} is not a directory")
    return ','.join(dir_list)


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


def get_flow_paths_from_file(file_path: str) -> list[str]:
    try:
        with open(file_path, 'r', encoding='utf-8') as fp:
            data = fp.read()
    except UnicodeDecodeError:
        # CP1252 is used on older Windows systems
        try:
            with open(file_path, 'r', encoding='cp1252') as fp:
                data = fp.read()
        except UnicodeDecodeError:
            print("Unable to input file")
            raise

    splits = re.split(r'[,\n]', data)
    trimmed = [x.strip() for x in splits]
    cleaned = [os.path.abspath(check_file_exists(x)) for x in trimmed if
               x is not None and len(x) > 0 and quick_validate(x) is True]
    return cleaned


def get_tokens_from_csv_file(file_path: str) -> list[str]:
    try:
        with open(file_path, 'r', encoding='utf-8') as fp:
            data = fp.read()
    except UnicodeDecodeError:
        # CP1252 is used on older Windows systems
        try:
            with open(file_path, 'r', encoding='cp1252') as fp:
                data = fp.read()
        except UnicodeDecodeError:
            print("Unable to input file")
            raise argparse.ArgumentTypeError("Unable to read file %s" % file_path)
    except:
        raise

    return get_validated_queries(unsplit(data))

def print_preset_list():
    map_ = flow_scanner.query_manager.PRESETS
    preset_info = {}
    for p in map_:
        preset_info[p] = [x[1] for x in map_[p]]

    res_json = json.dumps(preset_info, indent=4)
    # print to stdout so user can redirect or examine
    print(res_json)

def get_validated_queries(data: list[str]) -> list[str]:
    cleaned_data = de_kebab_list(clean_str_list(data))
    valid, found, missed, duplicates = validate_qry_list(cleaned_data)
    if valid:
        return found
    else:
        for issue, data in [('Duplicate', duplicates), ('Unrecognized', missed)]:
            if data is not None and len(data) > 0:
                if len(data) == 1:
                    raise argparse.ArgumentTypeError(f"{issue} query requested: %s" % data[0])
                else:
                    raise argparse.ArgumentTypeError(f"{issue} queries requested: %s" %
                                                     ",".join(data))


def unsplit(msg: str) -> list[str]:
    splits = re.split(r'[,\n]', msg)
    return [x.strip() for x in splits]


def get_flow_paths(args: argparse.Namespace) -> tuple[list[str], util.Resolver]:
    """Given the arguments parsed by argparse, returns the flow filenames and names
    that should be processed.

    Args:
        args: argparse Namespace (parsed arguments)

    Returns:
        a tuple of (list of all flows to scan, dict: flow_name ->
        flow_path)
    """
    arg_file = args.target
    arg_workspace = args.workspace
    arg_flow = args.flow
    arg_dir = args.dir

    flow_workspace = None
    flow_paths = None

    # file takes precedence and others are ignored
    if arg_file is not None:
        flow_paths = get_flow_paths_from_file(arg_file)
    if arg_workspace is not None:
        flow_workspace = get_flow_paths_from_file(arg_workspace)

    # next are the flows passed as a csv list in an argument
    if arg_flow is not None and arg_file is None:
        flow_paths_raw = [os.path.abspath(x) for x in arg_flow.split(",")]
        flow_paths = [x for x in flow_paths_raw if quick_validate(x) is True]

    # finally we scan an entire directory (including subdirectories)
    if flow_paths is None:
        if arg_dir is None:
            arg_dir = CURR_DIR

        flow_paths_raw = util.get_flows_in_dirs(arg_dir)
        flow_paths = [x for x in flow_paths_raw if quick_validate(x) is True]

    if flow_workspace is None:
        flow_workspace = flow_paths

    # Instantiate resolver for subflow lookup
    resolver = util.Resolver(flow_workspace)

    count = len(flow_paths)
    if count > 0:
        print(f"found {count} flows to scan")
        return flow_paths, resolver
    else:
        print("No flow files found to scan. Exiting...")
        sys.exit(0)


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
    parser.add_argument("--query_info", action='store_true',
                        help="display which queries are supported and exit")

    """
        Options for which flows to scan    
    """
    paths = parser.add_mutually_exclusive_group()

    paths.add_argument("-f", "--flow", help=("path of flow files scan, csv separated. "
                                             "If provided, only these will be scanned or used for resolution."),
                       required=False)
    paths.add_argument("-d", "--dir", help=("csv list of directories containing flow-meta.xml files "
                                            "subdirectories are also searched. Defaults to working directory. If no"
                                            "flows specified all flows in directory will be scanned, otherwise only"
                                            "subflows in this directory will be scanned"),
                       type=check_dirs_exist)

    paths.add_argument("--target", help="path of file containing csv separated lists of flows to scan."
                                        "No other flows will be processed", type=check_file_exists)
    """
        Option for specifying the workspace path list
    """

    parser.add_argument("--workspace",
                        help=("path of file containing csv separated lists of "
                        "flows in workspace that may be resolved as subflow targets. "
                         "If empty this defaults to flows target csv file, the specified directory, "
                         "or contents of flow directory or flows listed in commandline."),
                        type=check_file_exists)

    """
        Options for debug/log handling
    """
    parser.add_argument("--log_file", default=f".flow_scanner_log_{default}.log",
                        help="path to store logs. If missing, one will be generated",
                        type=check_not_exist)

    parser.add_argument("--debug", action='store_true', help="whether to set logging level to debug")
    parser.add_argument("--no_log", action='store_true', help="disables logging")

    """
        Options for crawl-spec generation
    """
    parser.add_argument("--crawl_dir", default=None,
                        help="where to store crawl specification",
                        type=check_dirs_exist)
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
    parser.add_argument("--db", required=False, nargs='?', const=True,
                        help="path to SQLite database file for storing results. "
                             "If --db is provided without a path, a database with a UUID-based name will be created in the current directory.",
                        default=None)
    parser.add_argument("-c", "--chunk", required=False,
                        help=(f"chunk scan into groups of files, with one report generated for each group. "
                              "Reports will be appended with the chunk number. Useful for processing "
                              "large numbers of files."), type=int)

    """
        Options for labeling reports
    """
    parser.add_argument("-i", "--id", default=default,
                        help="Id of generated report.")
    parser.add_argument("-r", "--requestor", required=False, help="email address of report recipient.")

    parser.add_argument("-u", "--url", required=False, help="URL to put into report for more information.")
    parser.add_argument("-l", "--label", required=False, help="human readable label to put in report.")
    parser.add_argument("--service_version", default=version.__version__,
                        help="version of system running the command")
    """
        Options for specifying queries and custom query loads
    """
    parser.add_argument("--query_path", required=False, help="path of custom query python file")
    parser.add_argument("--query_class", required=False, help="name of class to instantiate in query_path")
    parser.add_argument("--preset", required=False, help="name of preset to use (consumed by query code)")
    parser.add_argument("--queries", required=False,
                        help="comma separated list of queries to execute in addition to the preset.")
    parser.add_argument("--queries_path", required=False,
                        help="path of file containing a comma separated list of queries to "
                             "execute in addition to the preset.", type=check_file_exists)
    parser.add_argument("--all_queries", required=False, action='store_true', help=("run all queries. "
                        "WARNING: this is noisy."))
    parser.add_argument("--debug_flow", required=False, help=("For expert use only. Run a debug flow with"
                                                             "the supplied parameter."))

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

    if args.preset is not None:
        # check preset
        if args.preset not in flow_scanner.query_manager.PRESETS:
            raise argparse.ArgumentTypeError(f"Invalid preset requested: {args.preset}")

    # check if the user wants only a description of the default queries
    if args.preset_info is True:
        # if user has specified a preset, use that or None
        preset_name = args.preset or "default"
        if preset_name:
            preset = flow_scanner.query_manager.build_preset_for_name(preset_name)
            if preset is None:
                print(f"No preset found with name: {preset_name}")
                print_preset_list()
                return
            queries = preset.queries
            query_info = [x.to_dict() for x in list(queries)]
            sorted_query_info = sorted(query_info, key=lambda x: x['query_id'])
            desc = json.dumps(sorted_query_info, indent=4, cls=PresetEncoder)
            # print to stdout so user can redirect or examine
            print(desc)
        return

    # Check if user wants list of queries
    if args.query_info is True:
        desc = flow_scanner.query_manager.get_query_descriptions()
        print(json.dumps(desc, indent=4, cls=PresetEncoder))
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


    """
        Handle Queries
    """
    if args.all_queries is True:
        qry_l = get_all_queries()

    elif args.queries_path is not None:
        qry_l = get_tokens_from_csv_file(args.queries_path)

    elif args.queries is not None:
        qry_l = get_validated_queries(unsplit(args.queries))
    else:
        qry_l = None

    """
        Handle chunking
    """
    if args.chunk is not None:
        chunk = args.chunk
    else:
        chunk = None

    print(f"{STATUS_LABEL} {STATUS_DISCOVERY}")

    flow_paths, resolver = get_flow_paths(args)
    if args.label is None:
        if len(flow_paths) == 1:
            label = f"scan of {flow_paths[0]}"
        else:
            tmp = args.dir or CURR_DIR
            tmp = tmp.split(os.path.sep)[-1]
            label = f"scan of {tmp}"
    else:
        label = args.label

    query_manager = None

    # make sure a report has been chosen (including database)
    if args.html is None and args.xml is None and args.json is None and args.db is None:
        raise argparse.ArgumentTypeError("No report format chosen")

    chunk_counter = 0
    total_paths = len(flow_paths)

    if chunk is None or chunk > total_paths:
        chunk = total_paths

    elif chunk < MINIMUM_CHUNK_SIZE:
        print(f"requested chunk size {chunk} is too small, changing to {MINIMUM_CHUNK_SIZE}")
        chunk = MINIMUM_CHUNK_SIZE

    number_chunks = math.ceil(total_paths / chunk)

    if chunk < total_paths:
        print(f"Scans will be broken into {number_chunks} chunks, with one report per chunk")

    if total_paths> MAXIMUM_CHUNK_SIZE:
        print(f"CAUTION: You have requested a scan of {total_paths} flows. It is strongly recommended that"
              f"you use the `--chunk` switch to break this scan up into smaller pieces to avoid excessively large"
              f"reports and to reduce scan memory usage. Chunked scans have no reduction in scan accuracy.")

    # Set up database connection and run_id if database output is requested
    db_conn = None
    run_id = None
    if args.db is not None:
        # Determine database path
        # With nargs='?' and const=True:
        # - If --db is not provided: args.db = None
        # - If --db is provided without value: args.db = True (const)
        # - If --db is provided with value: args.db = that value (string)
        if args.db is True:
            # User provided --db without path, generate UUID-based name
            db_path = f"flow_scanner_results_{uuid.uuid4()}.db"
        else:
            # User provided a path
            db_path = args.db
            # Ensure parent directory exists if path has directory component
            db_abs_path = os.path.abspath(db_path)
            db_dir = os.path.dirname(db_abs_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
            db_path = db_abs_path
        
        try:
            db_conn = db_storage.create_database(db_path)
            # Create run with description
            description = args.label or f"scan of {len(flow_paths)} flows"
            run_id = db_storage.create_run(db_conn, description=description)
            print(f"Database initialized at {db_path}, run_id={run_id}")
        except Exception as e:
            print(f"Error setting up database: {e}")
            raise

    try:
        for (index, flow_path) in enumerate(flow_paths):

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
                                                    queries=qry_l,
                                                    crawl_dir=args.crawl_dir,
                                                    resolver=resolver)

            except KeyboardInterrupt:
                # Program could be long-running and should be interruptible by the user
                return

            except:
                msg = (f"error processing flow {flow_path}"
                      f"{traceback.format_exc()}"
                      "...continuing to next flow..")
                print(msg)

            if (index % chunk == 0 and index > 0) or index == total_paths-1:
                chunk_counter += 1
                try:
                    gen_reports(args, query_manager, chunk_counter, number_chunks, db_conn=db_conn, run_id=run_id)

                except KeyboardInterrupt:
                    return

                except:
                    print("error generating reports")
                    print(traceback.format_exc())

                query_manager = None

        print("scanning complete.")
        print(f"{STATUS_LABEL} {STATUS_COMPLETE}")
    finally:
        # Ensure database connection is closed when processing ends
        # This will execute even if there's an early return or exception
        if db_conn is not None:
            try:
                db_conn.close()
            except Exception as e:
                # Log but don't raise - connection might already be closed
                logging.warning(f"Error closing database connection: {e}")

def gen_reports(args, query_manager, chunk_counter, number_chunks, db_conn=None, run_id=None):

    # we are not chunking, we are generating a single report for everything
    if query_manager is None:
        print("No flow could be scanned in this chunk")
        return

    if number_chunks > 1:
        print(f"{STATUS_LABEL} {STATUS_CHUNK_GEN}")
        to_insert = str(chunk_counter)
    else:
        # fall back to old messages so as not to break SCA
        print(f"{STATUS_LABEL} {STATUS_REPORT_GEN}")
        to_insert = ''

    if args.xml is not None:
        rep_path = add_chunk_to_path(args.xml, to_insert)
        xml_rep = query_manager.results.get_cx_xml_str()
        if os.path.exists(rep_path):
            os.remove(rep_path)
        with open(rep_path, 'w') as fp:
            fp.write(xml_rep)

        print(f"xml result file written to {rep_path}")

    if args.html is not None:
        rep_path = add_chunk_to_path(args.html, to_insert)
        if os.path.exists(rep_path):
            os.remove(rep_path)

        query_manager.results.write_html(rep_path)
        print(f"html result file written to {rep_path}")

    if args.json is not None:
        rep_path = add_chunk_to_path(args.json, to_insert)
        if os.path.exists(rep_path):
            os.remove(rep_path)
        with open(rep_path, 'w') as fp:
            query_manager.results.dump_json(fp)

        print(f"json result file written to {rep_path}")

    # Dump results to database if connection and run_id are provided
    if db_conn is not None and run_id is not None:
        try:
            num_stored = query_manager.results.dump_result_to_db(db_conn, run_id)
            print(f"stored {num_stored} query results to database for run_id={run_id}")
        except Exception as e:
            print(f"error storing results to database: {e}")
            print(traceback.format_exc())
            # Continue execution even if database dump fails

def add_chunk_to_path(old_path: str, to_insert)-> str:
    if to_insert == '':
        return old_path
    new_l = old_path.split('.')
    new_l[0] = f"{new_l[0]}-{to_insert}"
    return '.'.join(new_l)

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

def kebab_to_camel_case(msg: str)-> str:
    if "_" in msg:
        return msg.replace('_', ' ').replace('-', ' ').title().replace(' ', '')
    else:
        return msg

def de_kebab_list(str_l: list[str])-> list[str]:
    return [kebab_to_camel_case(x) for x in str_l]


def clean_str_list(data: list[str])->list[str]:
    return [x for x in data if x.strip() != '']

if __name__ == "__main__":
    main()
