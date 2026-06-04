from yoyo import step


def add_is_default(conn):
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(buckets)")
    rows = cursor.fetchall()
    columns = []
    for row in rows:
        try:
            columns.append(row["name"])
        except (TypeError, IndexError):
            columns.append(row[1])

    if "is_default" not in columns:
        cursor.execute("ALTER TABLE buckets ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0")
        cursor.execute("UPDATE buckets SET is_default = 1 WHERE name = 'backlog'")


step(add_is_default)
