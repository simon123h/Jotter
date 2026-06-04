from yoyo import step


def add_done_clean_period(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(projects)")
    rows = cursor.fetchall()
    columns = []
    for row in rows:
        try:
            columns.append(row["name"])
        except (TypeError, IndexError):
            columns.append(row[1])

    if "done_clean_period" not in columns:
        cursor.execute("ALTER TABLE projects ADD COLUMN done_clean_period INTEGER")


step(add_done_clean_period)
