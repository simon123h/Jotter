import datetime


def test_timeblock_crud_and_allocation(test_env):
    client, temp_dir = test_env
    today_str = datetime.date.today().isoformat()
    tomorrow_str = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    # 1. Initially empty timeblock list
    res = client.get("/api/timeblocks")
    assert res.status_code == 200
    assert res.json() == []

    # 2. Create timeblock
    create_payload = {
        "title": "Deep Work: Auth API",
        "date": today_str,
        "start_time": "09:00",
        "end_time": "11:30",
        "color": "indigo",
        "task_ids": ["task-1", "task-2"],
    }
    res = client.post("/api/timeblocks", json=create_payload)
    assert res.status_code == 201
    created = res.json()
    tb_id = created["id"]
    assert tb_id.startswith("tb_")
    assert created["title"] == "Deep Work: Auth API"
    assert created["date"] == today_str
    assert created["start_time"] == "09:00"
    assert created["end_time"] == "11:30"
    assert created["task_ids"] == ["task-1", "task-2"]

    # 3. Get single timeblock
    res = client.get(f"/api/timeblocks/{tb_id}")
    assert res.status_code == 200
    assert res.json()["id"] == tb_id

    # 4. List with date filtering
    res = client.get(f"/api/timeblocks?start_date={today_str}&end_date={today_str}")
    assert res.status_code == 200
    assert len(res.json()) == 1

    res = client.get(f"/api/timeblocks?start_date={tomorrow_str}")
    assert res.status_code == 200
    assert len(res.json()) == 0

    # 5. Update timeblock
    res = client.put(f"/api/timeblocks/{tb_id}", json={"title": "Deep Work: Refactoring", "start_time": "09:30"})
    assert res.status_code == 200
    updated = res.json()
    assert updated["title"] == "Deep Work: Refactoring"
    assert updated["start_time"] == "09:30"
    assert updated["end_time"] == "11:30"

    # 6. Allocate / unallocate task
    res = client.post(f"/api/timeblocks/{tb_id}/tasks", json={"task_id": "task-3", "action": "add"})
    assert res.status_code == 200
    assert "task-3" in res.json()["task_ids"]

    # Re-adding already allocated task must keep it in the block
    res = client.post(f"/api/timeblocks/{tb_id}/tasks", json={"task_id": "task-3", "action": "add"})
    assert res.status_code == 200
    assert "task-3" in res.json()["task_ids"]

    res = client.post(f"/api/timeblocks/{tb_id}/tasks", json={"task_id": "task-1", "action": "remove"})
    assert res.status_code == 200
    assert "task-1" not in res.json()["task_ids"]

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
            "start_time": "08:00",
            "end_time": "10:00",
            "recurrence": "daily",
            "task_ids": ["task-shared"],
        },
    )
    assert res.status_code == 201
    daily_id = res.json()["id"]

    # 2. Query today and tomorrow
    res_today = client.get("/api/timeblocks?start_date=2026-08-31&end_date=2026-08-31")
    assert len(res_today.json()) == 1
    assert res_today.json()[0]["id"] == daily_id
    assert res_today.json()[0]["date"] == "2026-08-31"

    res_tomorrow = client.get("/api/timeblocks?start_date=2026-09-01&end_date=2026-09-01")
    assert len(res_tomorrow.json()) == 1
    assert res_tomorrow.json()[0]["id"] == daily_id
    assert res_tomorrow.json()[0]["date"] == "2026-09-01"

    # Query before start date should return 0
    res_past = client.get("/api/timeblocks?start_date=2026-08-30&end_date=2026-08-30")
    assert len(res_past.json()) == 0

    # 3. Create weekdays block
    res_wd = client.post(
        "/api/timeblocks",
        json={
            "title": "Weekday Standup",
            "date": "2026-08-31",  # 2026-08-31 is Monday
            "start_time": "09:00",
            "end_time": "09:30",
            "recurrence": "weekdays",
        },
    )
    assert res_wd.status_code == 201

    # 2026-09-05 is Saturday (weekend) -> should match daily but NOT weekdays
    res_sat = client.get("/api/timeblocks?start_date=2026-09-05&end_date=2026-09-05")
    sat_titles = [tb["title"] for tb in res_sat.json()]
    assert "Daily Deep Work" in sat_titles
    assert "Weekday Standup" not in sat_titles

    # 2026-09-04 is Friday (weekday) -> should match both
    res_fri = client.get("/api/timeblocks?start_date=2026-09-04&end_date=2026-09-04")
    fri_titles = [tb["title"] for tb in res_fri.json()]
    assert "Daily Deep Work" in fri_titles
    assert "Weekday Standup" in fri_titles


def test_purge_past_one_off_timeblocks(test_env):
    import datetime
    import json
    from pathlib import Path

    client, data_dir = test_env
    today = datetime.date.today()
    past_date = (today - datetime.timedelta(days=3)).isoformat()
    future_date = (today + datetime.timedelta(days=3)).isoformat()

    # Seed raw JSON with a past one-off block, past recurring block, and future block
    seeded = [
        {
            "id": "tb_past_oneoff",
            "title": "Old Past Block",
            "date": past_date,
            "start_time": "09:00",
            "end_time": "10:00",
            "recurrence": None,
            "task_ids": ["task-past"],
        },
        {
            "id": "tb_past_recurring",
            "title": "Recurring Routine",
            "date": past_date,
            "start_time": "08:00",
            "end_time": "09:00",
            "recurrence": "daily",
            "task_ids": [],
        },
        {
            "id": "tb_future_oneoff",
            "title": "Future Planning",
            "date": future_date,
            "start_time": "14:00",
            "end_time": "15:00",
            "recurrence": None,
            "task_ids": [],
        },
    ]
    tb_file = Path(data_dir) / "timeblocks.json"
    tb_file.write_text(json.dumps(seeded, indent=2), encoding="utf-8")

    # Fetching list_timeblocks automatically purges the past one-off block
    res = client.get("/api/timeblocks")
    assert res.status_code == 200
    ids = [tb["id"] for tb in res.json()]
    assert "tb_past_oneoff" not in ids
    assert "tb_past_recurring" in ids
    assert "tb_future_oneoff" in ids
