"""Model Context Protocol (MCP) Server for Jotter.

Allows AI coding assistants (Claude Desktop, Cursor, Antigravity, etc.) to query,
create, update, move, and organize tasks and projects directly on the local board.
"""

from pathlib import Path
from typing import Any

try:
    from mcp.server.mcpserver import MCPServer
except (ImportError, ModuleNotFoundError):
    try:
        from mcp.server.fastmcp import FastMCP as MCPServer
    except (ImportError, ModuleNotFoundError):
        MCPServer = None  # type: ignore

from jotter.config import UserConfig, load_config
from jotter.features.buckets.service import BucketApplicationService
from jotter.features.projects.service import ProjectApplicationService
from jotter.features.sync.service import SyncApplicationService
from jotter.features.tasks.schemas import TaskCreate, TaskMove, TaskUpdate
from jotter.features.tasks.service import TaskApplicationService
from jotter.shared.db import create_sqlite_connection


def create_mcp_server(config: UserConfig | None = None) -> Any:
    """Creates and configures the Jotter MCP server with tools."""
    if MCPServer is None:
        raise ImportError(
            "The 'mcp' package is required to run the Jotter MCP server. "
            "Please install it with: pip install 'mcp>=1.0.0'"
        )

    cfg = config or load_config()
    db_path = str(Path(cfg.data_dir) / "tasks.db")
    conn = create_sqlite_connection(db_path)

    # Initial sync from disk
    sync_svc = SyncApplicationService.from_data_dir(cfg.data_dir, conn)
    sync_svc.sync_db_only()

    task_svc = TaskApplicationService.from_data_dir(cfg.data_dir, conn)
    bucket_svc = BucketApplicationService.from_data_dir(cfg.data_dir, conn)
    project_svc = ProjectApplicationService.from_data_dir(cfg.data_dir, conn)

    server = MCPServer("jotter")

    @server.tool()
    def list_projects() -> list[dict[str, Any]]:
        """List all projects in Jotter."""
        projects = project_svc.get_all()
        return [p.model_dump() for p in projects]

    @server.tool()
    def list_buckets(project_id: str = "default") -> list[dict[str, Any]]:
        """List all Kanban columns/buckets for a given project (e.g. backlog, todo, in-progress, done, archive)."""
        buckets = bucket_svc.get_all(project_id)
        return [b.model_dump() for b in buckets]

    @server.tool()
    def list_tasks(
        project_id: str | None = None,
        bucket: str | None = None,
        tag: str | None = None,
        search: str | None = None,
        priority: str | None = None,
        due_before: str | None = None,
        due_after: str | None = None,
    ) -> list[dict[str, Any]]:
        """Query and list tasks with optional filtering by project, column bucket, tag, search query, priority, or due date."""
        priorities = [priority] if priority else None
        tasks = task_svc.get_tasks(
            project_id=project_id,
            bucket=bucket,
            tag=tag,
            search=search,
            priorities=priorities,
            due_before=due_before,
            due_after=due_after,
        )
        return [t.model_dump() for t in tasks]

    @server.tool()
    def get_task(task_id: str, project_id: str = "default") -> dict[str, Any]:
        """Retrieve full details of a specific task, including its markdown body content and metadata."""
        task = task_svc.get_task(project_id, task_id)
        return task.model_dump()

    @server.tool()
    def create_task(
        title: str,
        project_id: str = "default",
        bucket: str = "todo",
        tags: list[str] = [],
        body: str = "",
        priority: str | None = None,
        due_date: str | None = None,
        planned_date: str | None = None,
    ) -> dict[str, Any]:
        """Create a new task on the Jotter Kanban board."""
        req = TaskCreate(
            title=title,
            bucket=bucket,
            tags=tags,
            body=body,
            priority=priority,
            due_date=due_date,
            planned_date=planned_date,
        )
        created = task_svc.create_task(project_id, req)
        return created.model_dump()

    @server.tool()
    def update_task(
        task_id: str,
        project_id: str = "default",
        title: str | None = None,
        body: str | None = None,
        priority: str | None = None,
        due_date: str | None = None,
        planned_date: str | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Update an existing task's title, body, priority, due date, or tags."""
        req = TaskUpdate(
            title=title,
            body=body,
            priority=priority,
            due_date=due_date,
            planned_date=planned_date,
            tags=tags,
        )
        updated = task_svc.update_task(project_id, task_id, req)
        return updated.model_dump()

    @server.tool()
    def move_task(
        task_id: str,
        bucket: str,
        project_id: str = "default",
        position: float | None = None,
    ) -> dict[str, Any]:
        """Move a task to a different Kanban column (e.g. 'todo', 'in-progress', 'done', 'archive')."""
        req = TaskMove(bucket=bucket, position=position)
        moved = task_svc.move_task(project_id, task_id, req)
        return moved.model_dump()

    @server.tool()
    def delete_task(task_id: str, project_id: str = "default") -> dict[str, str]:
        """Delete a task from Jotter."""
        task_svc.delete_task(project_id, task_id)
        return {"status": "success", "message": f"Task '{task_id}' deleted"}

    @server.tool()
    def sync_database() -> dict[str, Any]:
        """Reconcile and sync disk Markdown files into the SQLite database index."""
        synced_count = sync_svc.sync_db_only()
        return {"status": "success", "synced_tasks": synced_count}

    return server


def run_mcp_server():
    """Main CLI entrypoint for running the MCP server over stdio."""
    server = create_mcp_server()
    server.run(transport="stdio")


if __name__ == "__main__":
    run_mcp_server()
