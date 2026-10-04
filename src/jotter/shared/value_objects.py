"""[DEPRECATED] Domain Value Objects for Tasks.

Moved to `jotter.features.tasks.domain`. These re-exports exist for backwards compatibility.
"""

from jotter.features.tasks.domain import DueDate, Priority, Tag, TaskId

__all__ = ["Priority", "TaskId", "DueDate", "Tag"]
