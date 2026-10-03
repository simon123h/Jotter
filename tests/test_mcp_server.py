from jotter.config import UserConfig
from jotter.mcp_server import create_mcp_server


def test_mcp_server_tools_workflow(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000)
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
    assert "git_sync" in tool_names


def test_mcp_direct_service_execution(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000)
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

    git_sync_fn = tool_manager.get_tool("git_sync").fn
    git_res = git_sync_fn()
    assert git_res["status"] == "success"
