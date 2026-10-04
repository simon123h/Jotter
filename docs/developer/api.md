# REST API and MCP Reference

Jotter provides both a lightweight FastAPI backend server and a **Model Context Protocol (MCP)** server. This allows developers to write custom scripts, browser integrations, terminal hooks, or connect AI coding assistants (Claude Desktop, Cursor, Antigravity) directly to their Kanban boards.

---

## Server Port and Configuration

By default, when you launch Jotter in server mode, the backend binds to:

* **Default URL**: `http://localhost:58271`
* **Custom Port**: Pass `--port` to the command or set the `JOTTER_PORT` environment variable:

```bash
jotter --port 8080
```

---

## OpenAPI and Interactive Documentation

Jotter comes with auto-generated interactive OpenAPI documentation built directly into the server:

* **Swagger UI**: `http://localhost:58271/docs`
* **ReDoc**: `http://localhost:58271/redoc`
* **OpenAPI JSON Spec**: `http://localhost:58271/openapi.json`

---

## Key API Endpoints

### Projects
* `GET /api/projects` - List all projects in the workspace.
* `POST /api/projects` - Create a new project.
* `PUT /api/projects/{id}` - Edit project metadata.
* `DELETE /api/projects/{id}` - Delete a project and its associated tasks.

### Columns / Buckets
* `GET /api/projects/{id}/buckets` - List all column buckets for a project.
* `POST /api/projects/{id}/buckets` - Create a custom column bucket.
* `PUT /api/projects/{id}/buckets/{bucket_name}` - Update column properties (title, color, layout).
* `DELETE /api/projects/{id}/buckets/{bucket_name}` - Delete a column bucket.

### Tasks
* `GET /api/tasks` or `GET /api/projects/{id}/tasks` - List and filter tasks (supports `bucket`, `tags`, `priority`, `search`, `due_before`, `due_after`).
* `GET /api/projects/{id}/tasks/{taskId}` - Retrieve detailed properties and description body of a task.
* `POST /api/projects/{id}/tasks` - Create a new task (writes `.md` file to disk).
* `PATCH /api/projects/{id}/tasks/{taskId}` - Update task details, priority, due date, tags, or description body.
* `PATCH /api/projects/{id}/tasks/{taskId}/move` - Move a task to a different column.
* `DELETE /api/projects/{id}/tasks/{taskId}` - Delete a task and remove its Markdown file.

### System & Sync
* `POST /api/system/sync` - Reconcile Markdown files on disk with the SQLite index.
* `POST /api/system/commit` - Commit pending changes of the active vault to its local Git repository (no-op if it is not a repository). Never pushes.
* `POST /api/system/git/init` - Initialize a Git repository in the active vault and record the initial commit. Fails with `400` if Git is missing or the vault already lies inside another repository.
* `GET /api/system/info` - Get system information (data directory, version, Git status).

---

## Model Context Protocol (MCP) Integration

Jotter includes a built-in MCP server that allows AI assistants (Claude Desktop, Cursor, Antigravity, etc.) to query, create, update, and move tasks on your board via standard stdio JSON-RPC.

### Running the MCP Server
```bash
jotter mcp
```

### Claude Desktop & Agent Configuration
Add Jotter to your `claude_desktop_config.json` or agent MCP configuration:

```json
{
  "mcpServers": {
    "jotter": {
      "command": "jotter",
      "args": ["mcp"]
    }
  }
}
```

### Available MCP Tools

#### Project Operations
* `list_projects()`: List all projects with id, title, and description.
* `get_project(project_id="default")`: Retrieve project details and settings by ID.
* `create_project(title, id=None, description=None)`: Create a new project board with default columns (`todo`, `in-progress`, `done`).

#### Column / Bucket Operations
* `list_buckets(project_id="default")`: List Kanban columns/buckets for a project.
* `create_bucket(title, project_id="default", name=None)`: Add a new Kanban column/bucket to a project.

#### Task Operations
* `list_tasks(...)`: Query and filter tasks with rich options:
  - `project_id: str | None`: Target project (`None` defaults to default project).
  - `bucket: str | None`: Single column bucket to filter by (e.g. `"todo"`).
  - `buckets: list[str] | None`: Filter by multiple column buckets (e.g. `["todo", "in-progress"]`).
  - `include_done: bool = False`: **By default (`False`), completed and archived tasks (`done`, `archive`) are excluded** to protect AI agents from context bloating. Set to `True` to include all tasks.
  - `exclude_buckets: list[str] | None`: Explicit list of bucket names to exclude.
  - `tag: str | None` / `tags: list[str] | None`: Single or multiple tags to filter by.
  - `tag_mode: "any" | "all" = "any"`: Match any tag in list or require all tags.
  - `search: str | None`: Full-text search across titles and markdown notes.
  - `priority: "none" | "low" | "medium" | "high" | "urgent" | None`: Filter by priority level.
  - `due_before: str | None` / `due_after: str | None`: Filter by due date range (`YYYY-MM-DD`).
  - `planned_date: str | None`: Filter by planned date (`YYYY-MM-DD`).
  - `created_before / created_after / updated_before / updated_after: str | None`: ISO timestamp filters.
  - `limit: int | None`: Maximum number of tasks to return.
* `get_task(task_id, project_id="default")`: Retrieve complete task properties and full Markdown body content.
* `create_task(title, body="", project_id="default", bucket="todo", tags=None, priority=None, due_date=None, planned_date=None)`: Create a new task file on the board.
* `batch_create_tasks(tasks, project_id="default")`: Create multiple tasks in a single call (useful for planning subtasks or milestones).
* `update_task(task_id, title=None, body=None, bucket=None, tags=None, priority=None, due_date=None, planned_date=None, project_id="default")`: Update task metadata or description.
* `move_task(task_id, bucket, position=None, project_id="default", target_project_id=None)`: Move a task to a different column or across projects.
* `delete_task(task_id, project_id="default")`: Delete a task and remove its Markdown file.

#### Synchronization Tools
* `sync_database()`: Reconcile Markdown files on disk with the SQLite search index.
* `commit_changes()`: Commit local changes in the active vault (`add`, `commit`) if it is a Git repository. Never pushes or pulls.

---

### Available MCP Resources

MCP clients can read or attach live board contexts using standard URI schemes without tool calls:
* `jotter://projects`: Overview of all projects, descriptions, and column structures in Markdown format.
* `jotter://projects/{project_id}/board`: Live Kanban board markdown view showing columns and active tasks with priorities, due dates, and tags. **Note**: The `done` and `archive` columns are automatically collapsed to a task count to prevent context bloating (e.g. `## Done (done) — 42 tasks (collapsed)`).
* `jotter://tasks/{task_id}`: Raw Markdown file content and YAML frontmatter for a specific task.
* `jotter://projects/{project_id}/tasks/{task_id}`: Raw Markdown file content for a specific task within a specific project.


