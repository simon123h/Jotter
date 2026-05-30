import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.db")


def get_db_connection():
    """Establishes a connection to the SQLite database and configures WAL mode."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Configure WAL mode for concurrency and durability
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Initializes the tasks database table if it doesn't exist."""
    conn = get_db_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                bucket TEXT NOT NULL,
                position REAL NOT NULL,
                tags TEXT NOT NULL, -- JSON array of strings
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        # Indexes for fast querying/filtering
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_bucket ON tasks(bucket)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS buckets (
                name TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                position REAL NOT NULL
            )
        """)
        conn.commit()
    finally:
        conn.close()


@contextmanager
def db_session():
    """Context manager for cleaner session handling in APIs."""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
