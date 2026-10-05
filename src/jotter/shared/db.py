"""SQLite connection creation and schema setup."""

import hashlib
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

_schema_lock = threading.Lock()
_initialized_schemas: set[str] = set()


def create_sqlite_connection(db_path: Path | str, init: bool = True) -> sqlite3.Connection:
    """Creates a configured SQLite connection and initializes the database schema if needed."""
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
    conn.execute("PRAGMA busy_timeout=15000;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    # Initialize schema safely once per database path
    if init:
        canon_path = str(path.resolve())
        with _schema_lock:
            if canon_path not in _initialized_schemas:
                init_schema(conn)
                _initialized_schemas.add(canon_path)

    return conn


_SCHEMA = """
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        done_clean_period INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
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
        file_mtime_ns INTEGER DEFAULT NULL,
        file_size INTEGER DEFAULT NULL,
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

    -- Only rewrite the FTS entry when an indexed value actually changes (not for e.g. file stat bookkeeping).
    -- "UPDATE OF <columns>" would not do: it fires whenever a column is in the SET list, even with the same value.
    CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks
    WHEN old.project_id IS NOT new.project_id OR old.title IS NOT new.title
        OR old.body IS NOT new.body OR old.tags IS NOT new.tags
    BEGIN
        DELETE FROM tasks_fts WHERE rowid = old.rowid;
        INSERT INTO tasks_fts(rowid, id, project_id, title, body, tags)
        VALUES (new.rowid, new.id, new.project_id, new.title, new.body, new.tags);
    END;
"""

# Identifies the table layout. It is derived from the schema text, so any change to it (ignoring whitespace) is
# noticed automatically, even in a build without a version number (a development checkout). It is part of the
# recorded index version, so changing it makes the next start recreate the index.
SCHEMA_VERSION = hashlib.sha256(" ".join(_SCHEMA.split()).encode()).hexdigest()[:8]

_DROP_SCHEMA = """
DROP TRIGGER IF EXISTS tasks_ai;
DROP TRIGGER IF EXISTS tasks_ad;
DROP TRIGGER IF EXISTS tasks_au;
DROP TABLE IF EXISTS tasks_fts;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS buckets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS meta;
"""


def init_schema(conn: sqlite3.Connection) -> None:
    """Creates the database tables and indexes if they do not exist. Never alters an existing table."""
    conn.executescript(_SCHEMA)


def recreate_schema(conn: sqlite3.Connection) -> None:
    """Drops every table and recreates the schema from scratch, leaving the index empty.

    The index is a disposable cache, so a schema change is handled by rebuilding it from the files instead of by
    migrating it. Tables are dropped rather than the file deleted, because other connections keep it open. It runs
    in one transaction, so a concurrent reader sees either the old schema or the new one, never a partial one.
    """
    try:
        conn.executescript(f"BEGIN IMMEDIATE;\n{_DROP_SCHEMA}\n{_SCHEMA}\nCOMMIT;")
    except Exception:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise


class ConnectionPool:
    """A small pool of SQLite connections to one database, so requests never share a connection.

    Sync endpoints run on a thread pool: every request borrows its own connection and hands it back afterwards.
    Idle connections stay open (warm page and statement caches, no file opens per request, and SQLite keeps its
    -wal/-shm files instead of recreating them). At most `max_idle` are kept; extra ones are closed on return.
    """

    def __init__(self, db_path: Path | str, max_idle: int = 8):
        self.db_path = Path(db_path)
        self.max_idle = max_idle
        self._idle: list[sqlite3.Connection] = []
        self._lock = threading.Lock()
        self._closed = False
        # Open one connection now: it creates the schema and fails early if the database is unusable
        self._idle.append(create_sqlite_connection(self.db_path))

    def acquire(self) -> sqlite3.Connection:
        with self._lock:
            if self._idle:
                return self._idle.pop()
        return create_sqlite_connection(self.db_path)

    def release(self, conn: sqlite3.Connection) -> None:
        try:
            if conn.in_transaction:
                conn.rollback()
        except sqlite3.Error:
            conn.close()
            return
        with self._lock:
            if not self._closed and len(self._idle) < self.max_idle:
                self._idle.append(conn)
                return
        conn.close()

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = self.acquire()
        try:
            yield conn
        finally:
            self.release(conn)

    def close(self) -> None:
        """Closes the idle connections; connections still borrowed are closed when they come back."""
        with self._lock:
            self._closed = True
            idle, self._idle = self._idle, []
        for conn in idle:
            conn.close()
