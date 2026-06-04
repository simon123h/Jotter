from yoyo import step

step(
    """
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    "DROP TABLE IF EXISTS projects",
)

step(
    """
    CREATE TABLE IF NOT EXISTS buckets (
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        position REAL NOT NULL,
        PRIMARY KEY (project_id, name),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
    """,
    "DROP TABLE IF EXISTS buckets",
)

step(
    """
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        bucket TEXT NOT NULL,
        position REAL NOT NULL,
        tags TEXT NOT NULL,
        filename TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id, bucket) REFERENCES buckets(project_id, name) ON DELETE CASCADE
    )
    """,
    "DROP TABLE IF EXISTS tasks",
)

step(
    "CREATE INDEX IF NOT EXISTS idx_tasks_project_bucket ON tasks(project_id, bucket)",
    "DROP INDEX IF EXISTS idx_tasks_project_bucket",
)

step(
    "CREATE INDEX IF NOT EXISTS idx_buckets_project ON buckets(project_id)",
    "DROP INDEX IF EXISTS idx_buckets_project",
)
