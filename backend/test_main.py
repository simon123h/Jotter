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
