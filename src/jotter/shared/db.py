"""SQLite connection creation and schema setup."""

import sqlite3
import threading
from pathlib import Path

_db_lock = threading.Lock()
_global_connection: sqlite3.Connection | None = None


def create_sqlite_connection(db_path: Path | str) -> sqlite3.Connection:
    """Creates a configured SQLite connection and initializes the database schema."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(
        str(path),
        check_same_thread=False,
        timeout=30.0,
        isolation_level=None,  # autocommit mode, transactions managed explicitly
    )
    conn.row_factory = sqlite3.Row

    # Performance and integrity pragmas
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    # Initialize schema
    init_schema(conn)
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    """Creates required database tables and indexes if they do not exist."""
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
        position REAL DEFAULT 1000.0,
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

    -- FTS5 Full-Text Search index for tasks
    CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        id UNINDEXED,
        project_id UNINDEXED,
        title,
        body,
        tags,
        tokenize='porter unicode61'
    );

    -- Synchronize tasks with FTS5 table
    CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
        INSERT INTO tasks_fts(rowid, id, project_id, title, body, tags)
        VALUES (new.rowid, new.id, new.project_id, new.title, new.body, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
        DELETE FROM tasks_fts WHERE rowid = old.rowid;
    END;

    CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
        DELETE FROM tasks_fts WHERE rowid = old.rowid;
        INSERT INTO tasks_fts(rowid, id, project_id, title, body, tags)
        VALUES (new.rowid, new.id, new.project_id, new.title, new.body, new.tags);
    END;
    """
    conn.executescript(schema)

    # Clean up any existing NULL positions in buckets
    try:
        conn.execute("UPDATE buckets SET position = 1000.0 WHERE position IS NULL")
    except sqlite3.OperationalError:
        pass

    # Column migrations
    try:
        conn.execute("SELECT postponed_until FROM tasks LIMIT 0")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE tasks ADD COLUMN postponed_until TEXT DEFAULT NULL")

    # Backfill FTS index if table was newly created
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM tasks_fts")
        fts_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tasks")
        tasks_count = cur.fetchone()[0]
        if fts_count == 0 and tasks_count > 0:
            cur.execute(
                "INSERT INTO tasks_fts(rowid, id, project_id, title, body, tags) "
                "SELECT rowid, id, project_id, title, body, tags FROM tasks"
            )
    except Exception:
        pass


def get_db(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Convenience helper / fallback for scripts and tests."""
    global _global_connection
    with _db_lock:
        if _global_connection is None:
            if db_path is None:
                raise ValueError("Database path must be provided on first connection initialization.")
            _global_connection = create_sqlite_connection(db_path)
        return _global_connection


def close_db() -> None:
    """Runs PRAGMA optimize and closes global fallback connection if open."""
    global _global_connection
    with _db_lock:
        if _global_connection is not None:
            try:
                _global_connection.execute("PRAGMA optimize;")
            except Exception:
                pass
            try:
                _global_connection.close()
            except Exception:
                pass
            _global_connection = None
