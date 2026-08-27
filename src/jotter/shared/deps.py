"""FastAPI core technical dependencies."""

import sqlite3
from pathlib import Path

from fastapi import Request

from jotter.shared.db import get_db as get_global_db


def get_data_dir(request: Request) -> str:
    """Extracts data_dir from FastAPI app state configuration."""
    return request.app.state.config.data_dir


def get_db_conn(request: Request) -> sqlite3.Connection:
    """Extracts SQLite connection from app state or global fallback."""
    if hasattr(request.app.state, "db") and request.app.state.db is not None:
        return request.app.state.db
    db_path = Path(get_data_dir(request)) / "tasks.db"
    return get_global_db(str(db_path))
