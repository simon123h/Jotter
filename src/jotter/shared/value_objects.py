"""Domain Value Objects."""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from enum import Enum
from typing import Self

from jotter.shared.exceptions import ValidationError
from jotter.shared.ulid import generate_ulid


class Priority(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

    @classmethod
    def from_str(cls, val: str | None) -> Self:
        if not val:
            return cls.NONE
        clean = str(val).strip().lower()
        for p in cls:
            if p.value == clean:
                return p
        return cls.NONE


@dataclass(frozen=True)
class TaskId:
    value: str

    def __post_init__(self):
        if not self.value or len(self.value.strip()) == 0:
            raise ValidationError("TaskId cannot be empty")

    @classmethod
    def generate(cls) -> Self:
        return cls(value=generate_ulid())

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class DueDate:
    value: str | None  # "YYYY-MM-DD" or natural strings like "today", "someday", etc.

    @property
    def as_date(self) -> date | None:
        if not self.value:
            return None
        try:
            return datetime.strptime(self.value.strip(), "%Y-%m-%d").date()
        except ValueError:
            return None

    def is_overdue(self, reference_date: date | None = None) -> bool:
        d = self.as_date
        if not d:
            return False
        ref = reference_date or datetime.now(timezone.utc).date()
        return d < ref

    def is_today(self, reference_date: date | None = None) -> bool:
        if not self.value:
            return False
        if self.value.strip().lower() == "today":
            return True
        d = self.as_date
        if not d:
            return False
        ref = reference_date or datetime.now(timezone.utc).date()
        return d == ref

    def __str__(self) -> str:
        return self.value or ""


@dataclass(frozen=True)
class Tag:
    value: str

    def __post_init__(self):
        clean = self.value.strip().lower()
        if not clean:
            raise ValidationError("Tag cannot be empty")
        # Ensure immutable clean string
        object.__setattr__(self, "value", clean)

    def __str__(self) -> str:
        return self.value
