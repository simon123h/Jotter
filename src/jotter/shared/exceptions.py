"""Domain and application exceptions for Jotter."""


class DomainException(Exception):
    """Base exception for all domain business rule violations."""

    pass


class EntityNotFoundError(DomainException):
    """Raised when an aggregate root or entity cannot be found."""

    pass


class ValidationError(DomainException):
    """Raised when invariant or value object validation fails."""

    pass


class TaskOperationError(DomainException):
    """Raised when an illegal task transition occurs."""

    pass
