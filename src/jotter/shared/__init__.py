"""Shared domain primitives and technical foundations."""

from jotter.shared.db import close_db, get_db
from jotter.shared.deps import get_data_dir
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
    "get_db",
    "close_db",
    "get_data_dir",
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
