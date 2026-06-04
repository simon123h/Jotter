from yoyo import step


def migrate_task_id_to_string(conn):
    cursor = conn.cursor()

    # 1. Rename existing tasks table
    cursor.execute("ALTER TABLE tasks RENAME TO tasks_old")

    # 2. Create the new tasks table with TEXT type for id.
    cursor.execute("""
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            bucket TEXT NOT NULL,
            position REAL NOT NULL,
            tags TEXT NOT NULL,
            filename TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            due_date TEXT,
            priority TEXT,
            color TEXT,
            body TEXT DEFAULT '',
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id, bucket) REFERENCES buckets(project_id, name) ON DELETE CASCADE
        )
    """)

    # 3. Copy data from tasks_old to tasks. Cast the numeric ID to TEXT.
    cursor.execute("PRAGMA table_info(tasks_old)")
    columns = [row[1] for row in cursor.fetchall()]

    cols_to_copy = [
        c
        for c in columns
        if c
        in [
            "id",
            "project_id",
            "title",
            "bucket",
            "position",
            "tags",
            "filename",
            "created_at",
            "updated_at",
            "due_date",
            "priority",
            "color",
            "body",
        ]
    ]

    cols_str = ", ".join(cols_to_copy)

    select_parts = []
    for col in cols_to_copy:
        if col == "id":
            select_parts.append("CAST(id AS TEXT) as id")
        else:
            select_parts.append(col)
    select_str = ", ".join(select_parts)

    cursor.execute(f"INSERT INTO tasks ({cols_str}) SELECT {select_str} FROM tasks_old")

    # 4. Drop the old table
    cursor.execute("DROP TABLE tasks_old")

    # 5. Recreate index on the tasks table
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project_bucket ON tasks(project_id, bucket)")


def rollback_task_id_to_string(conn):
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE tasks RENAME TO tasks_old")
    cursor.execute("""
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            bucket TEXT NOT NULL,
            position REAL NOT NULL,
            tags TEXT NOT NULL,
            filename TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            due_date TEXT,
            priority TEXT,
            color TEXT,
            body TEXT DEFAULT '',
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id, bucket) REFERENCES buckets(project_id, name) ON DELETE CASCADE
        )
    """)
    cursor.execute("PRAGMA table_info(tasks_old)")
    columns = [row[1] for row in cursor.fetchall()]
    cols_to_copy = [
        c
        for c in columns
        if c
        in [
            "id",
            "project_id",
            "title",
            "bucket",
            "position",
            "tags",
            "filename",
            "created_at",
            "updated_at",
            "due_date",
            "priority",
            "color",
            "body",
        ]
    ]
    cols_str = ", ".join(cols_to_copy)
    select_parts = []
    for col in cols_to_copy:
        if col == "id":
            select_parts.append("CAST(id AS INTEGER) as id")
        else:
            select_parts.append(col)
    select_str = ", ".join(select_parts)
    cursor.execute(f"INSERT INTO tasks ({cols_str}) SELECT {select_str} FROM tasks_old")
    cursor.execute("DROP TABLE tasks_old")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project_bucket ON tasks(project_id, bucket)")


step(migrate_task_id_to_string, rollback_task_id_to_string)
