from jotter.models.task import (
    TaskCreate,
    TaskFrontmatter,
    TaskMove,
    TaskUpdate,
)
from jotter.services.task_service import (
    create_task,
    delete_task,
    dump_frontmatter,
    get_tasks,
    move_task,
    parse_frontmatter,
    update_task,
)


def test_frontmatter_parse_and_dump():
    original_body = "## Checklists\n- [x] Item 1\n- [ ] Item 2\n"
    fm = TaskFrontmatter(
        id="01HXYZ00000000000000000001",
        project_id="work",
        title="Complex Frontmatter Task",
        bucket="in-progress",
        position=1500.0,
        tags=["backend", "pydantic"],
        due_date="2026-09-01",
        planned_date="2026-08-30",
        priority="high",
        color="#3b82f6",
        postponed_until="2026-08-29",
        created_at="2026-08-27T20:00:00Z",
        updated_at="2026-08-27T20:00:00Z",
    )

    dumped = dump_frontmatter(fm, original_body)
    assert "---" in dumped
    assert "Complex Frontmatter Task" in dumped

    parsed_fm, parsed_body = parse_frontmatter(dumped)
    assert parsed_fm.id == fm.id
    assert parsed_fm.title == fm.title
    assert parsed_fm.priority == "high"
    assert parsed_fm.tags == ["backend", "pydantic"]
    assert parsed_body.strip() == original_body.strip()


def test_task_crud_and_positioning(temp_dir):
    t1 = create_task(temp_dir, "default", TaskCreate(title="Task 1", bucket="todo"))
    t2 = create_task(temp_dir, "default", TaskCreate(title="Task 2", bucket="todo"))

    assert t2.position > t1.position

    # Update task
    updated = update_task(
        temp_dir,
        "default",
        t1.id,
        TaskUpdate(title="Task 1 Updated", priority="urgent", body="New body details"),
    )
    assert updated.title == "Task 1 Updated"
    assert updated.priority == "urgent"
    assert updated.body == "New body details"

    # Move task
    moved = move_task(temp_dir, "default", t1.id, TaskMove(bucket="done", position=500.0))
    assert moved.bucket == "done"
    assert moved.position == 500.0

    # Delete task
    delete_task(temp_dir, "default", t1.id)
    tasks = get_tasks("default")
    assert not any(t.id == t1.id for t in tasks)


def test_task_search_and_filtering(temp_dir):
    create_task(
        temp_dir,
        "default",
        TaskCreate(
            title="Deploy release to production",
            bucket="todo",
            tags=["ops", "release"],
            body="Follow production checklist",
            due_date="2026-09-01",
        ),
    )
    create_task(
        temp_dir,
        "default",
        TaskCreate(
            title="Write documentation",
            bucket="backlog",
            tags=["docs"],
            body="Update arc42 documentation",
            due_date=None,
        ),
    )

    # Search in title
    res_title = get_tasks("default", search="production")
    assert len(res_title) == 1
    assert "Deploy" in res_title[0].title

    # Search in body
    res_body = get_tasks("default", search="arc42")
    assert len(res_body) == 1
    assert "Write documentation" in res_body[0].title

    # Filter has_due_date
    with_due = get_tasks("default", has_due_date=True)
    assert len(with_due) == 1
    assert with_due[0].due_date == "2026-09-01"

    without_due = get_tasks("default", has_due_date=False)
    assert len(without_due) == 1
    assert without_due[0].due_date is None
