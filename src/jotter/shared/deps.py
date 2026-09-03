"""FastAPI core technical dependencies."""

import sqlite3
from pathlib import Path

from fastapi import Request

from jotter.shared.db import get_db as get_global_db


def get_data_dir(request: Request) -> str:
    """Extracts data_dir from FastAPI app state configuration."""
    return request.app.state.config.data_dir


def get_db_conn(request: Request) -> sqlite3.Connection:
    """Extracts thread-local SQLite connection for the request's data directory."""
    db_path = getattr(request.app.state, "db_path", None)
    if not db_path:
        db_path = str(Path(get_data_dir(request)) / "tasks.db")
    return get_global_db(db_path)
