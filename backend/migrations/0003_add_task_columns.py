from yoyo import step


def add_columns(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(tasks)")
    rows = cursor.fetchall()
    columns = []
    for row in rows:
        try:
            columns.append(row["name"])
        except (TypeError, IndexError):
            columns.append(row[1])

    if "due_date" not in columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN due_date TEXT")
    if "priority" not in columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN priority TEXT")


step(add_columns)
