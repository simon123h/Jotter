from pathlib import Path

from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.features.tasks.schemas import (
    TaskCreate,
    TaskMove,
    TaskUpdate,
)
from jotter.features.tasks.service import TaskApplicationService
from jotter.shared.db import get_db


def test_frontmatter_parse_and_dump():
    disk_repo = DiskTaskRepository("")
    raw_markdown = """---
id: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
projectId: "default"
title: "Sample Task"
bucket: "todo"
position: 1500.0
tags:
  - backend
  - python
priority: "high"
due_date: "2026-08-30"
---

# Task Description
Here are details.
"""
    task = disk_repo.parse_task_content(
        raw_markdown, fallback_id="01ARZ3NDEKTSV4RRFFQ69G5FAV", default_project_id="default"
    )
    assert str(task.id) == "01ARZ3NDEKTSV4RRFFQ69G5FAV"
    assert task.title == "Sample Task"
    assert task.bucket == "todo"
    assert len(task.tags) == 2
    assert task.body.strip() == "# Task Description\nHere are details."

    # Round trip serialize
    dumped = disk_repo.serialize_task(task)
    assert "Sample Task" in dumped
    assert "# Task Description" in dumped

    # Minimal task without tags or attachments
    minimal_task = disk_repo.parse_task_content("title: Minimal Task", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "default")
    minimal_dump = disk_repo.serialize_task(minimal_task)
    assert "tags:" not in minimal_dump
    assert "attachments:" not in minimal_dump
    assert "priority:" not in minimal_dump
    assert "due_date:" not in minimal_dump


def test_task_crud_and_positioning(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # Create task
    t1 = task_svc.create_task(
        "default",
        TaskCreate(
            title="First Task",
            bucket="todo",
            tags=["urgent"],
            body="First task body",
            priority="urgent",
            due_date="2026-08-31",
        ),
    )
    assert t1.title == "First Task"
    assert t1.position == 1000.0

    # Create second task
    t2 = task_svc.create_task("default", TaskCreate(title="Second Task", bucket="todo"))
    assert t2.position == 2000.0

    # Update task
    up_t1 = task_svc.update_task("default", t1.id, TaskUpdate(title="First Task (Updated)", priority="low"))
    assert up_t1.title == "First Task (Updated)"
    assert up_t1.priority == "low"

    # Move task
    mv_t1 = task_svc.move_task("default", t1.id, TaskMove(bucket="done", position=500.0))
    assert mv_t1.bucket == "done"
    assert mv_t1.position == 500.0

    # Delete task
    task_svc.delete_task("default", t2.id)
    assert len(task_svc.get_tasks("default")) == 1


def test_task_search_and_filtering(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    task_svc.create_task(
        "default",
        TaskCreate(
            title="Alpha feature", bucket="todo", tags=["frontend", "release"], priority="high", due_date="2026-09-01"
        ),
    )
    task_svc.create_task(
        "default",
        TaskCreate(
            title="Beta API endpoint", bucket="in-progress", tags=["backend"], priority="low", due_date="2026-09-10"
        ),
    )
    task_svc.create_task(
        "default",
        TaskCreate(
            title="Gamma release notes", bucket="done", tags=["release"], priority="none", due_date="2026-08-15"
        ),
    )

    # Filter by bucket
    todos = task_svc.get_tasks("default", bucket="todo")
    assert len(todos) == 1
    assert todos[0].title == "Alpha feature"

    # Filter by tag
    releases = task_svc.get_tasks("default", tag="release")
    assert len(releases) == 2

    # Filter by search
    searched = task_svc.get_tasks("default", search="Beta")
    assert len(searched) == 1
    assert searched[0].title == "Beta API endpoint"

    # Filter by due_before
    before_sep = task_svc.get_tasks("default", due_before="2026-08-20")
    assert len(before_sep) == 1
    assert before_sep[0].title == "Gamma release notes"
