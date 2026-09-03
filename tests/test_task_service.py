from pathlib import Path

from jotter.features.projects.domain import Project
from jotter.features.projects.repo import ProjectRepository
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


def test_task_partial_update_preserves_attributes(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # Create task with color, priority, due date, tags, body
    t = task_svc.create_task(
        "default",
        TaskCreate(
            title="Task with Color",
            bucket="todo",
            color="emerald",
            priority="high",
            due_date="2026-09-15",
            planned_date="2026-09-10",
            tags=["feature"],
            body="- [ ] Checklist item 1\n- [ ] Checklist item 2",
        ),
    )
    assert t.color == "emerald"
    assert t.priority == "high"

    # Simulate ticking a checklist item in markdown (only sending body update)
    updated = task_svc.update_task(
        "default",
        t.id,
        TaskUpdate.model_validate({"body": "- [x] Checklist item 1\n- [ ] Checklist item 2"}),
    )

    # All other attributes must remain intact!
    assert updated.color == "emerald"
    assert updated.priority == "high"
    assert updated.due_date == "2026-09-15"
    assert updated.planned_date == "2026-09-10"
    assert updated.tags == ["feature"]
    assert updated.body == "- [x] Checklist item 1\n- [ ] Checklist item 2"


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

    # FTS5 prefix search (e.g. 'endp' matches 'endpoint')
    prefix_searched = task_svc.get_tasks("default", search="endp")
    assert len(prefix_searched) == 1
    assert prefix_searched[0].title == "Beta API endpoint"

    # FTS5 multi-term and special char search
    multi_searched = task_svc.get_tasks("default", search="alpha feature!@#")
    assert len(multi_searched) == 1
    assert multi_searched[0].title == "Alpha feature"

    # Filter by due_before
    before_sep = task_svc.get_tasks("default", due_before="2026-08-20")
    assert len(before_sep) == 1
    assert before_sep[0].title == "Gamma release notes"


def test_fts5_live_lifecycle_mutations(temp_dir, test_env):
    """Verifies that tasks created, updated, or deleted during runtime immediately sync to FTS5."""
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # 1. Create a task at runtime
    task = task_svc.create_task(
        "default",
        TaskCreate(
            title="Implement quantum teleportation",
            bucket="todo",
            tags=["experimental"],
            body="Researching entanglement synchronization protocols.",
        ),
    )

    # Immediately searchable by title and body tokens
    res_title = task_svc.get_tasks("default", search="teleport")
    assert len(res_title) == 1
    assert res_title[0].id == task.id

    res_body = task_svc.get_tasks("default", search="entanglement")
    assert len(res_body) == 1
    assert res_body[0].id == task.id

    # 2. Update task title and body at runtime
    task_svc.update_task(
        "default",
        task.id,
        TaskUpdate.model_validate(
            {
                "title": "Implement warp drive propulsion",
                "body": "Quantum singularity with antimatter warp core.",
            }
        ),
    )

    # Old tokens should no longer match
    assert len(task_svc.get_tasks("default", search="teleport")) == 0
    assert len(task_svc.get_tasks("default", search="entanglement")) == 0

    # New tokens must match
    res_warp = task_svc.get_tasks("default", search="warp")
    assert len(res_warp) == 1
    assert res_warp[0].title == "Implement warp drive propulsion"

    res_antimatter = task_svc.get_tasks("default", search="antimatter")
    assert len(res_antimatter) == 1

    # 3. Delete task at runtime
    task_svc.delete_task("default", task.id)
    assert len(task_svc.get_tasks("default", search="warp")) == 0
    assert len(task_svc.get_tasks("default", search="antimatter")) == 0


def test_task_move_between_projects(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    proj_repo = ProjectRepository(temp_dir, conn)
    proj_repo.save(Project.create("Init Project", project_id="init"))
    proj_repo.save(Project.create("GGG Project", project_id="ggg"))

    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # 1. Create a task in project "init"
    t1 = task_svc.create_task(
        "init",
        TaskCreate(
            title="Move Me",
            bucket="todo",
            tags=["migration"],
            body="Task to be moved across projects",
        ),
    )
    # Add attachment
    task_svc.add_attachment("init", t1.id, "notes.txt", b"attachment content")

    assert (Path(temp_dir) / "init" / f"{t1.id}.md").is_file()
    assert (Path(temp_dir) / "init" / "attachments" / t1.id / "notes.txt").is_file()

    # 2. Move task to project "ggg"
    updated = task_svc.update_task(
        "init",
        t1.id,
        TaskUpdate.model_validate(
            {
                "project_id": "ggg",
                "bucket": "backlog",
                "position": 1000.0,
            }
        ),
    )

    assert updated.project_id == "ggg"
    assert updated.bucket == "backlog"
    assert updated.attachments == ["notes.txt"]

    # 3. Old files removed, new files present
    assert not (Path(temp_dir) / "init" / f"{t1.id}.md").exists()
    assert not (Path(temp_dir) / "init" / "attachments" / t1.id).exists()
    assert (Path(temp_dir) / "ggg" / f"{t1.id}.md").is_file()
    assert (Path(temp_dir) / "ggg" / "attachments" / t1.id / "notes.txt").is_file()

    # 4. Querying verification
    init_tasks = task_svc.get_tasks("init")
    assert len(init_tasks) == 0

    ggg_tasks = task_svc.get_tasks("ggg")
    assert len(ggg_tasks) == 1
    assert ggg_tasks[0].id == t1.id
    assert ggg_tasks[0].project_id == "ggg"
    assert ggg_tasks[0].bucket == "backlog"
