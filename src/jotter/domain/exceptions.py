"""Domain-level exceptions independent of web or database frameworks."""


class DomainException(Exception):
    """Base exception for all domain logic errors."""
    pass


class EntityNotFoundError(DomainException):
    """Raised when an aggregate root or entity cannot be found."""
    pass


class ValidationError(DomainException):
    """Raised when domain invariants or value objects fail validation."""
    pass


class TaskOperationError(DomainException):
    """Raised when an operation on a task violates domain rules."""
    pass
