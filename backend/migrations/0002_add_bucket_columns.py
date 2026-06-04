from yoyo import step


def add_columns(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(buckets)")
    rows = cursor.fetchall()
    columns = []
    for row in rows:
        try:
            columns.append(row["name"])
        except (TypeError, IndexError):
            columns.append(row[1])

    if "subtitle" not in columns:
        cursor.execute("ALTER TABLE buckets ADD COLUMN subtitle TEXT NOT NULL DEFAULT ''")
    if "color" not in columns:
        cursor.execute("ALTER TABLE buckets ADD COLUMN color TEXT")
    if "layout" not in columns:
        cursor.execute("ALTER TABLE buckets ADD COLUMN layout TEXT NOT NULL DEFAULT 'list'")
    if "max_tasks" not in columns:
        cursor.execute("ALTER TABLE buckets ADD COLUMN max_tasks INTEGER")


step(add_columns)
