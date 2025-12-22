"""SQLite database storage for QueryResult objects.

This module provides functionality to create and manage an SQLite database
for storing QueryResult objects from flow scanner analysis.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

# Import for runtime use (not just type checking)
from public.data_obj import InfluenceStatement, InfluenceStatementEncoder

if TYPE_CHECKING:
    from public.data_obj import QueryResult, InfluencePath
    from public.enums import FlowType

#: module logger
logger = logging.getLogger(__name__)


class QueryResultEncoder(json.JSONEncoder):
    """Custom JSON encoder for QueryResult and related objects."""
    
    def default(self, obj):
        """Encode objects to JSON-serializable format."""
        # Handle InfluenceStatement
        if isinstance(obj, InfluenceStatement):
            raw_dict = obj.to_dict()
            # For public display, we replace flow_path with source_path
            cleaned_dict = {s: raw_dict[s] for s in raw_dict.keys() if (
                            s != 'flow_path' and s != 'source_path')}
            cleaned_dict['flow_path'] = raw_dict['source_path']
            return cleaned_dict
        
        # Handle InfluencePath - convert to dict representation
        # Check for InfluencePath by looking for characteristic attributes
        if hasattr(obj, 'history') and hasattr(obj, 'influenced_name') and hasattr(obj, 'influencer_name'):
            # This is an InfluencePath
            return {
                'history': [self.default(stmt) for stmt in obj.history] if obj.history else [],
                'influenced_name': obj.influenced_name,
                'influenced_property': obj.influenced_property,
                'influencer_name': obj.influencer_name,
                'influencer_property': obj.influencer_property,
                'influenced_filepath': obj.influenced_filepath,
                'influencer_filepath': obj.influencer_filepath,
                'influenced_type_info': self.default(obj.influenced_type_info) if obj.influenced_type_info else None
            }
        
        # Handle FlowType enum (and other enums)
        if hasattr(obj, 'name') and hasattr(obj, 'value'):
            # This is an Enum
            return obj.name
        
        # Handle frozenset
        if isinstance(obj, frozenset):
            return list(obj)
        
        # Handle VariableType if present
        if hasattr(obj, 'tag') and hasattr(obj, 'datatype'):
            # This is a VariableType
            return {s: getattr(obj, s) for s in obj.__slots__ if hasattr(obj, s)}
        
        return json.JSONEncoder.default(self, obj)


def create_database(db_path: str | Path) -> sqlite3.Connection:
    """Create a new SQLite database with QueryResult schema.
    
    Args:
        db_path: Path to the SQLite database file. If the file exists,
                 it will be opened. If it doesn't exist, it will be created
                 with the appropriate schema.
    
    Returns:
        sqlite3.Connection: Connection to the database
    
    Raises:
        sqlite3.Error: If database creation fails
    """
    db_path = Path(db_path)
    
    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Connect to database (creates file if it doesn't exist)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    
    # Create the runs table if it doesn't exist
    conn.execute("""
        CREATE TABLE IF NOT EXISTS runs (
            run_id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT,
            git_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create index on git_hash for filtering by code version
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_git_hash ON runs(git_hash)
    """)
    
    # Create index on created_at for chronological queries
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at)
    """)
    
    # Create the query_results table if it doesn't exist
    # Note: run_id is INTEGER to match runs.run_id (INTEGER PRIMARY KEY)
    # Foreign key constraint ensures referential integrity
    conn.execute("""
        CREATE TABLE IF NOT EXISTS query_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            query_id TEXT NOT NULL,
            flow_type TEXT NOT NULL,
            influence_statement TEXT,
            paths TEXT,
            elem_code TEXT,
            elem_line_no INTEGER,
            elem_name TEXT,
            field TEXT,
            filename TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
        )
    """)
    
    # Create index on run_id for faster lookups and comparisons between runs
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_run_id ON query_results(run_id)
    """)
    
    # Create index on query_id for faster lookups
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_query_id ON query_results(query_id)
    """)
    
    # Create composite index on run_id and query_id for efficient run comparisons
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_run_query ON query_results(run_id, query_id)
    """)
    
    # Create index on flow_type for filtering
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_flow_type ON query_results(flow_type)
    """)
    
    # Create index on filename for filtering by file
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_filename ON query_results(filename)
    """)
    
    conn.commit()
    logger.info(f"Database initialized at {db_path}")
    
    return conn


def create_run(conn: sqlite3.Connection, description: str | None = None) -> int:
    """Create a new run record in the database.
    
    This function creates a new run entry that can be used to group query results
    together for snapshot testing and comparison. The function automatically detects
    the current git hash of the codebase.
    
    Args:
        conn: SQLite database connection
        description: Optional description of the run (e.g., "Nightly scan", "Pre-commit check")
    
    Returns:
        int: The run_id (integer primary key) of the newly created run
    
    Raises:
        sqlite3.Error: If insertion fails
    """
    # Automatically detect git hash
    # Security: All command arguments are hardcoded, not user-controlled
    git_hash = None
    try:
        # Find a safe working directory - use the directory containing this module
        # This ensures we're running git from a known location, not an untrusted cwd
        module_dir = Path(__file__).parent.resolve()
        
        # Try to find git repo root by walking up from module directory
        # This is safer than using current working directory which could be untrusted
        git_repo_root = None
        current_path = module_dir
        max_levels = 10  # Limit search depth to prevent infinite loops
        for _ in range(max_levels):
            if (current_path / '.git').exists() or (current_path / '.git').is_dir():
                git_repo_root = current_path
                break
            if current_path.parent == current_path:  # Reached filesystem root
                break
            current_path = current_path.parent
        
        # If no git repo found, use module directory as fallback
        # Git will fail gracefully if not in a repo
        cwd = git_repo_root if git_repo_root else module_dir
        
        # Security: Use minimal environment to prevent environment variable attacks
        # Only include PATH and essential variables, exclude GIT_* variables that could be malicious
        safe_env = {
            'PATH': os.environ.get('PATH', ''),
            'HOME': os.environ.get('HOME', ''),
            'USER': os.environ.get('USER', ''),
        }
        
        # Security: All command arguments are hardcoded literals, not user-controlled
        # 'git', 'rev-parse', 'HEAD' are all hardcoded strings
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],  # Hardcoded command - no user input
            cwd=str(cwd),  # Use safe working directory
            env=safe_env,  # Use minimal, safe environment
            capture_output=True,
            text=True,
            check=True,
            timeout=5  # Prevent hanging
        )
        
        git_hash = result.stdout.strip()
        # Validate output - should be a 40-character hex string (SHA-1) or longer (SHA-256)
        if not git_hash or len(git_hash) < 7:  # Minimum valid short hash is 7 chars
            logger.warning("Git command returned invalid hash, setting to None")
            git_hash = None
        # Additional validation: check it looks like a git hash (hex characters)
        elif not all(c in '0123456789abcdefABCDEF' for c in git_hash):
            logger.warning(f"Git hash contains invalid characters: {git_hash}, setting to None")
            git_hash = None
    except subprocess.TimeoutExpired:
        logger.warning("Git command timed out while getting hash, setting to None")
        git_hash = None
    except subprocess.CalledProcessError as e:
        logger.warning(f"Error getting git hash (exit code {e.returncode}): {e.stderr.strip()}, setting to None")
        git_hash = None
    except FileNotFoundError:
        logger.warning("Git command not found, setting git_hash to None")
        git_hash = None
    except Exception as e:
        logger.warning(f"Unexpected error getting git hash: {e}, setting to None")
        git_hash = None
    
    cursor = conn.execute("""
        INSERT INTO runs (description, git_hash)
        VALUES (?, ?)
    """, (description, git_hash))
    
    conn.commit()
    run_id = cursor.lastrowid
    logger.info(f"Created run with run_id={run_id}, description={description}, git_hash={git_hash}")
    return run_id


def get_runs(conn: sqlite3.Connection) -> list[dict]:
    """Retrieve all runs from the database, sorted by creation time.
    
    Returns all runs sorted by timestamp in descending order (most recent first).
    Each run is returned as a dictionary with keys: run_id, description, git_hash, created_at.
    
    Args:
        conn: SQLite database connection
    
    Returns:
        list[dict]: List of run dictionaries, sorted by created_at descending.
                    Each dict contains: run_id (int), description (str | None),
                    git_hash (str | None), created_at (str).
                    Returns empty list if no runs exist.
    
    Raises:
        sqlite3.Error: If query fails
    """
    cursor = conn.execute("""
        SELECT run_id, description, git_hash, created_at
        FROM runs
        ORDER BY created_at DESC
    """)
    
    rows = cursor.fetchall()
    
    if not rows:
        return []
    
    # Convert rows to list of dictionaries
    runs = []
    for row in rows:
        runs.append({
            'run_id': int(row['run_id']),  # Keep as integer to match database type
            'description': row['description'],
            'git_hash': row['git_hash'],
            'created_at': row['created_at']
        })
    
    return runs


def drop_run(conn: sqlite3.Connection, run_id: int) -> tuple[int, bool]:
    """Delete a run and all its associated query results.
    
    This function performs a cascading delete: first deletes all query results
    associated with the run_id, then deletes the run itself. The operation is
    atomic - if either deletion fails, the transaction is rolled back.
    
    Note: Due to FOREIGN KEY CASCADE, query results will be automatically deleted
    when the run is deleted, but we delete them explicitly first for clarity.
    
    Args:
        conn: SQLite database connection
        run_id: The run_id (integer) of the run to delete
    
    Returns:
        tuple[int, bool]: A tuple containing:
            - int: Number of query results deleted
            - bool: True if the run was successfully deleted, False otherwise
    
    Raises:
        sqlite3.Error: If deletion fails
        ValueError: If run_id is None or invalid
    """
    if run_id is None:
        raise ValueError("run_id cannot be None")
    
    try:
        # Start a transaction for atomicity
        # First, delete all query results associated with this run
        cursor = conn.execute("""
            DELETE FROM query_results
            WHERE run_id = ?
        """, (run_id,))
        
        num_results_deleted = cursor.rowcount
        
        # Then, delete the run itself
        cursor = conn.execute("""
            DELETE FROM runs
            WHERE run_id = ?
        """, (run_id,))
        
        run_deleted = cursor.rowcount > 0
        
        # Commit the transaction
        conn.commit()
        
        if run_deleted:
            logger.info(f"Deleted run {run_id} and {num_results_deleted} associated query results")
        else:
            logger.warning(f"Run {run_id} not found, but deleted {num_results_deleted} query results (if any)")
        
        return num_results_deleted, run_deleted
        
    except sqlite3.Error as e:
        # Rollback on error
        conn.rollback()
        logger.error(f"Error deleting run {run_id}: {e}")
        raise


def _query_result_to_comparable_dict(row: sqlite3.Row) -> dict:
    """Convert a database row to a comparable dictionary for set operations.
    
    This function deserializes JSON fields and normalizes the data structure
    so that QueryResults can be compared as sets, with special handling for
    paths (comparing as sets, handling None values).
    
    Args:
        row: SQLite Row object from query_results table
    
    Returns:
        dict: Normalized dictionary suitable for comparison
    """
    # Deserialize JSON fields
    influence_statement = None
    if row['influence_statement']:
        try:
            influence_statement = json.loads(row['influence_statement'])
        except (json.JSONDecodeError, TypeError):
            influence_statement = None
    
    paths = None
    if row['paths']:
        try:
            paths_data = json.loads(row['paths'])
            # paths_data is a list from JSON, convert to frozenset for comparison
            # We'll compare as a set of serialized paths since we can't easily
            # reconstruct InfluencePath objects from JSON
            if paths_data:
                # Sort and convert to tuple for hashability in set comparison
                paths = tuple(sorted(json.dumps(p, sort_keys=True) for p in paths_data))
            else:
                paths = None
        except (json.JSONDecodeError, TypeError):
            paths = None
    
    # Create a comparable dict with all fields
    # Use tuple for paths to make it hashable for set operations
    return {
        'query_id': row['query_id'],
        'flow_type': row['flow_type'],
        'influence_statement': json.dumps(influence_statement, sort_keys=True) if influence_statement else None,
        'paths': paths,  # Already a tuple (hashable) or None
        'elem_code': row['elem_code'],
        'elem_line_no': row['elem_line_no'],
        'elem_name': row['elem_name'],
        'field': row['field'],
        'filename': row['filename']
    }


def _query_results_equal(result1: dict, result2: dict) -> bool:
    """Compare two query result dictionaries for equality.
    
    Two QueryResults are considered equal if all their fields match, with
    special handling for paths which are compared as sets (ignoring order).
    
    Args:
        result1: First query result dictionary
        result2: Second query result dictionary
    
    Returns:
        bool: True if the results are equal, False otherwise
    """
    # Compare all fields except paths first
    fields_to_compare = ['query_id', 'flow_type', 'influence_statement', 
                         'elem_code', 'elem_line_no', 'elem_name', 'field', 'filename']
    
    for field in fields_to_compare:
        if result1.get(field) != result2.get(field):
            return False
    
    # Special handling for paths: compare as sets (both can be None)
    paths1 = result1.get('paths')
    paths2 = result2.get('paths')
    
    # Both None -> equal
    if paths1 is None and paths2 is None:
        return True
    
    # One None, one not None -> not equal
    if paths1 is None or paths2 is None:
        return False
    
    # Both are tuples (from _query_result_to_comparable_dict), compare as sets
    return set(paths1) == set(paths2)


def compare_runs(conn: sqlite3.Connection, run_id1: int, run_id2: int) -> tuple[bool, dict]:
    """Compare two runs to determine if they have identical query results.
    
    This is the core of snapshot testing functionality. Two runs are considered
    equal if they contain the same set of QueryResults (ignoring order), where
    individual QueryResults are compared with special handling for paths (compared
    as sets, handling None values).
    
    Args:
        conn: SQLite database connection
        run_id1: First run ID to compare
        run_id2: Second run ID to compare
    
    Returns:
        tuple[bool, dict]: A tuple containing:
            - bool: True if runs are identical, False otherwise
            - dict: Detailed comparison results with keys:
                - 'equal': bool (same as return value)
                - 'run1_count': int (number of results in run1)
                - 'run2_count': int (number of results in run2)
                - 'only_in_run1': list[dict] (results only in run1)
                - 'only_in_run2': list[dict] (results only in run2)
                - 'different': list[tuple[dict, dict]] (results with same query_id but different content)
    
    Raises:
        sqlite3.Error: If query fails
        ValueError: If run_id is None or invalid
    """
    if run_id1 is None or run_id2 is None:
        raise ValueError("run_id cannot be None")
    
    # Fetch all query results for both runs
    cursor1 = conn.execute("""
        SELECT query_id, flow_type, influence_statement, paths,
               elem_code, elem_line_no, elem_name, field, filename
        FROM query_results
        WHERE run_id = ?
        ORDER BY id
    """, (run_id1,))
    
    cursor2 = conn.execute("""
        SELECT query_id, flow_type, influence_statement, paths,
               elem_code, elem_line_no, elem_name, field, filename
        FROM query_results
        WHERE run_id = ?
        ORDER BY id
    """, (run_id2,))
    
    rows1 = cursor1.fetchall()
    rows2 = cursor2.fetchall()
    
    # Convert to comparable dictionaries
    results1 = [_query_result_to_comparable_dict(row) for row in rows1]
    results2 = [_query_result_to_comparable_dict(row) for row in rows2]
    
    # Create sets for comparison (need to use tuples since dicts aren't hashable)
    # We'll use a tuple of all field values as the key
    def make_hashable(result: dict) -> tuple:
        """Convert a result dict to a hashable tuple for set operations."""
        return (
            result['query_id'],
            result['flow_type'],
            result['influence_statement'],
            result['paths'],  # Already a tuple or None
            result['elem_code'],
            result['elem_line_no'],
            result['elem_name'],
            result['field'],
            result['filename']
        )
    
    set1 = {make_hashable(r) for r in results1}
    set2 = {make_hashable(r) for r in results2}
    
    # Find differences
    only_in_run1 = [r for r in results1 if make_hashable(r) not in set2]
    only_in_run2 = [r for r in results2 if make_hashable(r) not in set1]
    
    # Find results with same query_id but different content
    # Group by query_id to find potential matches
    results1_by_query = {}
    results2_by_query = {}
    
    for r in results1:
        qid = r['query_id']
        if qid not in results1_by_query:
            results1_by_query[qid] = []
        results1_by_query[qid].append(r)
    
    for r in results2:
        qid = r['query_id']
        if qid not in results2_by_query:
            results2_by_query[qid] = []
        results2_by_query[qid].append(r)
    
    different = []
    all_query_ids = set(results1_by_query.keys()) | set(results2_by_query.keys())
    
    for qid in all_query_ids:
        r1_list = results1_by_query.get(qid, [])
        r2_list = results2_by_query.get(qid, [])
        
        # Check if there are any pairs that don't match
        for r1 in r1_list:
            found_match = False
            for r2 in r2_list:
                if _query_results_equal(r1, r2):
                    found_match = True
                    break
            if not found_match and r1 not in only_in_run1:
                # This result exists in both runs but is different
                # Find a corresponding r2 that also doesn't match
                for r2 in r2_list:
                    if not _query_results_equal(r1, r2) and r2 not in only_in_run2:
                        different.append((r1, r2))
                        break
    
    # Runs are equal if sets are identical
    are_equal = (set1 == set2) and len(only_in_run1) == 0 and len(only_in_run2) == 0 and len(different) == 0
    
    return are_equal, {
        'equal': are_equal,
        'run1_count': len(results1),
        'run2_count': len(results2),
        'only_in_run1': only_in_run1,
        'only_in_run2': only_in_run2,
        'different': different
    }


def insert_query_result(conn: sqlite3.Connection, query_result: 'QueryResult', run_id: int) -> int:
    """Insert a QueryResult object into the database.
    
    Args:
        conn: SQLite database connection
        query_result: QueryResult object to insert
        run_id: Integer identifier for this scan run (must exist in runs table)
    
    Returns:
        int: The count of inserted records (always 1 for this function)
    
    Raises:
        sqlite3.Error: If insertion fails (including foreign key constraint violations)
        ValueError: If run_id is None or invalid
    """
    if run_id is None:
        raise ValueError("run_id cannot be None")
    
    # Ensure run_id is an integer
    try:
        run_id = int(run_id)
    except (ValueError, TypeError):
        raise ValueError(f"run_id must be an integer, got: {type(run_id).__name__}")
    
    # Serialize influence_statement to JSON
    influence_statement_json = None
    if query_result.influence_statement is not None:
        influence_statement_json = json.dumps(
            query_result.influence_statement,
            cls=QueryResultEncoder
        )
    
    # Serialize paths to JSON
    paths_json = None
    if query_result.paths is not None:
        paths_json = json.dumps(
            list(query_result.paths),
            cls=QueryResultEncoder
        )
    
    # Get flow_type as string (enum name)
    flow_type_str = query_result.flow_type.name if hasattr(query_result.flow_type, 'name') else str(query_result.flow_type)
    
    cursor = conn.execute("""
        INSERT INTO query_results (
            run_id,
            query_id,
            flow_type,
            influence_statement,
            paths,
            elem_code,
            elem_line_no,
            elem_name,
            field,
            filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        run_id,
        query_result.query_id,
        flow_type_str,
        influence_statement_json,
        paths_json,
        query_result.elem_code,
        query_result.elem_line_no,
        query_result.elem_name,
        query_result.field,
        query_result.filename
    ))
    
    conn.commit()
    return 1


def insert_query_results(conn: sqlite3.Connection, query_results: list['QueryResult'], run_id: int) -> list[int]:
    """Insert multiple QueryResult objects into the database using batch insert.
    
    This function performs a single database operation to insert all query results,
    which is much more efficient than inserting them one at a time. All results
    will be associated with the same run_id for snapshot testing.
    
    Args:
        conn: SQLite database connection
        query_results: List of QueryResult objects to insert
        run_id: Integer identifier for this scan run (must exist in runs table)
    
    Returns:
        list[int]: List of row IDs of the inserted records
    
    Raises:
        sqlite3.Error: If insertion fails (including foreign key constraint violations)
        ValueError: If run_id is None or invalid
    """
    if not query_results:
        return []
    
    if run_id is None:
        raise ValueError("run_id cannot be None")
    
    # Ensure run_id is an integer
    try:
        run_id = int(run_id)
    except (ValueError, TypeError):
        raise ValueError(f"run_id must be an integer, got: {type(run_id).__name__}")
    
    # Prepare all data for batch insert
    rows_data = []
    
    for query_result in query_results:
        # Serialize influence_statement to JSON
        influence_statement_json = None
        if query_result.influence_statement is not None:
            influence_statement_json = json.dumps(
                query_result.influence_statement,
                cls=QueryResultEncoder
            )
        
        # Serialize paths to JSON
        paths_json = None
        if query_result.paths is not None:
            paths_json = json.dumps(
                list(query_result.paths),
                cls=QueryResultEncoder
            )
        
        # Get flow_type as string (enum name)
        flow_type_str = query_result.flow_type.name if hasattr(query_result.flow_type, 'name') else str(query_result.flow_type)
        
        rows_data.append((
            run_id,
            query_result.query_id,
            flow_type_str,
            influence_statement_json,
            paths_json,
            query_result.elem_code,
            query_result.elem_line_no,
            query_result.elem_name,
            query_result.field,
            query_result.filename
        ))
    
    # Perform batch insert
    cursor = conn.executemany("""
        INSERT INTO query_results (
            run_id,
            query_id,
            flow_type,
            influence_statement,
            paths,
            elem_code,
            elem_line_no,
            elem_name,
            field,
            filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows_data)
    
    conn.commit()
    
    # Get the row IDs of inserted records
    # Note: executemany() doesn't set lastrowid reliably, so we query for the IDs
    # by using the fact that they were just inserted and are sequential
    num_rows = len(query_results)
    if num_rows == 0:
        return []
    
    # Query for the last num_rows rows inserted (they should be the ones we just inserted)
    cursor = conn.execute("""
        SELECT id FROM query_results 
        WHERE run_id = ? 
        ORDER BY id DESC 
        LIMIT ?
    """, (run_id, num_rows))
    
    row_ids = [row[0] for row in cursor.fetchall()]
    # Reverse to get them in insertion order
    row_ids.reverse()
    
    return row_ids


def get_results_json(conn: sqlite3.Connection, run_id: int = 0) -> str:
    """Retrieve all query results for a run and generate a JSON string.
    
    This function retrieves all QueryResult objects from the database for the
    given run_id and formats them as a JSON string matching the format produced
    by flow_result.dump_json(). The format includes a results dictionary organized
    by query_id, with each entry containing query result information.
    
    Args:
        conn: SQLite database connection
        run_id: Integer identifier for the run (default: 0, which retrieves all runs)
    
    Returns:
        str: JSON string containing the results in the same format as flow_result.dump_json()
    
    Raises:
        sqlite3.Error: If query fails
        ValueError: If run_id is None or invalid
    """
    if run_id is None:
        raise ValueError("run_id cannot be None")
    
    # Ensure run_id is an integer
    try:
        run_id = int(run_id)
    except (ValueError, TypeError):
        raise ValueError(f"run_id must be an integer, got: {type(run_id).__name__}")
    
    # Fetch all query results
    if run_id == 0:
        # Retrieve all results from all runs
        cursor = conn.execute("""
            SELECT query_id, flow_type, influence_statement, paths,
                   elem_code, elem_line_no, elem_name, field, filename
            FROM query_results
            ORDER BY id
        """)
    else:
        cursor = conn.execute("""
            SELECT query_id, flow_type, influence_statement, paths,
                   elem_code, elem_line_no, elem_name, field, filename
            FROM query_results
            WHERE run_id = ?
            ORDER BY id
        """, (run_id,))
    
    rows = cursor.fetchall()
    
    if not rows:
        # Return empty results structure matching the format
        job_result = {
            "preset": None,
            "help_url": None,
            "result_id": None,
            "service_version": None,
            "flow_scanner_version": None,
            "report_label": None,
            "email": None,
            "scan_start": None,
            "scan_end": None,
            "results": {}
        }
        return json.dumps(job_result, indent=4, cls=InfluenceStatementEncoder)
    
    # Build results_dict similar to gen_result_dict()
    results_dict = {}
    counter = 0
    
    for row in rows:
        query_id = row['query_id']
        flow_type = row['flow_type']
        
        # Deserialize influence_statement
        influence_statement = None
        if row['influence_statement']:
            try:
                influence_statement = json.loads(row['influence_statement'])
            except (json.JSONDecodeError, TypeError):
                influence_statement = None
        
        # Deserialize paths
        paths = None
        if row['paths']:
            try:
                paths = json.loads(row['paths'])
            except (json.JSONDecodeError, TypeError):
                paths = None
        
        # Initialize query_id entry if needed
        if query_id not in results_dict:
            results_dict[query_id] = []
        
        # Determine source code, line, filename, elem_name from influence_statement or row
        if influence_statement is not None:
            src_code = influence_statement.get('source_text', row['elem_code'])
            src_line = influence_statement.get('line_no', row['elem_line_no'])
            file_name = influence_statement.get('flow_path', row['filename'])
            elem_name = influence_statement.get('element_name', row['elem_name'])
            field_end = influence_statement.get('influenced_var', row['field'] or row['elem_name'])
        else:
            src_code = row['elem_code']
            src_line = row['elem_line_no']
            file_name = row['filename']
            elem_name = row['elem_name']
            field_end = row['field'] or row['elem_name']
        
        # Build base result entry
        to_append = {
            "query_id": query_id,
            "query_name": query_id,  # Use query_id as name since we don't have preset
            "severity": "",  # Empty since we don't have preset
            "description": "",  # Empty since we don't have preset
            "counter": counter,
            "elem_name": elem_name,
            "field": field_end,
            "elem_code": src_code,
            "elem_line_no": src_line,
            "filename": file_name,
            "flow_type": flow_type
        }
        
        # Build flow field (tuple of InfluenceStatement dicts)
        if paths is None or len(paths) == 0:
            if influence_statement is None:
                # Lexical query only - no flow
                to_append["flow"] = None
                results_dict[query_id].append(to_append)
                counter += 1
                continue
            else:
                # Single statement, no paths
                statements = [(influence_statement,)]
        else:
            # Build statements from paths
            statements = []
            for path_dict in paths:
                # Get history from path (list of InfluenceStatement dicts)
                history = path_dict.get('history', [])
                # Filter out "[builtin]" statements
                pruned_history = [stmt for stmt in history if stmt.get('source_text') != "[builtin]"]
                
                if influence_statement is not None:
                    # Check if last history item matches influence_statement
                    if pruned_history and pruned_history[-1] == influence_statement:
                        statements.append(tuple(pruned_history))
                    elif influence_statement.get('source_text') != "[builtin]":
                        statements.append(tuple(pruned_history) + (influence_statement,))
                    else:
                        statements.append(tuple(pruned_history))
                else:
                    statements.append(tuple(pruned_history))
        
        # Create entries for each statement tuple
        for path_tuple in statements:
            new_path = to_append.copy()
            new_path["flow"] = path_tuple
            new_path["counter"] = counter
            results_dict[query_id].append(new_path)
        
        counter += 1
    
    # Build job_result structure matching _make_job_result()
    job_result = {
        "preset": None,
        "help_url": None,
        "result_id": None,
        "service_version": None,
        "flow_scanner_version": None,
        "report_label": None,
        "email": None,
        "scan_start": None,
        "scan_end": None,
        "results": results_dict
    }
    
    # Serialize to JSON using InfluenceStatementEncoder to match dump_json() format
    return json.dumps(job_result, indent=4, cls=InfluenceStatementEncoder)

