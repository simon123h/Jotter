from io import BytesIO
from pathlib import Path


def test_projects_crud(test_env):
    client, temp_dir = test_env

    # 1. List default projects
    res = client.get("/api/projects")
    assert res.status_code == 200
    projects = res.json()
    assert len(projects) == 1
    assert projects[0]["id"] == "default"

    # 2. Create new project
    res = client.post("/api/projects", json={"title": "Work Tasks"})
    assert res.status_code == 201
    new_proj = res.json()
    assert new_proj["id"] == "work-tasks"
    assert new_proj["title"] == "Work Tasks"

    # 3. Update project
    res = client.put("/api/projects/work-tasks", json={"title": "Work & Office"})
    assert res.status_code == 200
    assert res.json()["title"] == "Work & Office"

    # 4. Delete project
    res = client.delete("/api/projects/work-tasks")
    assert res.status_code == 204

    # 5. Verify deleted
    res = client.get("/api/projects")
    assert len(res.json()) == 1


def test_buckets_and_tasks_workflow(test_env):
    client, temp_dir = test_env

    # 1. Check default buckets in default project
    res = client.get("/api/projects/default/buckets")
    assert res.status_code == 200
    buckets = res.json()
    assert len(buckets) == 5
    bucket_names = [b["name"] for b in buckets]
    assert "backlog" in bucket_names
    assert "todo" in bucket_names

    # 2. Create custom bucket
    res = client.post("/api/projects/default/buckets", json={"title": "Testing", "color": "#10b981"})
    assert res.status_code == 201
    assert res.json()["name"] == "testing"

    # 3. Create task
    task_payload = {
        "title": "Build Python Backend",
        "bucket": "todo",
        "tags": ["backend", "python"],
        "body": "Full rewrite in FastAPI with markdown storage.",
        "priority": "high",
        "due_date": "2026-09-01",
    }
    res = client.post("/api/projects/default/tasks", json=task_payload)
    assert res.status_code == 201
    task = res.json()
    task_id = task["id"]
    assert task["title"] == "Build Python Backend"
    assert task["bucket"] == "todo"
    assert "backend" in task["tags"]
    assert task["priority"] == "high"

    # 4. Verify markdown file was written to disk
    md_file = Path(temp_dir) / "default" / f"{task_id}.md"
    assert md_file.is_file()
    content = md_file.read_text(encoding="utf-8")
    assert "---" in content
    assert "title: Build Python Backend" in content
    assert "Full rewrite in FastAPI with markdown storage." in content

    # 5. Filter tasks
    res = client.get("/api/projects/default/tasks", params={"tag": "backend"})
    assert res.status_code == 200
    tasks = res.json()
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id

    # 6. Move task
    res = client.patch(
        f"/api/projects/default/tasks/{task_id}/move", json={"bucket": "in-progress", "position": 1500.0}
    )
    assert res.status_code == 200
    assert res.json()["bucket"] == "in-progress"

    # 7. Global tasks endpoint
    res = client.get("/api/tasks")
    assert res.status_code == 200
    assert len(res.json()) == 1

    # 8. Delete task
    res = client.delete(f"/api/projects/default/tasks/{task_id}")
    assert res.status_code == 204
    assert not md_file.is_file()


def test_task_filters_and_queries(test_env):
    client, _ = test_env

    # Seed 3 tasks
    t1 = client.post(
        "/api/projects/default/tasks",
        json={
            "title": "Task One",
            "bucket": "todo",
            "tags": ["frontend", "urgent"],
            "priority": "urgent",
            "due_date": "2026-06-01",
            "planned_date": "today",
        },
    ).json()
    t2 = client.post(
        "/api/projects/default/tasks",
        json={
            "title": "Task Two",
            "bucket": "in-progress",
            "tags": ["backend", "urgent"],
            "priority": "low",
            "due_date": "2026-06-15",
        },
    ).json()
    t3 = client.post(
        "/api/projects/default/tasks",
        json={"title": "Task Three", "bucket": "done", "tags": ["frontend"], "postponed_until": "2099-01-01"},
    ).json()

    # Filter by multiple tags (AND mode)
    res = client.get("/api/projects/default/tasks", params={"tags": "frontend,urgent", "tag_mode": "all"})
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == t1["id"]

    # Filter by multiple tags (OR mode)
    res = client.get("/api/projects/default/tasks", params={"tags": "frontend,backend", "tag_mode": "any"})
    assert len(res.json()) == 3
    found_ids = {t["id"] for t in res.json()}
    assert t1["id"] in found_ids
    assert t2["id"] in found_ids
    assert t3["id"] in found_ids

    # Filter by priority
    res = client.get("/api/projects/default/tasks", params={"priorities": "urgent,low"})
    assert len(res.json()) == 2

    # Filter by dates
    res = client.get("/api/projects/default/tasks", params={"due_before": "2026-06-05"})
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == t1["id"]

    # Search keyword
    res = client.get("/api/projects/default/tasks", params={"search": "Three"})
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == t3["id"]

    # Postponed bucket check
    res = client.get("/api/projects/default/tasks", params={"bucket": "postponed"})
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == t3["id"]


def test_attachments_workflow(test_env):
    client, _ = test_env

    t = client.post("/api/projects/default/tasks", json={"title": "Attachment Task", "bucket": "todo"}).json()
    task_id = t["id"]

    # Upload attachment
    file_content = b"Mock image file content"
    files = {"file": ("screenshot.png", BytesIO(file_content), "image/png")}
    res = client.post(f"/api/projects/default/tasks/{task_id}/attachments", files=files)
    assert res.status_code == 200
    assert "screenshot.png" in res.json()["attachments"]

    # Retrieve attachment
    res = client.get(f"/api/projects/default/tasks/{task_id}/attachments/screenshot.png")
    assert res.status_code == 200
    assert res.content == file_content

    # Delete attachment
    res = client.delete(f"/api/projects/default/tasks/{task_id}/attachments/screenshot.png")
    assert res.status_code == 200
    assert "screenshot.png" not in res.json()["attachments"]


def test_settings_endpoint(test_env):
    client, _ = test_env

    res = client.get("/api/settings")
    assert res.status_code == 200
    settings = res.json()
    assert settings["currentTheme"] == "nordic-light"

    # Update settings
    settings["currentTheme"] = "dark"
    settings["language"] = "de"
    res = client.post("/api/settings", json=settings)
    assert res.status_code == 200

    res = client.get("/api/settings")
    assert res.json()["currentTheme"] == "dark"
    assert res.json()["language"] == "de"


def test_system_sync_and_info(test_env):
    client, temp_dir = test_env

    res = client.get("/api/system/info")
    assert res.status_code == 200
    assert res.json()["data_dir"] == temp_dir

    res = client.post("/api/system/sync")
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_null_tags_and_attachments_handling(test_env):
    client, temp_dir = test_env

    # Write a task file on disk with explicit null tags and null attachments
    task_file = Path(temp_dir) / "default" / "01HXYZ1234567890ABCDEF001.md"
    task_file.parent.mkdir(parents=True, exist_ok=True)
    task_file.write_text(
        """---
id: 01HXYZ1234567890ABCDEF001
project_id: default
title: Task with null lists
bucket: todo
position: 1000.0
tags: null
attachments: null
created_at: '2026-08-27T20:00:00Z'
updated_at: '2026-08-27T20:00:00Z'
---
Sample body
""",
        encoding="utf-8",
    )

    # Sync and query tasks
    res = client.post("/api/system/sync")
    assert res.status_code == 200

    res = client.get("/api/projects/default/tasks")
    assert res.status_code == 200
    tasks = res.json()
    assert len(tasks) == 1
    assert tasks[0]["tags"] == []
    assert tasks[0]["attachments"] == []

    # Get single task
    res = client.get("/api/projects/default/tasks/01HXYZ1234567890ABCDEF001")
    assert res.status_code == 200
    assert res.json()["tags"] == []
    assert res.json()["attachments"] == []


def test_api_error_responses(test_env):
    client, _ = test_env

    # 1. Non-existent project
    res = client.get("/api/projects/non-existent-proj/tasks")
    assert res.status_code == 200  # returns empty list

    # 2. Non-existent task 404
    res = client.get("/api/projects/default/tasks/non-existent-task-id")
    assert res.status_code == 404

    # 3. Non-existent task update 404
    res = client.patch("/api/projects/default/tasks/non-existent-task-id", json={"title": "New Title"})
    assert res.status_code == 404

    # 4. Non-existent task move 404
    res = client.patch(
        "/api/projects/default/tasks/non-existent-task-id/move", json={"bucket": "done", "position": 1.0}
    )
    assert res.status_code == 404

    # 5. Non-existent task attachment download 404
    res = client.get("/api/projects/default/tasks/non-existent-task-id/attachments/file.png")
    assert res.status_code == 404

    # 6. Bucket creation invalid name conflict / bad update 404
    res = client.put("/api/projects/default/buckets/non-existent-col", json={"title": "Test Title"})
    assert res.status_code == 404

    # 7. Project restore missing hash 400
    res = client.post("/api/system/restore", json={"commitHash": ""})
    assert res.status_code == 400
