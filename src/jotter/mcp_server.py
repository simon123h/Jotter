"""Model Context Protocol (MCP) Server for Jotter.

Allows AI coding assistants (Claude Desktop, Cursor, Antigravity, etc.) to query,
create, update, move, and organize tasks and projects directly on the local board.
"""

import functools
import importlib
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from jotter.config import UserConfig, load_config
from jotter.features.buckets.schemas import BucketCreate
from jotter.features.buckets.service import BucketApplicationService
from jotter.features.projects.schemas import ProjectCreate
from jotter.features.projects.service import ProjectApplicationService
from jotter.features.sync import VaultSyncScheduler
from jotter.features.sync.service import SyncApplicationService
from jotter.features.tasks.command_service import TaskCommandService
from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.features.tasks.query_service import TaskQueryService
from jotter.features.tasks.schemas import TaskCreate, TaskMove, TaskUpdate
from jotter.features.vaults.registry import VaultRegistry
from jotter.shared.db import create_sqlite_connection

logger = logging.getLogger(__name__)


def _load_server_class() -> Any:
    """Finds the MCP server class across mcp releases, or None when the optional package is missing."""
    for module_name, class_name in (("mcp.server.mcpserver", "MCPServer"), ("mcp.server.fastmcp", "FastMCP")):
        try:
            return getattr(importlib.import_module(module_name), class_name)
        except (ImportError, AttributeError):
            continue
    return None


if TYPE_CHECKING:
    from mcp.server.mcpserver import MCPServer
else:
    # None when the optional 'mcp' package is missing; create_mcp_server then raises McpUnavailableError
    MCPServer = _load_server_class()


class McpUnavailableError(ImportError):
    """Raised when the optional 'mcp' package is not installed."""


MCP_MISSING_MESSAGE = (
    "The Jotter MCP server needs the optional 'mcp' Python package, which is not installed.\n"
    "Install it together with Jotter using the 'mcp' extra:\n"
    "  pipx:  pipx install --force 'jotter-app[mcp]'   (or: pipx inject jotter-app mcp)\n"
    "  pip:   pip install 'jotter-app[mcp]'\n"
    "  uvx:   uvx --from 'jotter-app[mcp]' jotter mcp"
)


def create_mcp_server(config: UserConfig | None = None, vault: str | None = None) -> MCPServer:
    """Creates and configures the Jotter MCP server with tools (see `_create_server`)."""
    return _create_server(config, vault)[0]


def _create_server(config: UserConfig | None, vault: str | None) -> tuple[MCPServer, VaultSyncScheduler]:
    """Builds the MCP server and starts its vault sync scheduler, which the caller must stop on shutdown.

    The server works on one vault: the one named by `vault` (id or name), or the registry's active vault.
    """
    if MCPServer is None:
        raise McpUnavailableError(MCP_MISSING_MESSAGE)

    cfg = (config or load_config()).model_copy()
    registry = VaultRegistry(config_file=cfg.vaults_config_path, default_data_dir=cfg.data_dir)
    selected = registry.resolve(vault)
    cfg.data_dir = selected.path
    logger.info("Jotter MCP server using vault '%s' at %s", selected.name, selected.path)
    db_path = str(Path(cfg.data_dir) / "tasks.db")
    # One shared connection is only safe because the mcp library runs sync tools one at a time on the event loop
    # thread. If tools ever run on several threads, borrow a connection per call from a shared.db.ConnectionPool.
    conn = create_sqlite_connection(db_path)

    # Initial sync from disk
    sync_svc = SyncApplicationService.from_data_dir(cfg.data_dir, conn)
    sync_svc.sync_on_startup()

    task_cmd_svc = TaskCommandService.from_data_dir(cfg.data_dir, conn)
    task_query_svc = TaskQueryService.from_conn(conn)
    task_disk_repo = DiskTaskRepository(cfg.data_dir)
    bucket_svc = BucketApplicationService.from_data_dir(cfg.data_dir, conn)
    project_svc = ProjectApplicationService.from_data_dir(cfg.data_dir, conn)

    sync_scheduler = VaultSyncScheduler(cfg.data_dir)

    def commits_changes(fn: Any) -> Any:
        """Marks the vault dirty after a data-changing tool succeeds so the next periodic cycle commits it."""

        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            result = fn(*args, **kwargs)
            sync_scheduler.mark_dirty()
            return result

        return wrapper

    server = MCPServer("jotter")

    @server.tool()
    def list_projects() -> list[dict[str, Any]]:
        """List all projects in Jotter."""
        projects = project_svc.get_all_projects()
        return [p.model_dump() for p in projects]

    @server.tool()
    def get_project(project_id: str) -> dict[str, Any]:
        """Retrieve metadata of a specific project by its ID."""
        project = project_svc.get_project(project_id)
        return project.model_dump()

    @server.tool()
    @commits_changes
    def create_project(
        title: str,
        id: str | None = None,
        description: str = "",
        done_clean_period: int | None = None,
    ) -> dict[str, Any]:
        """Create a new project board in Jotter with default columns."""
        req = ProjectCreate(
            title=title,
            id=id,
            description=description,
            done_clean_period=done_clean_period,
        )
        project = project_svc.create_project(req)
        return project.model_dump()

    @server.tool()
    def list_buckets(project_id: str = "default") -> list[dict[str, Any]]:
        """List all Kanban columns/buckets for a given project (e.g. backlog, todo, in-progress, done, archive)."""
        buckets = bucket_svc.get_all_buckets(project_id)
        return [b.model_dump() for b in buckets]

    @server.tool()
    @commits_changes
    def create_bucket(
        title: str,
        project_id: str = "default",
        name: str | None = None,
        subtitle: str = "",
        color: str | None = None,
        position: float | None = None,
    ) -> dict[str, Any]:
        """Add a new Kanban column/bucket to a project."""
        req = BucketCreate(
            title=title,
            name=name,
            subtitle=subtitle,
            color=color,
            position=position,
        )
        bucket = bucket_svc.create_bucket(project_id, req)
        return bucket.model_dump()

    @server.tool()
    def list_tasks(
        project_id: str | None = None,
        bucket: str | None = None,
        buckets: list[str] | None = None,
        include_done: bool = False,
        exclude_buckets: list[str] | None = None,
        tag: str | None = None,
        tags: list[str] | None = None,
        tag_mode: str = "any",
        search: str | None = None,
        priority: str | None = None,
        due_before: str | None = None,
        due_after: str | None = None,
        planned_date: str | None = None,
        created_before: str | None = None,
        created_after: str | None = None,
        updated_before: str | None = None,
        updated_after: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Query and list tasks with rich filtering options.

        By default, active tasks are returned and completed/archived tasks are excluded
        (`include_done=False`). Set `include_done=True` or explicitly specify `bucket="done"`
        or `exclude_buckets=[]` to include finished tasks.
        """
        priorities = [priority] if priority else None

        # Determine effective exclude_buckets
        resolved_exclude: list[str] | None = None
        if exclude_buckets is not None:
            resolved_exclude = exclude_buckets
        elif not include_done and not bucket and not (buckets and ("done" in buckets or "archive" in buckets)):
            resolved_exclude = ["done", "archive"]

        tasks = task_query_svc.get_tasks(
            project_id=project_id,
            bucket=bucket,
            buckets=buckets,
            tag=tag,
            tags=tags,
            tag_mode=tag_mode,
            exclude_buckets=resolved_exclude,
            priorities=priorities,
            search=search,
            due_before=due_before,
            due_after=due_after,
            planned_date=planned_date,
            created_before=created_before,
            created_after=created_after,
            updated_before=updated_before,
            updated_after=updated_after,
        )

        if limit is not None and limit >= 0:
            tasks = tasks[:limit]

        return [t.model_dump() for t in tasks]

    @server.tool()
    def get_task(task_id: str, project_id: str = "default") -> dict[str, Any]:
        """Retrieve full details of a specific task, including its markdown body content and metadata."""
        task = task_query_svc.get_task(project_id, task_id)
        return task.model_dump()

    @server.tool()
    @commits_changes
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
        created = task_cmd_svc.create_task(project_id, req)
        return created.model_dump()

    @server.tool()
    @commits_changes
    def batch_create_tasks(
        tasks: list[dict[str, Any]],
        project_id: str = "default",
    ) -> list[dict[str, Any]]:
        """Create multiple tasks on the Jotter board in a single batch operation."""
        created_tasks = []
        for t in tasks:
            req = TaskCreate(
                title=t.get("title", ""),
                bucket=t.get("bucket", "todo"),
                tags=t.get("tags") or [],
                body=t.get("body", ""),
                priority=t.get("priority"),
                due_date=t.get("due_date"),
                planned_date=t.get("planned_date"),
                position=t.get("position"),
            )
            created = task_cmd_svc.create_task(project_id, req)
            created_tasks.append(created.model_dump())
        return created_tasks

    @server.tool()
    @commits_changes
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
        updated = task_cmd_svc.update_task(project_id, task_id, req)
        return updated.model_dump()

    @server.tool()
    @commits_changes
    def move_task(
        task_id: str,
        bucket: str,
        project_id: str = "default",
        target_project_id: str | None = None,
        position: float | None = None,
    ) -> dict[str, Any]:
        """Move a task to a different Kanban column (e.g. 'todo', 'in-progress', 'done') or across projects."""
        dest_project = target_project_id or project_id
        if dest_project != project_id:
            update_req = TaskUpdate(project_id=dest_project, bucket=bucket, position=position)
            moved = task_cmd_svc.update_task(project_id, task_id, update_req)
        else:
            move_req = TaskMove(bucket=bucket, position=position)
            moved = task_cmd_svc.move_task(project_id, task_id, move_req)
        return moved.model_dump()

    @server.tool()
    @commits_changes
    def delete_task(task_id: str, project_id: str = "default") -> dict[str, str]:
        """Delete a task from Jotter."""
        task_cmd_svc.delete_task(project_id, task_id)
        return {"status": "success", "message": f"Task '{task_id}' deleted"}

    @server.tool()
    def sync_database() -> dict[str, Any]:
        """Reconcile and sync disk Markdown files into the SQLite database index."""
        synced_count = sync_svc.sync_db_only(force=True)
        return {"status": "success", "synced_tasks": synced_count}

    # ==========================================
    # MCP Resources (Passive Context Attachment)
    # ==========================================

    @server.resource(
        "jotter://projects",
        name="projects_overview",
        title="Jotter Projects Overview",
        description="Markdown overview of all projects, boards, and column metadata in Jotter.",
        mime_type="text/markdown",
    )
    def resource_projects() -> str:
        """Overview of all projects and their buckets/columns."""
        projects = project_svc.get_all_projects()
        lines = ["# Jotter Projects\n"]
        for p in projects:
            lines.append(f"## {p.title} (`{p.id}`)")
            if p.description:
                lines.append(f"_{p.description}_\n")
            buckets = bucket_svc.get_all_buckets(p.id)
            bucket_list = ", ".join(f"`{b.name}` ({b.title})" for b in buckets)
            lines.append(f"- **Columns**: {bucket_list}")
            lines.append("")
        return "\n".join(lines)

    @server.resource(
        "jotter://projects/{project_id}/board",
        name="project_board",
        title="Jotter Project Board",
        description="Markdown representation of a Kanban board, structured by columns/buckets with active tasks.",
        mime_type="text/markdown",
    )
    def resource_project_board(project_id: str) -> str:
        """Active board view showing all columns and tasks for a specific project."""
        project = project_svc.get_project(project_id)
        buckets = bucket_svc.get_all_buckets(project_id)
        all_tasks = task_query_svc.get_tasks(project_id=project_id)

        # Group tasks by bucket name
        tasks_by_bucket: dict[str, list[Any]] = {b.name: [] for b in buckets}
        for task in all_tasks:
            tasks_by_bucket.setdefault(task.bucket, []).append(task)

        lines = [f"# Kanban Board: {project.title} (`{project.id}`)\n"]
        if project.description:
            lines.append(f"_{project.description}_\n")

        for b in buckets:
            bucket_tasks = tasks_by_bucket.get(b.name, [])
            if b.name in ("done", "archive"):
                lines.append(f"## {b.title} (`{b.name}`) — {len(bucket_tasks)} tasks (collapsed)")
                if not bucket_tasks:
                    lines.append("_(empty)_\n")
                else:
                    lines.append(
                        f"_{len(bucket_tasks)} completed/archived tasks hidden to reduce context bloat. Use list_tasks(bucket='{b.name}') to inspect._\n"
                    )
                continue

            lines.append(f"## {b.title} (`{b.name}`) — {len(bucket_tasks)} tasks")
            if not bucket_tasks:
                lines.append("_(empty)_\n")
                continue

            for t in sorted(bucket_tasks, key=lambda x: x.position):
                priority_mark = f" [Priority: {t.priority}]" if t.priority and t.priority != "none" else ""
                due_mark = f" (Due: {t.due_date})" if t.due_date else ""
                tag_mark = f" [{' '.join('#' + tag for tag in t.tags)}]" if t.tags else ""
                lines.append(f"- **{t.title}** (`{t.id}`){priority_mark}{due_mark}{tag_mark}")
                if t.body and t.body.strip():
                    body_first_line = t.body.strip().splitlines()[0]
                    lines.append(f"  > {body_first_line}")
            lines.append("")

        return "\n".join(lines)

    @server.resource(
        "jotter://tasks/{task_id}",
        name="task_detail",
        title="Jotter Task Detail",
        description="Complete raw Markdown file and metadata for a specific task.",
        mime_type="text/markdown",
    )
    def resource_task_detail(task_id: str) -> str:
        """Reads a task's full Markdown content including YAML frontmatter and body."""
        # Find task across projects or in default project
        projects = project_svc.get_all_projects()
        target_task = None
        target_project_id = "default"

        for p in projects:
            try:
                target_task = task_query_svc.get_task(p.id, task_id)
                target_project_id = p.id
                break
            except Exception:
                continue

        if not target_task:
            raise ValueError(f"Task '{task_id}' not found in any project.")

        # Read the raw Markdown file from disk repo if present
        task_path = task_disk_repo.get_task_file_path(target_project_id, task_id)
        if task_path.is_file():
            return task_path.read_text(encoding="utf-8")

        # Fallback to serialized entity
        task_entity = task_query_svc.sqlite_repo.get_by_id(target_project_id, task_id)
        return task_disk_repo.serialize_task(task_entity)

    @server.resource(
        "jotter://projects/{project_id}/tasks/{task_id}",
        name="project_task_detail",
        title="Jotter Project Task Detail",
        description="Complete raw Markdown content of a task within a specified project.",
        mime_type="text/markdown",
    )
    def resource_project_task_detail(project_id: str, task_id: str) -> str:
        """Reads a specific task's Markdown content for a given project."""
        task_path = task_disk_repo.get_task_file_path(project_id, task_id)
        if task_path.is_file():
            return task_path.read_text(encoding="utf-8")

        task_entity = task_query_svc.sqlite_repo.get_by_id(project_id, task_id)
        return task_disk_repo.serialize_task(task_entity)

    sync_scheduler.start()
    return server, sync_scheduler


def run_mcp_server(vault: str | None = None) -> None:
    """Main CLI entrypoint for running the MCP server over stdio."""
    server, sync_scheduler = _create_server(None, vault)
    try:
        server.run(transport="stdio")
    finally:
        sync_scheduler.stop()  # also flushes pending changes


if __name__ == "__main__":
    run_mcp_server()
