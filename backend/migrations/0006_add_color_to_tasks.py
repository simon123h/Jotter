from yoyo import step


def add_color_to_tasks(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(tasks)")
    rows = cursor.fetchall()
    columns = []
    for row in rows:
        try:
            columns.append(row["name"])
        except (TypeError, IndexError):
            columns.append(row[1])

    if "color" not in columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN color TEXT")


step(add_color_to_tasks)
