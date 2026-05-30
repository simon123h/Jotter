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

# Now import app and endpoints
from main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_and_teardown():
    # Setup test folder structure
    os.makedirs(storage.TASKS_DIR, exist_ok=True)
    db.init_db()
    storage.sync_db_with_files()

    yield

    # Teardown: delete the entire test data folder
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR)


def test_crud_flow():
    # 1. List tasks (should be empty)
    response = client.get("/tasks")
    assert response.status_code == 200
    assert response.json() == []

    # 2. Create task
    task_payload = {
        "title": "Test Task 1",
        "bucket": "todo",
        "tags": ["test", "feature"],
        "body": "# Markdown Content\nWith a list:\n- Sub 1\n- Sub 2",
    }
    response = client.post("/tasks", json=task_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 1000
    assert data["title"] == "Test Task 1"
    assert data["bucket"] == "todo"
    assert data["tags"] == ["test", "feature"]

    # Verify file was created
    expected_filename = "1000-test-task-1.md"
    assert os.path.exists(os.path.join(storage.TASKS_DIR, expected_filename))

    # 3. Read specific task (should include body)
    response = client.get(f"/tasks/{data['id']}")
    assert response.status_code == 200
    task_detail = response.json()
    assert task_detail["body"] == task_payload["body"]

    # 4. Update task (title change -> filename should change)
    update_payload = {"title": "Test Task 1 Updated", "body": "Updated markdown content"}
    response = client.put(f"/tasks/{data['id']}", json=update_payload)
    assert response.status_code == 200
    updated_data = response.json()
    assert updated_data["title"] == "Test Task 1 Updated"
    assert updated_data["body"] == "Updated markdown content"

    # Verify old file was deleted and new file was created
    assert not os.path.exists(os.path.join(storage.TASKS_DIR, expected_filename))
    new_expected_filename = "1000-test-task-1-updated.md"
    assert os.path.exists(os.path.join(storage.TASKS_DIR, new_expected_filename))

    # 5. Move task (change bucket and position)
    move_payload = {"bucket": "in-progress", "position": 500.0}
    response = client.patch(f"/tasks/{data['id']}/move", json=move_payload)
    assert response.status_code == 200
    moved_data = response.json()
    assert moved_data["bucket"] == "in-progress"
    assert moved_data["position"] == 500.0

    # 6. Test sync system (reconstruct DB)
    # Let's delete the SQLite DB file manually
    os.remove(db.DB_PATH)
    db.init_db()  # Recreate empty DB

    # DB is now empty, GET /tasks should return nothing
    response = client.get("/tasks")
    assert response.json() == []

    # Call system/sync to reconstruct DB from the markdown files
    response = client.post("/system/sync")
    assert response.status_code == 200
    assert response.json()["synchronized_tasks"] == 1

    # Verify task is back in database list
    response = client.get("/tasks")
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Test Task 1 Updated"

    # 7. Delete task
    response = client.delete(f"/tasks/{data['id']}")
    assert response.status_code == 200
    assert not os.path.exists(os.path.join(storage.TASKS_DIR, new_expected_filename))

    # Check it's gone from database listing
    response = client.get("/tasks")
    assert response.json() == []


def test_buckets_flow():
    # 1. List buckets (should contain the 4 default buckets)
    response = client.get("/buckets")
    assert response.status_code == 200
    buckets = response.json()
    assert len(buckets) == 4
    assert buckets[0]["name"] == "backlog"
    assert buckets[1]["name"] == "todo"
    assert buckets[2]["name"] == "in-progress"
    assert buckets[3]["name"] == "done"

    # 2. Create bucket
    response = client.post("/buckets", json={"title": "QA Test"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "qa-test"
    assert data["title"] == "QA Test"
    assert data["position"] == 5000.0

    # Verify buckets.json was updated
    assert os.path.exists(storage.BUCKETS_FILE)
    buckets_list = storage.load_buckets_file()
    assert len(buckets_list) == 5
    assert buckets_list[-1]["name"] == "qa-test"

    # 3. Update bucket title
    response = client.put("/buckets/qa-test", json={"title": "Quality Assurance"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "qa-test"
    assert data["title"] == "Quality Assurance"

    # 4. Try deleting a bucket that has tasks
    # Create a task in "qa-test"
    task_payload = {
        "title": "Task in QA",
        "bucket": "qa-test",
        "tags": [],
        "body": "Test body",
    }
    task_response = client.post("/tasks", json=task_payload)
    assert task_response.status_code == 201
    task_data = task_response.json()

    # Try to delete "qa-test" - should fail
    response = client.delete("/buckets/qa-test")
    assert response.status_code == 400
    assert "contains" in response.json()["detail"]

    # Delete the task
    client.delete(f"/tasks/{task_data['id']}")

    # Try to delete "qa-test" - should succeed now
    response = client.delete("/buckets/qa-test")
    assert response.status_code == 200

    # Verify bucket is gone
    response = client.get("/buckets")
    assert len(response.json()) == 4
