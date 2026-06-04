import os
import sqlite3
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from yoyo import get_backend, read_migrations

DB_PATH = "test_scratch.db"
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

def run_migrations():
    db_uri = f"sqlite:///{DB_PATH}"
    backend = get_backend(db_uri)
    migrations = read_migrations("./backend/migrations")
    with backend.lock():
        backend.apply_migrations(backend.to_apply(migrations))

print("1. Running initial migrations...")
run_migrations()

# Query projects to verify table exists
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type=\"table\"")
print("Tables after init:", cursor.fetchall())
conn.close()

print("2. Deleting database file...")
os.remove(DB_PATH)

print("3. Re-running migrations...")
run_migrations()

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type=\"table\"")
print("Tables after delete and re-init:", cursor.fetchall())
conn.close()
