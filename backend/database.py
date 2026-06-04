import os
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from yoyo import get_backend, read_migrations
import yoyo.backends.sqlite  # Explicit import for PyInstaller discovery

from config import IS_PRODUCTION, get_data_dir

data_dir = get_data_dir()
if data_dir:
    DB_PATH = os.path.abspath(os.path.join(data_dir, "tasks.db"))
elif IS_PRODUCTION:
    DB_PATH = os.path.abspath(os.path.join(os.getcwd(), "tasks/tasks.db"))
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks/tasks.db")

_last_db_path = None
_engine = None
_SessionLocal = None


def get_session():
    global _last_db_path, _engine, _SessionLocal
    if _engine is None or _last_db_path != DB_PATH:
        _last_db_path = DB_PATH
        db_url = f"sqlite:///{DB_PATH}"
        _engine = create_engine(db_url, connect_args={"check_same_thread": False}, poolclass=NullPool)

        @event.listens_for(_engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=_engine,
            expire_on_commit=False,
        )
    return _SessionLocal()


def dispose_engine():
    global _engine, _SessionLocal, _last_db_path
    if _engine is not None:
        _engine.dispose()
        _engine = None
        _SessionLocal = None
        _last_db_path = None


def run_migrations():
    """Applies database migrations using Yoyo."""
    db_uri = f"sqlite:///{DB_PATH}"
    migrations_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
    backend = get_backend(db_uri)
    migrations = read_migrations(migrations_dir)
    try:
        with backend.lock():
            backend.apply_migrations(backend.to_apply(migrations))
    finally:
        if hasattr(backend, "connection") and backend.connection:
            backend.connection.close()


def init_db():
    """Initializes the database tables with the correct multi-project schema using migrations."""
    # Apply yoyo migrations
    run_migrations()


@contextmanager
def db_session():
    """Context manager for cleaner session handling in APIs."""
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
