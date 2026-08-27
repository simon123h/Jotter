"""Domain exceptions facade."""

from jotter.shared.exceptions import (
    DomainException,
    EntityNotFoundError,
    TaskOperationError,
    ValidationError,
)

__all__ = [
    "DomainException",
    "EntityNotFoundError",
    "ValidationError",
    "TaskOperationError",
]
