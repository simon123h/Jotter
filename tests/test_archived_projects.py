"""A project put away with `archived: true` (spec/FORMAT.md, ADR 0021)."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from jotter.config import UserConfig
from jotter.features.projects.schemas import ProjectCreate
from jotter.features.projects.service import ProjectApplicationService
from jotter.features.sync.service import SyncApplicationService
from jotter.features.tasks.schemas import TaskCreate
from jotter.features.tasks.service import TaskApplicationService
from jotter.mcp_server import create_mcp_server
from jotter.shared.db import create_sqlite_connection


def _manifest(temp_dir: str, project: str) -> str:
    return (Path(temp_dir) / project / "index.md").read_text(encoding="utf-8")


def test_archiving_writes_the_flag_to_the_manifest_and_restoring_removes_it(test_env):
    client, temp_dir = test_env
    client.post("/api/projects", json={"title": "Trip", "id": "trip"})
    assert "archived" not in _manifest(temp_dir, "trip")

    res = client.put("/api/projects/trip", json={"archived": True})
    assert res.status_code == 200
    assert res.json()["archived"] is True
    assert "archived: true" in _manifest(temp_dir, "trip")
    assert {p["id"]: p["archived"] for p in client.get("/api/projects").json()}["trip"] is True

    res = client.put("/api/projects/trip", json={"archived": False})
    assert res.json()["archived"] is False
    assert "archived" not in _manifest(temp_dir, "trip")


def test_an_edit_that_does_not_mention_archived_keeps_it(test_env):
    client, _ = test_env
    client.post("/api/projects", json={"title": "Trip", "id": "trip"})
    client.put("/api/projects/trip", json={"archived": True})
    res = client.put("/api/projects/trip", json={"title": "Trip to Lisbon"})
    assert res.json()["archived"] is True


def test_the_flag_in_a_manifest_edited_elsewhere_is_read_by_the_sync(test_env):
    client, temp_dir = test_env
    client.post("/api/projects", json={"title": "Trip", "id": "trip"})
    index = Path(temp_dir) / "trip" / "index.md"
    index.write_text(index.read_text(encoding="utf-8").replace("type: project", "type: project\narchived: true", 1))
    client.post("/api/system/sync")
    assert {p["id"]: p["archived"] for p in client.get("/api/projects").json()}["trip"] is True


def test_tasks_across_projects_leave_out_archived_projects_unless_asked(test_env):
    client, _ = test_env
    client.post("/api/projects", json={"title": "Trip", "id": "trip"})
    client.post("/api/projects/trip/tasks", json={"title": "Book flights"})
    client.post("/api/projects/default/tasks", json={"title": "Buy milk"})
    client.put("/api/projects/trip", json={"archived": True})

    titles = lambda res: sorted(t["title"] for t in res.json())  # noqa: E731
    assert titles(client.get("/api/tasks")) == ["Buy milk"]
    assert titles(client.get("/api/tasks?includeArchived=true")) == ["Book flights", "Buy milk"]
    # Asking for the project itself still works
    assert titles(client.get("/api/projects/trip/tasks")) == ["Book flights"]


def test_old_done_tasks_of_an_archived_project_are_not_cleaned(temp_dir, test_env):
    conn = create_sqlite_connection(str(Path(temp_dir) / "tasks.db"))
    projects = ProjectApplicationService.from_data_dir(temp_dir, conn)
    tasks = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync = SyncApplicationService.from_data_dir(temp_dir, conn)
    projects.create_project(ProjectCreate(title="Old", id="old", done_clean_period=7, archived=True))
    created = tasks.create_task("old", TaskCreate(title="Finished long ago", bucket="done"))
    path = Path(temp_dir) / "old" / f"{created.id}.md"
    old = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    path.write_text(f"---\ntitle: Finished long ago\nstatus: done\nupdated_at: '{old}'\n---\n", encoding="utf-8")

    sync.sync_db_only(force=True)

    assert path.is_file()
    assert len(tasks.get_tasks("old")) == 1


def test_the_mcp_server_leaves_archived_projects_and_their_tasks_out(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    tools = create_mcp_server(config)._tool_manager
    tools.get_tool("create_project").fn(title="Trip", id="trip")
    tools.get_tool("create_task").fn(title="Book flights", project_id="trip")
    tools.get_tool("create_task").fn(title="Buy milk", project_id="default")
    # The tool has no archive switch of its own: an app (or the file) archives
    config_dir = Path(temp_dir) / "trip" / "index.md"
    config_dir.write_text(
        config_dir.read_text(encoding="utf-8").replace("type: project", "type: project\narchived: true", 1)
    )
    tools.get_tool("sync_database").fn()

    assert [p["id"] for p in tools.get_tool("list_projects").fn()] == ["default"]
    assert sorted(p["id"] for p in tools.get_tool("list_projects").fn(include_archived=True)) == ["default", "trip"]
    assert [t["title"] for t in tools.get_tool("list_tasks").fn()] == ["Buy milk"]
    assert sorted(t["title"] for t in tools.get_tool("list_tasks").fn(include_archived=True)) == [
        "Book flights",
        "Buy milk",
    ]
    assert [t["title"] for t in tools.get_tool("list_tasks").fn(project_id="trip")] == ["Book flights"]
