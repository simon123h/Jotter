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
    "create_sqlite_connection",
    "DomainException",
    "EntityNotFoundError",
    "ValidationError",
    "TaskOperationError",
    "slugify",
    "generate_ulid",
]
