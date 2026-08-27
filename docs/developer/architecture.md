# Architectural Architecture: Jotter (arc42)

This document describes the architecture of **Jotter** using the standardized **arc42 template**.

---

## 1. Introduction and Goals

Jotter is a local-first, non-commercial task management application designed to replace cloud-based kanban boards like MS Planner.

### 1.1 Requirements Overview

- **Anti-Flooding**: Aggressive task filtering (e.g. hiding the "Done" column) to prevent visual overwhelm.
- **Plain-text Portability**: Use human-readable Markdown files as the primary format so tasks remain accessible outside the app.
- **Speed**: Instantaneous filtering, search, and drag-and-drop actions.

### 1.2 Quality Goals

1. **Data Sovereignty & Compliance**: No cloud syncing, pure local-first file storage.
2. **Robustness**: The indexed database state must always be fully reconstructible from the text files.
3. **Low Latency**: UI updates should feel snappy, even with 1000+ tasks.

---

## 2. Architecture Constraints

- **Platform Independent**: Python 3.10+ runtime support across Linux, macOS, and Windows.
- **Offline-First**: Must run locally without requiring external cloud access.
- **Script-Based Security Compliance**: Pure source script execution (no opaque compiled binary executables).

---

## 3. Context and Scope

```mermaid
flowchart TD
    User([User Browser]) <-->|localhost:58271| Jotter[Jotter Python App]
    Jotter <-->|File Read/Write| FS[(Local Filesystem)]
```

- **User**: Interacts with Jotter through a modern web browser.
- **Jotter App**: FastAPI application serving the Vue 3 frontend bundle and exposing a local REST API.
- **Local Filesystem**: Contains the user's tasks stored as `.md` files in a structured directory format.

---

## 4. Solution Strategy

Jotter employs the **"Ephemeral Index" Pattern** to combine the benefits of relational databases (fast searching, sorting, and joins) with the longevity of text files:

```mermaid
flowchart TD
    API[FastAPI Python Backend] <-->|Write YAML Frontmatter| Files[(Markdown Files)]
    API <-->|Read / Write| DB[(SQLite Index)]
    DB -.->|Fully reconstructed from| Files
```

- **Single Source of Truth (SSoT)**: Markdown (`.md`) files. Task title, bucket, position, tags, and due date are stored in the file's YAML Frontmatter, while description notes are written in the Markdown body.
- **The Index Engine**: An in-memory/ephemeral SQLite database. On startup, it parses the Markdown files and constructs a relational table for rapid API operations.
- **Auto-Reconstruction**: If the SQLite database is deleted or corrupted, the system automatically rebuilds it on startup from the Markdown files.

---

## 5. Building Block View

```mermaid
flowchart LR
    subgraph Frontend [Frontend SPA - Vue 3]
        UI[Kanban UI Components] <--> Store[Pinia Store]
        Store <--> Client[API Client]
    end

    subgraph Backend [Backend Server - FastAPI / Python]
        direction TB
        Router[API Routers / APIRouter] <--> Controllers[Route Endpoints]
        Controllers <--> Services[Domain Services / Business Layer]
        Services <--> Database[(SQLite DB Index)]
        Services <--> Disk[(Local Disk .md)]
    end

    Client <-->|REST API / CORS| Router
```

### 5.1 Frontend (Vue 3 Single Page Application)

- **Kanban UI Components**: Vue 3 Composition API components styled with Tailwind CSS.
- **Pinia Store**: Manages client-side settings, current project, active filters, and selection states.
- **API Client**: Interacts with the FastAPI backend routes.

### 5.2 Backend (FastAPI Python Application)

Jotter is built using a clean, layered architectural design divided into modular packages (`backend/...`): `models`, `routes`, `services`, `utils`, and `db`.

1. **Routes (Controller Layer)**:
   - Registers feature-specific REST endpoints (`projects.py`, `buckets.py`, `tasks.py`, `settings.py`, `system.py`).
   - Parses request parameters, query filters, and validates request payloads into Pydantic DTO models.
   - Translates domain-level responses and exceptions into standard HTTP status codes and JSON responses.

2. **Services (Business Logic Layer)**:
   - Contains pure business logic, input validation, and coordinate operations between disk files and the SQLite index.
   - Handles advanced file-system operations such as multi-part attachment uploads, task list filtering, and project-scoped auto-pruning.

3. **Data Access (SQLite Index & Filesystem)**:
   - **Database Index**: Interacts directly with the local ephemeral SQLite index database (`tasks.db`) using structured SQL queries with WAL mode enabled.
   - **Filesystem**: Reads and writes Markdown YAML frontmatter files, JSON configuration registries (`projects.json`, `buckets.json`, `settings.json`), and binary/text attachment files.

---

## 6. Runtime View

### 6.1 Server Startup and Initialization

When Jotter starts, it goes through a synchronization phase to align the database index with the local files:

```mermaid
sequenceDiagram
    participant Main as backend/main.py
    participant App as backend/app.py
    participant DB as backend/db.py
    participant Sync as backend/services/sync_service.py
    participant Disk as Local Disk (.md)

    Main->>App: create_app(config)
    App->>DB: get_db(db_path)
    DB-->>App: SQLite connection ready (WAL enabled)
    App->>Sync: sync_db_only(data_dir)
    Sync->>Disk: Read projects.json, buckets.json & *.md files
    Disk-->>Sync: Frontmatter & body contents
    Sync->>DB: Atomic batch INSERT (projects, buckets, tasks)
    DB-->>Sync: Sync complete
    Sync-->>App: Return synchronized tasks count
    App-->>Main: FastAPI server ready to accept requests
```

---

## 7. Deployment View

Jotter is deployed as a lightweight client-server web application:

1. **Backend**: Python 3 (FastAPI + Uvicorn) serving REST endpoints and static files.
2. **Frontend**: Built Single Page Application (Vue 3 + Vite + Tailwind CSS) served directly from `frontend/dist/`.

Running Jotter:
```bash
pip install -r requirements.txt
python3 run.py
```

---

## 8. Git Synchronization Logic

Jotter treats each project directory as a potential independent Git repository. The logic is implemented in `internal/features/common/git.go` (and orchestrated via `system.Service`'s file repository wrapper) and is triggered sequentially for all configured projects during a system sync.

### The Per-Project Sync Flow:

1. **Discovery**: The backend queries the database for all projects that have a `git_remote` URL.
2. **Auto-Setup**: For each project, Jotter checks if a `.git` folder exists. If not, it executes `git init` and `git remote add origin` before proceeding.
3. **Commit**: Runs `git add .` and `git commit` inside the project subdirectory.
4. **Fetch & Merge**: Fetches from `origin` and attempts a safe merge (Fast-Forward first, then Recursive).
5. **Conflict Isolation**: Conflicts are handled on a per-project basis. If Project A has a conflict, it will abort that project's merge, but Project B will still continue to sync.
6. **Push**: Successful merges are pushed to the project-specific remote.

This architecture enables **selective sharing**, where different boards can be shared with different teams or kept strictly local.

---

## 9. Data Model

### 8.1 Markdown YAML Frontmatter

Each task file is named following the pattern `[id]-[title-slug].md`. The metadata is serialized as YAML Frontmatter:

```yaml
---
id: 1042
project_id: default
title: Fix Authentication
bucket: todo
position: 2000.0
tags:
  - backend
  - auth
due_date: 2026-06-30
priority: high
created_at: 2026-06-04T12:00:00Z
The notes regarding this task go here, using standard markdown formatting.
```

---

## 10. API & Swagger Documentation

Jotter includes fully-automated OpenAPI 2.0 (Swagger) specification generation and an integrated Swagger UI served directly from the headless server.

- **OpenAPI Annotations**: Every handler/controller is fully annotated using `@Summary`, `@Description`, `@Tags`, `@Accept`, `@Produce`, `@Param`, `@Success`, `@Failure`, and `@Router`.
- **Swagger UI Endpoint**: When running `jotter-server` (or in headless mode), the Swagger UI is accessible at `http://<server-host>:<port>/swagger/index.html` (e.g., `http://localhost:58271/swagger/index.html`).
- **Regenerating Docs**: To regenerate the Swagger documentation after editing endpoint handlers, run:
  ```bash
  npm run swagger:generate
  ```
  This uses the `swag` CLI tool to parse comments in `internal/features/` and output updated spec files to `internal/docs/`.
