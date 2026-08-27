import sqlite3
import threading
from pathlib import Path
from typing import Optional

_db_lock = threading.Lock()
_connection: Optional[sqlite3.Connection] = None


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    global _connection
    with _db_lock:
        if _connection is None:
            if db_path is None:
                raise ValueError("Database path must be provided on first connection initialization.")
            
            path = Path(db_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            _connection = sqlite3.connect(
                str(path),
                check_same_thread=False,
                timeout=30.0,
                isolation_level=None  # autocommit mode, transactions managed explicitly
            )
            _connection.row_factory = sqlite3.Row
            
            # Pragmas
            _connection.execute("PRAGMA journal_mode=WAL;")
            _connection.execute("PRAGMA foreign_keys=ON;")
            
            # Create Schema
            _init_schema(_connection)
            
        return _connection


def _init_schema(conn: sqlite3.Connection) -> None:
    schema = """
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        done_clean_period INTEGER DEFAULT NULL,
        git_remote TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS buckets (
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT DEFAULT '',
        position REAL NOT NULL,
        color TEXT DEFAULT NULL,
        layout TEXT DEFAULT 'list',
        max_tasks INTEGER DEFAULT NULL,
        is_default BOOLEAN DEFAULT 0,
        PRIMARY KEY (project_id, name),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        bucket TEXT NOT NULL,
        position REAL NOT NULL,
        tags TEXT NOT NULL,
        attachments TEXT NOT NULL DEFAULT '[]',
        filename TEXT NOT NULL,
        body TEXT DEFAULT '',
        due_date TEXT DEFAULT NULL,
        planned_date TEXT DEFAULT NULL,
        priority TEXT DEFAULT NULL,
        color TEXT DEFAULT NULL,
        postponed_until TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id, bucket) REFERENCES buckets(project_id, name) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project_bucket ON tasks(project_id, bucket);
    CREATE INDEX IF NOT EXISTS idx_buckets_project ON buckets(project_id);
    """
    conn.executescript(schema)

    # Migration for postponed_until column if needed
    try:
        conn.execute("SELECT postponed_until FROM tasks LIMIT 0")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE tasks ADD COLUMN postponed_until TEXT DEFAULT NULL")


def close_db() -> None:
    global _connection
    with _db_lock:
        if _connection is not None:
            try:
                _connection.close()
            except Exception:
                pass
            _connection = None
