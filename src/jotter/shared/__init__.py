"""Shared domain primitives and technical foundations."""

from jotter.shared.db import create_sqlite_connection
from jotter.shared.exceptions import (
    DomainException,
    EntityNotFoundError,
    TaskOperationError,
    ValidationError,
)
from jotter.shared.slug import slugify
from jotter.shared.ulid import generate_ulid

__all__ = [
    "DomainException",
    "EntityNotFoundError",
    "TaskOperationError",
    "ValidationError",
    "create_sqlite_connection",
    "generate_ulid",
    "slugify",
]
