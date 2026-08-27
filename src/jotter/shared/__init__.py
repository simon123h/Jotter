"""Shared domain primitives, database lifecycle, and utilities."""

from jotter.shared.db import close_db, get_db
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
    "DomainException",
    "EntityNotFoundError",
    "ValidationError",
    "TaskOperationError",
    "Priority",
    "TaskId",
    "DueDate",
    "Tag",
    "get_db",
    "close_db",
    "slugify",
    "generate_ulid",
]
