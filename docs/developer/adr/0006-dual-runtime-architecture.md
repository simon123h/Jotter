# ADR 6: Dual-Runtime Architecture (Desktop HTTP vs. Android In-Process Engine)

- **Status**: Accepted
- **Date**: 2026-09-08
- **Author**: Antigravity (AI Coding Assistant) & User

## Context

Jotter was conceived as an offline-first, local task manager. While desktop platforms (Linux, macOS, Windows) easily support running a long-lived Python 3 backend (FastAPI, Uvicorn, and SQLite), mobile devices (specifically Android) present significantly different operating constraints:

1. **Background Process Killing & Battery Management**: Modern mobile operating systems aggressively terminate persistent background server daemons.
2. **Runtime Overhead & Portability**: Bundling an entire embedded Python interpreter runtime (e.g. via Chaquopy or Termux) into an APK drastically increases APK size (by 50–100MB+), slows application boot time, and complicates native filesystem access permissions.
3. **True Offline Portability**: Users want to carry their `.md` task folders on Android storage and sync them peer-to-peer (via Syncthing, Git, or cloud drives) without needing network connectivity or an active localhost HTTP server.

We needed an architecture that shares the entire frontend codebase (Vue 3, Pinia, Tailwind CSS, i18n, Lucide icons) across Desktop and Mobile while adapting the storage and execution mechanism to each platform.

## Decision

We decided to implement a **Dual-Runtime Storage Layer Architecture** using a pluggable TypeScript interface (`StorageAdapter`).

```mermaid
flowchart TD
    subgraph Frontend [Shared Vue 3 Frontend Single Page Application]
        UI[Kanban UI Components / Views] --> Stores[Pinia Stores]
        Stores --> AdapterFacade[Storage Facade / activeStorage]
    end

    AdapterFacade -->|Platform Check: Capacitor.isNativePlatform| Choice{Platform?}

    subgraph DesktopPath [Desktop & Web Runtime]
        Choice -->|Desktop / Web Browser| HttpAdapter[HttpStorageAdapter]
        HttpAdapter -->|HTTP / REST API| FastAPIServer[FastAPI Python Backend]
        FastAPIServer --> SQLite[(SQLite Index tasks.db)]
        FastAPIServer --> DiskMD[(Markdown Files .md)]
    end

    subgraph MobilePath [Native Android Runtime - Capacitor]
        Choice -->|Native Mobile| CapAdapter[CapacitorFsStorageAdapter]
        CapAdapter -->|Read/Write Plaintext| CapFS[@capacitor/filesystem Documents]
        CapAdapter -->|Fast Query Index| DexieDB[(Dexie.js IndexedDB Cache)]
        CapFS --> DiskMDMobile[(Local Android Markdown Files)]
    end
```

Specifically:

1. **`StorageAdapter` Abstraction**:
   - The frontend communicates through a unified asynchronous contract (`frontend/src/storage/types.ts`) exposing methods for projects, buckets, tasks, canvas, and system settings.
   - At runtime, `getStorageAdapter()` evaluates `Capacitor.isNativePlatform()`.
2. **Desktop / Web Mode (`HttpStorageAdapter`)**:
   - Forwards all operations over HTTP (`axios`) to the FastAPI backend running at `localhost:58271`.
   - The Python backend writes to local Markdown files and updates SQLite.
3. **Android Mobile Mode (`CapacitorFsStorageAdapter`)**:
   - Runs **completely in-process within the WebView** with zero Python dependencies.
   - Authoritatively reads and writes `.md` files directly on external/shared documents storage using `@capacitor/filesystem`.
   - Reconstructs and maintains an ephemeral client-side search/filter index inside the browser's IndexedDB using **Dexie.js**, mirroring the desktop SQLite indexing behavior.
   - App settings and active UI states are persisted via `@capacitor/preferences`.

## Rationale

- **Zero-Footprint Mobile App**: The signed release Android APK remains small (~5MB) and starts instantaneously without waking up Python or binding to local network sockets.
- **Identical User Experience & Code Reuse**: Over 95% of the frontend application code (components, filtering DSL, matrix views, settings dialogs) is completely identical across platforms.
- **Local-First Data Sovereignty**: On Android, tasks remain plain `.md` files residing in user-accessible storage folders (e.g. `Documents/Jotter`), ready to be synced with Syncthing, Nextcloud, or Git.

## Consequences

- Business logic relating to task frontmatter serialization, parsing, and query indexing must be maintained in two places:
  - Python on backend (`src/jotter/features/tasks/...`)
  - TypeScript on mobile frontend (`frontend/src/storage/capacitorFsAdapter.ts`).
- Any schema additions or new frontmatter properties must be verified in both Python unit tests (`pytest`) and TypeScript frontend tests (`vitest`).
