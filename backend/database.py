import os
import sqlite3
from contextlib import contextmanager

from config import IS_PRODUCTION, get_data_dir

data_dir = get_data_dir()
if data_dir:
    DB_PATH = os.path.abspath(os.path.join(data_dir, "tasks.db"))
elif IS_PRODUCTION:
    DB_PATH = os.path.abspath(os.path.join(os.getcwd(), "tasks/tasks.db"))
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks/tasks.db")


def get_db_connection():
    """Establishes a connection to the SQLite database and configures WAL mode."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Configure WAL mode for concurrency and durability
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    """Initializes the database tables with the correct multi-project schema."""
    conn = get_db_connection()
    try:
        # Check if tasks table exists and has project_id column
        cursor = conn.execute("PRAGMA table_info(tasks)")
        columns = [row["name"] for row in cursor.fetchall()]

        # If tasks table exists but has no project_id column, drop old tables for a clean migration
        if columns and "project_id" not in columns:
            conn.execute("DROP TABLE IF EXISTS tasks")
            conn.execute("DROP TABLE IF EXISTS buckets")
            conn.execute("DROP TABLE IF EXISTS projects")

        # 1. Projects table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # 2. Buckets table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS buckets (
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT NOT NULL DEFAULT '',
                position REAL NOT NULL,
                color TEXT,
                PRIMARY KEY (project_id, name),
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)

        # Check if buckets table has subtitle or color columns (migration check)
        cursor = conn.execute("PRAGMA table_info(buckets)")
        bucket_columns = [row["name"] for row in cursor.fetchall()]
        if bucket_columns and "subtitle" not in bucket_columns:
            conn.execute("ALTER TABLE buckets ADD COLUMN subtitle TEXT NOT NULL DEFAULT ''")
        if bucket_columns and "color" not in bucket_columns:
            conn.execute("ALTER TABLE buckets ADD COLUMN color TEXT")

        # Check if tasks table has due_date and priority columns (migration check)
        cursor = conn.execute("PRAGMA table_info(tasks)")
        task_columns = [row["name"] for row in cursor.fetchall()]
        if task_columns:
            if "due_date" not in task_columns:
                conn.execute("ALTER TABLE tasks ADD COLUMN due_date TEXT")
            if "priority" not in task_columns:
                conn.execute("ALTER TABLE tasks ADD COLUMN priority TEXT")

        # 3. Tasks table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                bucket TEXT NOT NULL,
                position REAL NOT NULL,
                tags TEXT NOT NULL, -- JSON array of strings
                filename TEXT NOT NULL,
                due_date TEXT,
                priority TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id, bucket) REFERENCES buckets(project_id, name) ON DELETE CASCADE
            )
        """)

        # Indexes for fast querying/filtering
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project_bucket ON tasks(project_id, bucket)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_buckets_project ON buckets(project_id)")

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
