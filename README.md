# Jotter - Local-First Markdown Kanban App

[![CI Pipeline](https://github.com/simon123h/jotter/actions/workflows/ci.yml/badge.svg)](https://github.com/simon123h/jotter/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/simon123h/jotter/graph/badge.svg?token=ZLMIMRRLEF)](https://codecov.io/gh/simon123h/jotter)

## Project Overview

A custom, local-first, non-commercial task management application designed to replace MS Planner. The primary goal is to combat "task flooding" through aggressive filtering and bulk operations, while maintaining strict data ownership and compliance through a local plain-text storage model.

## Installation & Running

Jotter can be run either as a pre-compiled single-file executable (recommended for most users) or from source (for developers).

### 1. Pre-compiled Binaries (No Dependencies Required)

You do not need Python, Node.js, or any other tools installed to run Jotter. 

1. Go to the **GitHub Releases** page of this repository.
2. Download the packaged executable for your operating system:
   * **Windows:** Download `jotter-vX.Y.Z-windows.zip` (extract and double-click `jotter.exe`)
   * **Linux:** Download `jotter-vX.Y.Z-linux.tar.gz` (extract, open a terminal, and run `chmod +x jotter && ./jotter`)
   * **macOS:** Download `jotter-vX.Y.Z-macos.tar.gz` (extract, open a terminal, and run `chmod +x jotter && ./jotter`)
3. Once running, Jotter will start a local server and **automatically open the app** in your default web browser (usually at `http://localhost:8000`).

---

### 2. Configuration Settings

You can customize how Jotter runs (such as changing the port or where your tasks are saved) using command-line options or a configuration file.

#### Precedence of Settings
1. **Command Line Options** (highest precedence, overrides everything else)
2. **Configuration File** (overrides default settings)
3. **Default Settings** (used if not specified elsewhere)

#### Configuration Options Table

| Setting | CLI Argument | Config File Key | Default Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Port** | `--port <number>` | `port: <number>` | `8000` | The network port the server listens on. |
| **Host** | `--host <address>` | `host: "<address>"` | `127.0.0.1` | The host IP address to bind to (e.g. `0.0.0.0` to allow local network access). |
| **Data Directory** | `--data-dir <path>` | `data_dir: "<path>"` | `./tasks` | The folder where your markdown task files are stored. |
| **Disable Browser** | `--no-browser` | `no_browser: true` | `false` | If set, Jotter will not open your web browser automatically on launch. |
| **Log Level** | `--log-level <level>` | `log_level: "<level>"` | `info` | The logging verbosity level (`debug`, `info`, `warning`, `error`, `critical`). |
| **Config File** | `--config <path>` / `-c` | *N/A* | *See below* | Path to a custom YAML/JSON configuration file. |

#### Using a Configuration File
By default, Jotter looks in the folder it is run from for a file named:
* `jotter.yaml`
* `jotter.yml`
* `jotter.json`

If found, it will automatically load settings from it.

**Example `jotter.yaml` file:**
```yaml
port: 9000
host: "127.0.0.1"
data_dir: "./my-kanban-board"
no_browser: true
```

#### Command Line Examples
* **Run on a custom port without opening browser:**
  ```bash
  ./jotter --port 8080 --no-browser
  ```
* **Store task markdown files in a custom folder:**
  ```bash
  ./jotter --data-dir /path/to/my-docs/tasks
  ```
* **Specify a custom configuration file path:**
  ```bash
  ./jotter --config /home/user/my-jotter-config.yaml
  ```

---


## Architectural Architecture: The "Ephemeral Index" Pattern (Option D)

The system utilizes a hybrid storage architecture to combine the speed of a relational database with the longevity and portability of plain text files.

- **Single Source of Truth (SSoT):** Markdown (`.md`) files. Each task is an individual file containing YAML Frontmatter for structured metadata and a Markdown body for rich text notes.
- **The Engine:** A local, ephemeral SQLite database. It indexes the metadata from the Markdown files to handle fast querying, sorting, and drag-and-drop Kanban mechanics.
- **Fail-Safe:** If the SQLite database is corrupted or deleted, a utility script can perfectly reconstruct it by parsing the YAML Frontmatter of the `.md` files.

## Technology Stack

The stack is chosen for rapid MVP development, strict typing boundaries, and a clean separation of concerns via a REST HTTP API.

### Backend (The API & File Manager)

- **Language & Framework:** Python with FastAPI. Chosen for high development speed, excellent text/file manipulation libraries, and native OpenAPI documentation.
- **Data Validation:** Pydantic models to enforce strict typing (acting similarly to Java DTOs).
- **Libraries:** \* `python-frontmatter` (for dual-writing Markdown metadata)
  - `sqlite3` (built-in, configured with `WAL` mode for durability)
  - `uvicorn` (ASGI server)

### Frontend (The UI)

- **Framework:** Vue 3 (Single Page Application).
- **Styling:** Tailwind CSS for rapid, clean, utility-first styling.
- **Interactions & Markdown:**
  - `Sortable.js` (or a Vue wrapper like `vuedraggable`) for Trello-style drag-and-drop.
  - `marked.js` or `markdown-it` for rendering the task bodies.

## Data Model (YAML Frontmatter + Pydantic)

Every task file (e.g., `1042-fix-auth.md`) will follow this structure:

(The content of the note goes here, supporting standard Markdown, checkboxes, code blocks, etc.)

## API Surface Area (MVP)

The backend acts as a CRUD wrapper, handling the dual-write operations to both the DB and the filesystem.

    GET /tasks - List all tasks (supports query parameters for tags/buckets)

    GET /tasks/{id} - Retrieve a specific task and its Markdown body

    POST /tasks - Create a new task (writes .md and inserts DB row)

    PUT /tasks/{id} - Update metadata or content

    PATCH /tasks/{id}/move - Reorder tasks (updates positions for affected items)

    DELETE /tasks/{id} - Remove a task

    POST /system/sync - The fail-safe endpoint: drops DB tables and rebuilds from .md files.

## Testing

We have built-in automated test suites for both the backend and the frontend:

- **Run all tests:** `npm run test` (executes backend Python tests, followed by Vitest frontend tests)
- **Run backend tests only:** `npm run test:backend` (runs pytest on the python app)
- **Run frontend tests only:** `npm run test:frontend` (runs Vitest once on the frontend app)

## Future Enhancements

    Version Control: Track the .md directory with Git to preserve task history.

    Automated Backups: Implement a pre-commit Git hook to dump the SQLite schema (sqlite3 tasks.db .dump > backup.sql) alongside the Markdown files.

    Language Portability: Because the frontend and storage are decoupled by a clean HTTP API, the Python backend can be swapped out for a compiled Go binary or a Java Spring Boot service in the future as a learning exercise.
