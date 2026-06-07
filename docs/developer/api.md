# REST API and OpenAPI Reference

Jotter is accompanied by a lightweight REST API server built in Go. This API drives the frontend web application and allows developers to write custom scripts, browser integrations, or terminal hooks to interact programmatically with their task boards.

This page documents the default API port, endpoint structure, automatic documentation, and examples of how to consume the API.

---

## Server Port and Configuration

By default, when you launch Jotter in server mode, the backend binds to a specific high-range port:

* **Default URL**: `http://localhost:58271`
* **Port Selection**: The port can be customized on launch by passing the `--port` flag to the binary or by setting the `PORT` environment variable.

```bash
./jotter-server --port 8080
```

---

## Swagger UI and Interactive Documentation

Jotter comes with interactive, auto-generated OpenAPI documentation and Swagger UI built directly into the application.

* **Swagger UI Playground**: Access the playground in your web browser at:
  `http://localhost:58271/swagger/index.html`
* **Raw OpenAPI JSON Spec**: You can fetch the raw OpenAPI v2 (Swagger) spec file at:
  `http://localhost:58271/swagger/doc.json`

You can use the interactive Swagger UI playground to test requests directly, inspect endpoint payloads, and view responses live.

---

## Key API Endpoints

The API is structured around standard CRUD operations on projects, columns (buckets), and task cards. All payload responses are returned as structured JSON.

### Projects
* `GET /api/v1/projects` - List all active projects in the workspace.
* `POST /api/v1/projects` - Create a new project folder.
* `PUT /api/v1/projects/{projectId}` - Edit project metadata or rename it.
* `DELETE /api/v1/projects/{projectId}` - Delete a project and all its associated tasks.

### Tasks
* `GET /api/v1/projects/{projectId}/tasks` - List all task cards within a specific project.
* `GET /api/v1/tasks/{taskId}` - Retrieve detailed properties and description body of a single task.
* `POST /api/v1/tasks` - Create a new task. (This writes a new `.md` file to your project storage in real-time).
* `PUT /api/v1/tasks/{taskId}` - Update task details, tags, checklist state, or content body.
* `DELETE /api/v1/tasks/{taskId}` - Safely delete a task card (deleting its `.md` file from disk).

### System and Sync
* `POST /api/v1/sync` - Manually trigger a full file system scan to re-index all Markdown files into the SQLite database.
* `GET /api/v1/health` - Check if the backend server is running and online.

---

## Programmatic Integration Example

Because the API uses standard JSON payloads, you can write short scripts to automate your workflow. 

### Creating a Task via curl
Below is an example of creating a task in your default project using a single command in your terminal:

```bash
curl -X POST http://localhost:58271/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "default",
    "title": "Automated task from shell script",
    "bucket": "todo",
    "priority": "medium",
    "tags": ["automation", "cli"],
    "body": "This card was generated automatically on branch push."
  }'
```

As soon as this command executes successfully:
1. Jotter immediately writes a corresponding `.md` file with a unique ID inside your workspace's `tasks` directory.
2. The ephemeral SQLite database is updated with the new record.
3. The card immediately appears in your "To Do" column on the frontend sidebar board.
