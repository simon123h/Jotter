from jotter.config import UserConfig
from jotter.mcp_server import create_mcp_server


def test_mcp_server_tools_workflow(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000)
    server = create_mcp_server(config)

    # FastMCP / MCPServer internal tool list
    tool_names = [tool.name for tool in getattr(server, "_tool_manager", server).list_tools()]
    assert "list_projects" in tool_names
    assert "list_buckets" in tool_names
    assert "list_tasks" in tool_names
    assert "create_task" in tool_names
    assert "update_task" in tool_names
    assert "move_task" in tool_names
    assert "delete_task" in tool_names
    assert "sync_database" in tool_names


def test_mcp_direct_service_execution(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000)
    server = create_mcp_server(config)
    assert server is not None

    tool_manager = getattr(server, "_tool_manager", server)
    list_projects_fn = tool_manager.get_tool("list_projects").fn
    projects = list_projects_fn()
    assert isinstance(projects, list)
    assert len(projects) >= 1
    assert projects[0]["id"] == "default"

    list_buckets_fn = tool_manager.get_tool("list_buckets").fn
    buckets = list_buckets_fn("default")
    assert isinstance(buckets, list)
    assert len(buckets) >= 1

    create_task_fn = tool_manager.get_tool("create_task").fn
    created = create_task_fn(title="Test Task", project_id="default")
    assert created["id"] is not None
    assert created["bucket"] == "todo"

    move_task_fn = tool_manager.get_tool("move_task").fn
    moved = move_task_fn(task_id=created["id"], bucket="done", project_id="default")
    assert moved["bucket"] == "done"
