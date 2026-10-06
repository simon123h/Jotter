"""Sentinel for optional arguments where ``None`` is a meaningful value (e.g. "clear this field")."""

from enum import Enum
from typing import Literal


class _UnsetType(Enum):
    UNSET = "UNSET"


UNSET = _UnsetType.UNSET
Unset = Literal[_UnsetType.UNSET]
