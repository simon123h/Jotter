"""Unit and integration tests for Timeblock API and Service."""


def test_timeblock_crud_and_allocation(test_env):
    client, temp_dir = test_env

    # 1. Initially empty timeblock list
    res = client.get("/api/timeblocks")
    assert res.status_code == 200
    assert res.json() == []

    # 2. Create timeblock
    create_payload = {
        "title": "Deep Work: Auth API",
        "date": "2026-08-31",
        "startTime": "09:00",
        "endTime": "11:30",
        "color": "indigo",
        "taskIds": ["task-1", "task-2"],
    }
    res = client.post("/api/timeblocks", json=create_payload)
    assert res.status_code == 201
    created = res.json()
    tb_id = created["id"]
    assert tb_id.startswith("tb_")
    assert created["title"] == "Deep Work: Auth API"
    assert created["date"] == "2026-08-31"
    assert created["startTime"] == "09:00"
    assert created["endTime"] == "11:30"
    assert created["taskIds"] == ["task-1", "task-2"]

    # 3. Get single timeblock
    res = client.get(f"/api/timeblocks/{tb_id}")
    assert res.status_code == 200
    assert res.json()["id"] == tb_id

    # 4. List with date filtering
    res = client.get("/api/timeblocks?startDate=2026-08-31&endDate=2026-08-31")
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = client.get("/api/timeblocks?startDate=2026-09-01")
    assert res.status_code == 200
    assert len(res.json()) == 0

    # 5. Update timeblock
    res = client.put(f"/api/timeblocks/{tb_id}", json={"title": "Deep Work: Refactoring", "startTime": "09:30"})
    assert res.status_code == 200
    updated = res.json()
    assert updated["title"] == "Deep Work: Refactoring"
    assert updated["startTime"] == "09:30"
    assert updated["endTime"] == "11:30"

    # 6. Allocate / unallocate task
    res = client.post(f"/api/timeblocks/{tb_id}/tasks", json={"taskId": "task-3", "action": "add"})
    assert res.status_code == 200
    assert "task-3" in res.json()["taskIds"]

    # Re-adding already allocated task must keep it in the block
    res = client.post(f"/api/timeblocks/{tb_id}/tasks", json={"taskId": "task-3", "action": "add"})
    assert res.status_code == 200
    assert "task-3" in res.json()["taskIds"]

    res = client.post(f"/api/timeblocks/{tb_id}/tasks", json={"taskId": "task-1", "action": "remove"})
    assert res.status_code == 200
    assert "task-1" not in res.json()["taskIds"]

    # 7. Delete timeblock
    res = client.delete(f"/api/timeblocks/{tb_id}")
    assert res.status_code == 204

    # 9. Confirm deleted
    res = client.get(f"/api/timeblocks/{tb_id}")
    assert res.status_code == 404


def test_recurring_timeblocks(test_env):
    client, _ = test_env

    # 1. Create a daily recurring time block starting 2026-08-31
    res = client.post(
        "/api/timeblocks",
        json={
            "title": "Daily Deep Work",
            "date": "2026-08-31",
            "startTime": "08:00",
            "endTime": "10:00",
            "recurrence": "daily",
            "taskIds": ["task-shared"],
        },
    )
    assert res.status_code == 201
    daily_id = res.json()["id"]

    # 2. Query today and tomorrow
    res_today = client.get("/api/timeblocks?startDate=2026-08-31&endDate=2026-08-31")
    assert len(res_today.json()) == 1
    assert res_today.json()[0]["id"] == daily_id
    assert res_today.json()[0]["date"] == "2026-08-31"

    res_tomorrow = client.get("/api/timeblocks?startDate=2026-09-01&endDate=2026-09-01")
    assert len(res_tomorrow.json()) == 1
    assert res_tomorrow.json()[0]["id"] == daily_id
    assert res_tomorrow.json()[0]["date"] == "2026-09-01"

    # Query before start date should return 0
    res_past = client.get("/api/timeblocks?startDate=2026-08-30&endDate=2026-08-30")
    assert len(res_past.json()) == 0

    # 3. Create weekdays block
    res_wd = client.post(
        "/api/timeblocks",
        json={
            "title": "Weekday Standup",
            "date": "2026-08-31",  # 2026-08-31 is Monday
            "startTime": "09:00",
            "endTime": "09:30",
            "recurrence": "weekdays",
        },
    )
    assert res_wd.status_code == 201

    # 2026-09-05 is Saturday (weekend) -> should match daily but NOT weekdays
    res_sat = client.get("/api/timeblocks?startDate=2026-09-05&endDate=2026-09-05")
    sat_titles = [tb["title"] for tb in res_sat.json()]
    assert "Daily Deep Work" in sat_titles
    assert "Weekday Standup" not in sat_titles

    # 2026-09-04 is Friday (weekday) -> should match both
    res_fri = client.get("/api/timeblocks?startDate=2026-09-04&endDate=2026-09-04")
    fri_titles = [tb["title"] for tb in res_fri.json()]
    assert "Daily Deep Work" in fri_titles
    assert "Weekday Standup" in fri_titles
