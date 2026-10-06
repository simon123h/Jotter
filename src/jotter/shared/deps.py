"""FastAPI core technical dependencies."""

import sqlite3
from collections.abc import Iterator

from fastapi import Request


def get_data_dir(request: Request) -> str:
    """Extracts data_dir from FastAPI app state configuration."""
    return str(request.app.state.config.data_dir)


def get_db_conn(request: Request) -> Iterator[sqlite3.Connection]:
    """Borrows a SQLite connection from the pool for this request and returns it afterwards.

    A connection is never used by two requests at once: sync endpoints run on a thread pool, so one shared or
    thread-local connection would be.
    """
    with request.app.state.db_pool.connection() as conn:
        yield conn
