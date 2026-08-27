"""Shared domain primitives and technical foundations."""

from jotter.shared.db import close_db, create_sqlite_connection, get_db
from jotter.shared.exceptions import (
    DomainException,
    EntityNotFoundError,
    TaskOperationError,
    ValidationError,
)
from jotter.shared.slug import slugify
from jotter.shared.ulid import generate_ulid
from jotter.shared.value_objects import DueDate, Priority, Tag, TaskId

__all__ = [
    "create_sqlite_connection",
    "get_db",
    "close_db",
    "DomainException",
    "EntityNotFoundError",
    "ValidationError",
    "TaskOperationError",
    "Priority",
    "TaskId",
    "DueDate",
    "Tag",
    "slugify",
    "generate_ulid",
]
