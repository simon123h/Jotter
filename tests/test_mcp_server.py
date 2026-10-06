from pathlib import Path

from jotter.config import UserConfig
from jotter.mcp_server import create_mcp_server


def test_mcp_server_tools_workflow(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    server = create_mcp_server(config)

    # FastMCP / MCPServer internal tool list
    tool_names = [tool.name for tool in getattr(server, "_tool_manager", server).list_tools()]
    assert "list_projects" in tool_names
    assert "get_project" in tool_names
    assert "create_project" in tool_names
    assert "list_buckets" in tool_names
    assert "create_bucket" in tool_names
    assert "list_tasks" in tool_names
    assert "create_task" in tool_names
    assert "batch_create_tasks" in tool_names
    assert "update_task" in tool_names
    assert "move_task" in tool_names
    assert "delete_task" in tool_names
    assert "sync_database" in tool_names
    assert "commit_changes" not in tool_names


def test_mcp_direct_service_execution(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    server = create_mcp_server(config)
    assert server is not None

    tool_manager = getattr(server, "_tool_manager", server)

    # 1. Projects: list, create, get
    list_projects_fn = tool_manager.get_tool("list_projects").fn
    projects = list_projects_fn()
    assert isinstance(projects, list)
    assert len(projects) >= 1
    assert projects[0]["id"] == "default"

    create_project_fn = tool_manager.get_tool("create_project").fn
    new_proj = create_project_fn(title="Team Beta", id="beta", description="Beta project")
    assert new_proj["id"] == "beta"
    assert new_proj["title"] == "Team Beta"

    get_project_fn = tool_manager.get_tool("get_project").fn
    fetched_proj = get_project_fn(project_id="beta")
    assert fetched_proj["id"] == "beta"
    assert fetched_proj["title"] == "Team Beta"

    # 2. Buckets: list, create
    list_buckets_fn = tool_manager.get_tool("list_buckets").fn
    buckets = list_buckets_fn("default")
    assert isinstance(buckets, list)
    assert len(buckets) >= 1

    create_bucket_fn = tool_manager.get_tool("create_bucket").fn
    new_b = create_bucket_fn(title="QA Review", project_id="beta", name="qa-review")
    assert new_b["name"] == "qa-review"
    assert new_b["title"] == "QA Review"

    # 3. Tasks: single create, batch create, move (within project & cross-project)
    create_task_fn = tool_manager.get_tool("create_task").fn
    created = create_task_fn(title="Test Task", project_id="default")
    assert created["id"] is not None
    assert created["bucket"] == "todo"

    batch_create_fn = tool_manager.get_tool("batch_create_tasks").fn
    batch_res = batch_create_fn(
        tasks=[
            {"title": "Subtask 1", "bucket": "todo", "priority": "high"},
            {"title": "Subtask 2", "bucket": "in-progress", "tags": ["backend"]},
        ],
        project_id="beta",
    )
    assert len(batch_res) == 2
    assert batch_res[0]["title"] == "Subtask 1"
    assert batch_res[0]["priority"] == "high"
    assert batch_res[1]["title"] == "Subtask 2"

    move_task_fn = tool_manager.get_tool("move_task").fn
    # Move within same project
    moved_same = move_task_fn(task_id=created["id"], bucket="done", project_id="default")
    assert moved_same["bucket"] == "done"

    # Move across projects
    moved_cross = move_task_fn(
        task_id=created["id"],
        bucket="qa-review",
        project_id="default",
        target_project_id="beta",
    )
    assert moved_cross["project_id"] == "beta"
    assert moved_cross["bucket"] == "qa-review"

    # 4. Sync tools
    sync_db_fn = tool_manager.get_tool("sync_database").fn
    db_res = sync_db_fn()
    assert db_res["status"] == "success"


def test_mcp_resources(temp_dir):
    import asyncio

    config = UserConfig(data_dir=temp_dir, port=8000, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    server = create_mcp_server(config)

    tool_manager = getattr(server, "_tool_manager", server)
    create_task_fn = tool_manager.get_tool("create_task").fn
    created = create_task_fn(
        title="Resource Task",
        body="This is task body for testing resource attachment.",
        project_id="default",
        tags=["mcp", "test"],
        priority="high",
    )
    task_id = created["id"]

    async def _test():
        # 1. Read jotter://projects
        projects_res = await server.read_resource("jotter://projects")
        assert len(projects_res) == 1
        assert "Jotter Projects" in projects_res[0].content
        assert "default" in projects_res[0].content

        # 2. Read jotter://projects/{project_id}/board
        board_res = await server.read_resource("jotter://projects/default/board")
        assert len(board_res) == 1
        assert "Kanban Board: Default" in board_res[0].content
        assert "Resource Task" in board_res[0].content
        assert "Priority: high" in board_res[0].content
        assert "## Done (`done`) — 0 tasks (collapsed)" in board_res[0].content

        # 3. Read jotter://tasks/{task_id}
        task_res = await server.read_resource(f"jotter://tasks/{task_id}")
        assert len(task_res) == 1
        assert task_id in task_res[0].content
        assert "This is task body for testing resource attachment." in task_res[0].content
        assert "type: task" in task_res[0].content

        # 4. Read jotter://projects/{project_id}/tasks/{task_id}
        proj_task_res = await server.read_resource(f"jotter://projects/default/tasks/{task_id}")
        assert len(proj_task_res) == 1
        assert task_id in proj_task_res[0].content

    asyncio.run(_test())


def test_mcp_list_tasks_filtering(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    server = create_mcp_server(config)
    tool_manager = getattr(server, "_tool_manager", server)

    create_task_fn = tool_manager.get_tool("create_task").fn
    list_tasks_fn = tool_manager.get_tool("list_tasks").fn

    create_task_fn(title="Active Task 1", bucket="todo", tags=["urgent"], project_id="default")
    create_task_fn(title="Active Task 2", bucket="in-progress", tags=["backend"], project_id="default")
    create_task_fn(title="Finished Task", bucket="done", tags=["urgent"], project_id="default")
    create_task_fn(title="Old Archived Task", bucket="archive", project_id="default")

    # 1. Default list_tasks excludes done and archive
    default_tasks = list_tasks_fn(project_id="default")
    titles = [t["title"] for t in default_tasks]
    assert "Active Task 1" in titles
    assert "Active Task 2" in titles
    assert "Finished Task" not in titles
    assert "Old Archived Task" not in titles

    # 2. include_done=True includes done and archive
    all_tasks = list_tasks_fn(project_id="default", include_done=True)
    all_titles = [t["title"] for t in all_tasks]
    assert len(all_titles) == 4
    assert "Finished Task" in all_titles
    assert "Old Archived Task" in all_titles

    # 3. Explicit bucket="done" returns done tasks
    done_tasks = list_tasks_fn(project_id="default", bucket="done")
    assert len(done_tasks) == 1
    assert done_tasks[0]["title"] == "Finished Task"

    # 4. Filter by buckets list
    inprogress_tasks = list_tasks_fn(project_id="default", buckets=["in-progress"])
    assert len(inprogress_tasks) == 1
    assert inprogress_tasks[0]["title"] == "Active Task 2"

    # 5. Filter by tags
    urgent_tasks = list_tasks_fn(project_id="default", tags=["urgent"])
    # Default excludes done, so only Active Task 1
    assert len(urgent_tasks) == 1
    assert urgent_tasks[0]["title"] == "Active Task 1"

    # Urgent tasks with include_done=True
    urgent_all = list_tasks_fn(project_id="default", tags=["urgent"], include_done=True)
    assert len(urgent_all) == 2

    # 6. Limit
    limited = list_tasks_fn(project_id="default", limit=1)
    assert len(limited) == 1


def test_missing_mcp_package_gives_install_hint(monkeypatch):
    import pytest

    from jotter import mcp_server

    monkeypatch.setattr(mcp_server, "MCPServer", None)
    with pytest.raises(mcp_server.McpUnavailableError, match=r"jotter-app\[mcp\]"):
        mcp_server.create_mcp_server()


def _two_vault_config(tmp_path):
    from jotter.features.vaults.domain import Vault
    from jotter.features.vaults.registry import VaultRegistry

    registry_file = tmp_path / "vaults.json"
    registry = VaultRegistry(config_file=registry_file)
    work = Vault.create(name="Work", path=tmp_path / "work", vault_id="work")
    home = Vault.create(name="Home", path=tmp_path / "home", vault_id="home")
    registry.save(work)
    registry.save(home)
    registry.set_active_id("work")
    return UserConfig(vaults_config_path=str(registry_file)), work, home


def test_mcp_serves_active_vault_by_default(tmp_path):
    config, work, _ = _two_vault_config(tmp_path)
    server = create_mcp_server(config)
    assert (Path(work.path) / "tasks.db").exists()
    assert not (tmp_path / "home" / "tasks.db").exists()
    assert server is not None


def test_mcp_vault_option_selects_by_id_or_name(tmp_path):
    config, _, home = _two_vault_config(tmp_path)
    create_mcp_server(config, vault="HOME")
    assert (Path(home.path) / "tasks.db").exists()
    assert not (tmp_path / "work" / "tasks.db").exists()


def test_mcp_unknown_vault_lists_available(tmp_path):
    import pytest

    from jotter.shared.exceptions import EntityNotFoundError

    config, _, _ = _two_vault_config(tmp_path)
    with pytest.raises(EntityNotFoundError, match=r"Available vaults: 'Work'.*'Home'"):
        create_mcp_server(config, vault="nope")
