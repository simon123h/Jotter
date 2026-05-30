# Local-First Markdown Kanban App

https://gemini.google.com/app/00eaf729eec7d5ba

## Project Overview

A custom, local-first, non-commercial task management application designed to replace MS Planner. The primary goal is to combat "task flooding" through aggressive filtering and bulk operations, while maintaining strict data ownership and compliance through a local plain-text storage model.

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

Future Enhancements

    Version Control: Track the .md directory with Git to preserve task history.

    Automated Backups: Implement a pre-commit Git hook to dump the SQLite schema (sqlite3 tasks.db .dump > backup.sql) alongside the Markdown files.

    Language Portability: Because the frontend and storage are decoupled by a clean HTTP API, the Python backend can be swapped out for a compiled Go binary or a Java Spring Boot service in the future as a learning exercise.
