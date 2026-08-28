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
* `POST /api/system/sync` - Reconcile Markdown files with SQLite index and run Git sync.
* `GET /api/system/info` - Get system information (data directory, version, Git status).

---

## Model Context Protocol (MCP) Integration

Jotter includes a built-in MCP server that allows AI assistants (Claude Desktop, Cursor, Antigravity, etc.) to query, create, update, and move tasks on your board.

### Running the MCP Server
```bash
jotter mcp
```

### Claude Desktop Configuration
Add Jotter to your `claude_desktop_config.json`:

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
* `list_projects`: List all projects.
* `list_buckets`: List Kanban columns for a project.
* `list_tasks`: Query tasks with filters (`project_id`, `bucket`, `tag`, `search`, `priority`, `due_before`, `due_after`).
* `get_task`: Retrieve task details and markdown content.
* `create_task`: Create a new task on the board.
* `update_task`: Update task properties or notes.
* `move_task`: Move a task between columns.
* `delete_task`: Delete a task.
* `sync_database`: Reconcile Markdown files on disk with the search index.
