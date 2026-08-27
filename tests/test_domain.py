import pytest

from jotter.features.buckets.domain import Bucket
from jotter.features.projects.domain import Project
from jotter.features.tasks.domain import Task
from jotter.shared.exceptions import ValidationError
from jotter.shared.value_objects import DueDate, Priority, Tag, TaskId


def test_priority_value_object():
    p1 = Priority.from_str("urgent")
    assert p1 == Priority.URGENT
    assert str(p1) == "urgent"

    p2 = Priority.from_str("High")
    assert p2 == Priority.HIGH

    p_none = Priority.from_str(None)
    assert p_none == Priority.NONE

    with pytest.raises(ValidationError):
        Priority.from_str("super-critical")


def test_task_id_value_object():
    tid = TaskId.create()
    assert len(tid.value) == 26

    parsed = TaskId.from_str("01ARZ3NDEKTSV4RRFFQ69G5FAV")
    assert parsed.value == "01ARZ3NDEKTSV4RRFFQ69G5FAV"

    with pytest.raises(ValidationError):
        TaskId.from_str("")


def test_due_date_value_object():
    d1 = DueDate.from_str("2026-08-30")
    assert d1.value == "2026-08-30"

    d_none = DueDate.from_str(None)
    assert d_none.value is None

    with pytest.raises(ValidationError):
        DueDate.from_str("invalid-date-format")


def test_tag_value_object():
    t1 = Tag.from_str("#backend")
    assert t1.value == "backend"

    t2 = Tag.from_str("  frontend  ")
    assert t2.value == "frontend"

    with pytest.raises(ValidationError):
        Tag.from_str("invalid tag with spaces")


def test_task_aggregate_creation_and_mutations():
    task = Task.create(
        project_id="default",
        title="Implement DDD refactoring",
        bucket="in-progress",
        tags=["refactor", "ddd"],
        priority="high",
        due_date="2026-09-01",
    )

    assert task.project_id == "default"
    assert task.title == "Implement DDD refactoring"
    assert task.bucket == "in-progress"
    assert len(task.tags) == 2
    assert task.priority == Priority.HIGH
    assert task.due_date.value == "2026-09-01"

    # Invariant: Move task
    task.move(new_bucket="done", new_position=2500.0)
    assert task.bucket == "done"
    assert task.position == 2500.0

    # Invariant: Postpone
    task.postpone(until="2026-09-10")
    assert task.postponed_until.value == "2026-09-10"

    # Invariant: Attachments
    task.add_attachment("architecture.png")
    assert "architecture.png" in task.attachments
    task.remove_attachment("architecture.png")
    assert "architecture.png" not in task.attachments


def test_bucket_entity():
    bucket = Bucket.create(
        title="Code Review",
        color="#ff8800",
        layout="list",
        max_tasks=5,
    )
    assert bucket.name == "code-review"
    assert bucket.title == "Code Review"
    assert bucket.color == "#ff8800"
    assert bucket.max_tasks == 5

    bucket.update_details(title="Peer Review", max_tasks=10)
    assert bucket.title == "Peer Review"
    assert bucket.max_tasks == 10


def test_project_entity():
    p = Project.create(name="Mobile App", description="iOS & Android codebase")
    assert p.id == "mobile-app"
    assert p.name == "Mobile App"

    p.update_details(name="Mobile App (Native)")
    assert p.name == "Mobile App (Native)"
