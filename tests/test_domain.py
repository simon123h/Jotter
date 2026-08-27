from datetime import date

import pytest

from jotter.domain.bucket import Bucket
from jotter.domain.exceptions import ValidationError
from jotter.domain.project import Project
from jotter.domain.task import Task
from jotter.domain.value_objects import DueDate, Priority, Tag, TaskId


def test_priority_value_object():
    assert Priority.from_str("urgent") == Priority.URGENT
    assert Priority.from_str("HIGH") == Priority.HIGH
    assert Priority.from_str("invalid") == Priority.NONE
    assert Priority.from_str(None) == Priority.NONE


def test_task_id_value_object():
    tid = TaskId.generate()
    assert len(tid.value) == 26
    assert str(tid) == tid.value

    with pytest.raises(ValidationError):
        TaskId(value="")


def test_due_date_value_object():
    d = DueDate("2026-08-30")
    assert d.as_date == date(2026, 8, 30)
    assert not d.is_overdue(reference_date=date(2026, 8, 28))
    assert d.is_overdue(reference_date=date(2026, 9, 1))
    assert d.is_today(reference_date=date(2026, 8, 30))

    d_today = DueDate("today")
    assert d_today.is_today()
    assert d_today.as_date is None


def test_tag_value_object():
    t = Tag(" Backend ")
    assert t.value == "backend"

    with pytest.raises(ValidationError):
        Tag("   ")


def test_task_aggregate_creation_and_mutations():
    task = Task.create(
        project_id="default",
        title="Implement DDD",
        bucket="todo",
        tags=["architecture", "python"],
        due_date="2026-09-01",
        priority="high",
    )

    assert task.title == "Implement DDD"
    assert task.priority == Priority.HIGH
    assert len(task.tags) == 2
    assert task.bucket == "todo"

    # Move
    task.move("in-progress", 2500.0)
    assert task.bucket == "in-progress"
    assert task.position == 2500.0

    # Postpone
    task.postpone("2026-09-05")
    assert task.postponed_until.value == "2026-09-05"

    task.unpostpone()
    assert task.postponed_until.value is None

    # Attachments
    task.add_attachment("spec.pdf")
    assert "spec.pdf" in task.attachments
    task.remove_attachment("spec.pdf")
    assert "spec.pdf" not in task.attachments

    # Validation on empty title
    with pytest.raises(ValidationError):
        task.update_details(title="  ")


def test_bucket_entity():
    b = Bucket.create(title="Review & QA", color="#9333ea")
    assert b.name == "review-qa"
    assert b.title == "Review & QA"
    assert b.color == "#9333ea"

    b.update_details(title="Quality Assurance", color="#7c3aed")
    assert b.title == "Quality Assurance"
    assert b.color == "#7c3aed"


def test_project_entity():
    p = Project.create(name="Mobile App", description="iOS & Android codebase")
    assert p.id == "mobile-app"
    assert p.name == "Mobile App"
    assert p.description == "iOS & Android codebase"
