import os
import shutil

import pytest
from fastapi.testclient import TestClient

# Override paths before importing backend modules to ensure testing isolation
import database as db
import storage as storage

TEST_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_data")
db.DB_PATH = os.path.join(TEST_DATA_DIR, "test_tasks.db")
storage.TASKS_DIR = os.path.join(TEST_DATA_DIR, "tasks")
storage.BUCKETS_FILE = os.path.join(storage.TASKS_DIR, "default", "buckets.json")
storage.PROJECTS_FILE = os.path.join(storage.TASKS_DIR, "projects.json")

# Now import app and endpoints
from main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_and_teardown():
    # Setup test folder structure
    os.makedirs(os.path.join(storage.TASKS_DIR, "default"), exist_ok=True)
    db.init_db()
    storage.sync_db_with_files()

    yield

    # Teardown: delete the entire test data folder
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR)


def test_projects_flow():
    # 1. List projects (should initially contain default project)
    response = client.get("/projects")
    assert response.status_code == 200
    projects = response.json()
    assert len(projects) == 1
    assert projects[0]["id"] == "default"

    # Try to delete default project when it is the last remaining project - should fail
    response = client.delete("/projects/default")
    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot delete the last remaining project."

    # 2. Create project
    response = client.post("/projects", json={"title": "Project Alpha"})
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "project-alpha"
    assert data["title"] == "Project Alpha"

    # Verify lists
    response = client.get("/projects")
    assert len(response.json()) == 2

    # 3. Update project title
    response = client.put("/projects/default", json={"title": "Default Project Renamed"})
    assert response.status_code == 200
    assert response.json()["title"] == "Default Project Renamed"

    # 4. Delete default project (should succeed because project-alpha exists)
    response = client.delete("/projects/default")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify default is gone, only project-alpha remains
    response = client.get("/projects")
    projects = response.json()
    assert len(projects) == 1
    assert projects[0]["id"] == "project-alpha"

    # Try to delete project-alpha when it is the last remaining project - should fail
    response = client.delete("/projects/project-alpha")
    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot delete the last remaining project."


def test_crud_flow():
    # 1. List tasks (should be empty)
    response = client.get("/projects/default/tasks")
    assert response.status_code == 200
    assert response.json() == []

    # 2. Create task
    task_payload = {
        "title": "Test Task 1",
        "bucket": "todo",
        "tags": ["test", "feature"],
        "body": "# Markdown Content\nWith a list:\n- Sub 1\n- Sub 2",
        "due_date": "2026-06-15",
        "priority": "high",
    }
    response = client.post("/projects/default/tasks", json=task_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1
    assert data["project_id"] == "default"
    assert data["title"] == "Test Task 1"
    assert data["bucket"] == "todo"
    assert data["tags"] == ["test", "feature"]
    assert data["due_date"] == "2026-06-15"
    assert data["priority"] == "high"

    # Verify file was created in test default project directory
    expected_filename = "000001-test-task-1.md"
    assert os.path.exists(os.path.join(storage.TASKS_DIR, "default", expected_filename))

    # 3. Read specific task (should include body)
    response = client.get(f"/projects/default/tasks/{data['id']}")
    assert response.status_code == 200
    task_detail = response.json()
    assert task_detail["body"] == task_payload["body"]
    assert task_detail["due_date"] == "2026-06-15"
    assert task_detail["priority"] == "high"

    # 4. Update task (title change -> filename should change)
    update_payload = {
        "title": "Test Task 1 Updated",
        "body": "Updated markdown content",
        "due_date": "2026-06-20",
        "priority": "urgent",
    }
    response = client.put(f"/projects/default/tasks/{data['id']}", json=update_payload)
    assert response.status_code == 200
    updated_data = response.json()
    assert updated_data["title"] == "Test Task 1 Updated"
    assert updated_data["body"] == "Updated markdown content"
    assert updated_data["due_date"] == "2026-06-20"
    assert updated_data["priority"] == "urgent"

    # Verify old file was deleted and new file was created
    assert not os.path.exists(os.path.join(storage.TASKS_DIR, "default", expected_filename))
    new_expected_filename = "000001-test-task-1-updated.md"
    assert os.path.exists(os.path.join(storage.TASKS_DIR, "default", new_expected_filename))

    # 5. Move task (change bucket and position)
    move_payload = {"bucket": "in-progress", "position": 500.0}
    response = client.patch(f"/projects/default/tasks/{data['id']}/move", json=move_payload)
    assert response.status_code == 200
    moved_data = response.json()
    assert moved_data["bucket"] == "in-progress"
    assert moved_data["position"] == 500.0

    # 6. Test sync system (reconstruct DB)
    os.remove(db.DB_PATH)
    db.init_db()  # Recreate empty DB

    # DB is now empty, GET /tasks should return 404 since project doesn't exist
    response = client.get("/projects/default/tasks")
    assert response.status_code == 404

    # Call system/sync to reconstruct DB from the markdown files
    response = client.post("/system/sync")
    assert response.status_code == 200
    assert response.json()["synchronized_tasks"] == 1

    # Verify task is back in database list
    response = client.get("/projects/default/tasks")
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Test Task 1 Updated"

    # 7. Delete task
    response = client.delete(f"/projects/default/tasks/{data['id']}")
    assert response.status_code == 200
    assert not os.path.exists(os.path.join(storage.TASKS_DIR, "default", new_expected_filename))

    # Check it's gone from database listing
    response = client.get("/projects/default/tasks")
    assert response.json() == []


def test_buckets_flow():
    # 1. List buckets (should contain the 4 default buckets)
    response = client.get("/projects/default/buckets")
    assert response.status_code == 200
    buckets = response.json()
    assert len(buckets) == 4
    assert buckets[0]["name"] == "backlog"
    assert buckets[0]["subtitle"] == ""
    assert buckets[1]["name"] == "todo"
    assert buckets[2]["name"] == "in-progress"
    assert buckets[3]["name"] == "done"

    # 2. Create bucket with subtitle
    response = client.post("/projects/default/buckets", json={"title": "QA Test", "subtitle": "Quality assurance tasks"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "qa-test"
    assert data["title"] == "QA Test"
    assert data["subtitle"] == "Quality assurance tasks"
    assert data["position"] == 5000.0

    # Verify buckets.json was updated
    assert os.path.exists(storage.BUCKETS_FILE)
    buckets_list = storage.load_buckets_file("default")
    assert len(buckets_list) == 5
    assert buckets_list[-1]["name"] == "qa-test"
    assert buckets_list[-1]["subtitle"] == "Quality assurance tasks"

    # 3. Update bucket title and subtitle
    response = client.put("/projects/default/buckets/qa-test", json={"title": "Quality Assurance", "subtitle": "QA & Testing"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "qa-test"
    assert data["title"] == "Quality Assurance"
    assert data["subtitle"] == "QA & Testing"

    # 4. Try deleting a bucket that has tasks
    # Create a task in "qa-test"
    task_payload = {
        "title": "Task in QA",
        "bucket": "qa-test",
        "tags": [],
        "body": "Test body",
    }
    task_response = client.post("/projects/default/tasks", json=task_payload)
    assert task_response.status_code == 201
    task_data = task_response.json()

    # Try to delete "qa-test" - should fail
    response = client.delete("/projects/default/buckets/qa-test")
    assert response.status_code == 400
    assert "contains" in response.json()["detail"]

    # Delete the task
    client.delete(f"/projects/default/tasks/{task_data['id']}")

    # Try to delete "qa-test" - should succeed now
    response = client.delete("/projects/default/buckets/qa-test")
    assert response.status_code == 200

    # Verify bucket is gone
    response = client.get("/projects/default/buckets")
    assert len(response.json()) == 4


def test_done_bucket_auto_creation():
    # 1. Create a project
    project_payload = {"title": "Done Test Project"}
    response = client.post("/projects", json=project_payload)
    assert response.status_code == 201
    project_id = response.json()["id"]

    # 2. Delete the "done" bucket
    response = client.delete(f"/projects/{project_id}/buckets/done")
    assert response.status_code == 200

    # Verify "done" is gone
    response = client.get(f"/projects/{project_id}/buckets")
    buckets = response.json()
    assert len(buckets) == 3
    assert not any(b["name"] == "done" for b in buckets)

    # 3. Create a task in another bucket (e.g. "todo")
    task_payload = {
        "title": "Task 1",
        "bucket": "todo",
        "tags": [],
        "body": "Body",
    }
    response = client.post(f"/projects/{project_id}/tasks", json=task_payload)
    assert response.status_code == 201
    task_id = response.json()["id"]

    # 4. Move task to "done" bucket, which currently does not exist
    move_payload = {"bucket": "done", "position": 100.0}
    response = client.patch(f"/projects/{project_id}/tasks/{task_id}/move", json=move_payload)
    assert response.status_code == 200

    # 5. Verify the "done" bucket was automatically created and has the right title
    response = client.get(f"/projects/{project_id}/buckets")
    buckets = response.json()
    assert len(buckets) == 4
    done_bucket = next(b for b in buckets if b["name"] == "done")
    assert done_bucket["title"] == "Done"
    other_max = max(b["position"] for b in buckets if b["name"] != "done")
    assert done_bucket["position"] == other_max + 1000.0


def test_exclude_bucket():
    # 1. Create a project
    project_payload = {"title": "Exclude Test Project"}
    response = client.post("/projects", json=project_payload)
    assert response.status_code == 201
    project_id = response.json()["id"]

    # 2. Create a task in "todo"
    t1_payload = {
        "title": "Task Todo",
        "bucket": "todo",
        "tags": [],
        "body": "Body 1",
    }
    r1 = client.post(f"/projects/{project_id}/tasks", json=t1_payload)
    assert r1.status_code == 201

    # 3. Create a task in "done"
    t2_payload = {
        "title": "Task Done",
        "bucket": "done",
        "tags": [],
        "body": "Body 2",
    }
    r2 = client.post(f"/projects/{project_id}/tasks", json=t2_payload)
    assert r2.status_code == 201

    # 4. Fetch all tasks
    response = client.get(f"/projects/{project_id}/tasks")
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) == 2

    # 5. Fetch excluding "done"
    response = client.get(f"/projects/{project_id}/tasks?exclude_bucket=done")
    assert response.status_code == 200
    tasks_filtered = response.json()
    assert len(tasks_filtered) == 1
    assert tasks_filtered[0]["title"] == "Task Todo"
    assert tasks_filtered[0]["bucket"] == "todo"

    # 6. Fetch filtering to "done"
    response = client.get(f"/projects/{project_id}/tasks?bucket=done")
    assert response.status_code == 200
    tasks_only_done = response.json()
    assert len(tasks_only_done) == 1
    assert tasks_only_done[0]["title"] == "Task Done"
    assert tasks_only_done[0]["bucket"] == "done"
