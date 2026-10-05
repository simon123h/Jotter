"""FastAPI core technical dependencies."""

import sqlite3
from collections.abc import Iterator
from pathlib import Path

from fastapi import Request

from jotter.shared.db import create_sqlite_connection


def get_data_dir(request: Request) -> str:
    """Extracts data_dir from FastAPI app state configuration."""
    return request.app.state.config.data_dir


def get_db_conn(request: Request) -> Iterator[sqlite3.Connection]:
    """Opens a SQLite connection for this request and closes it afterwards.

    A connection is never shared between requests: sync endpoints run on a thread pool, so a thread-local or
    app-wide connection would be used by several requests at once. Opening one is cheap (WAL, schema set up once).
    """
    db_path = getattr(request.app.state, "db_path", None)
    if not db_path:
        db_path = str(Path(get_data_dir(request)) / "tasks.db")
    conn = create_sqlite_connection(db_path)
    try:
        yield conn
    finally:
        conn.close()
