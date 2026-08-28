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
