"""Unit and integration tests for Timebox API and Service."""


def test_timebox_crud_and_allocation(test_env):
    client, temp_dir = test_env

    # 1. Initially empty timebox list
    res = client.get("/api/timeboxes")
    assert res.status_code == 200
    assert res.json() == []

    # 2. Create timebox
    create_payload = {
        "title": "Deep Work: Auth API",
        "date": "2026-08-31",
        "startTime": "09:00",
        "endTime": "11:30",
        "color": "indigo",
        "taskIds": ["task-1", "task-2"],
    }
    res = client.post("/api/timeboxes", json=create_payload)
    assert res.status_code == 201
    created = res.json()
    tb_id = created["id"]
    assert tb_id.startswith("tb_")
    assert created["title"] == "Deep Work: Auth API"
    assert created["date"] == "2026-08-31"
    assert created["startTime"] == "09:00"
    assert created["endTime"] == "11:30"
    assert created["taskIds"] == ["task-1", "task-2"]

    # 3. Get single timebox
    res = client.get(f"/api/timeboxes/{tb_id}")
    assert res.status_code == 200
    assert res.json()["id"] == tb_id

    # 4. List with date filtering
    res = client.get("/api/timeboxes?startDate=2026-08-31&endDate=2026-08-31")
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = client.get("/api/timeboxes?startDate=2026-09-01")
    assert res.status_code == 200
    assert len(res.json()) == 0

    # 5. Update timebox
    res = client.put(f"/api/timeboxes/{tb_id}", json={"title": "Deep Work: Refactoring", "startTime": "09:30"})
    assert res.status_code == 200
    updated = res.json()
    assert updated["title"] == "Deep Work: Refactoring"
    assert updated["startTime"] == "09:30"
    assert updated["endTime"] == "11:30"

    # 6. Allocate / unallocate task
    res = client.post(f"/api/timeboxes/{tb_id}/tasks", json={"taskId": "task-3", "action": "add"})
    assert res.status_code == 200
    assert "task-3" in res.json()["taskIds"]

    # Re-adding already allocated task must keep it in the box
    res = client.post(f"/api/timeboxes/{tb_id}/tasks", json={"taskId": "task-3", "action": "add"})
    assert res.status_code == 200
    assert "task-3" in res.json()["taskIds"]

    res = client.post(f"/api/timeboxes/{tb_id}/tasks", json={"taskId": "task-1", "action": "remove"})
    assert res.status_code == 200
    assert "task-1" not in res.json()["taskIds"]

    # 7. Delete timebox
    res = client.delete(f"/api/timeboxes/{tb_id}")
    assert res.status_code == 204

    # 8. Confirm deleted
    res = client.get(f"/api/timeboxes/{tb_id}")
    assert res.status_code == 404
