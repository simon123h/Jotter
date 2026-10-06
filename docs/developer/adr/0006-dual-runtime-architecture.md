# ADR 6: Pluggable Storage Adapters (Desktop HTTP, Android In-Process, Browser Demo)

- **Status**: Accepted; the Android runtime was removed on 2026-10-06 and is replaced by the separate mobile app of [ADR 0017](./0017-jotter-lite-mobile-app.md) (rewritten 2026-10-04 to include the demo adapter and the adapter factory)
- **Date**: 2026-09-08
- **Author**: Antigravity (AI Coding Assistant) & User

> **Update 2026-10-06.** The `CapacitorFsStorageAdapter`, the Android project and the `isNativeMobile` and capability branches described below were removed from `frontend/`. Android is now served by Jotter Lite (`mobile/`), a separate app ([ADR 0017](./0017-jotter-lite-mobile-app.md)). The desktop frontend has two runtimes left, HTTP and the demo, behind the same `StorageAdapter`. The text below records the original decision.

## Context

Jotter was conceived as an offline-first, local task manager. The same Vue 3 frontend has to run in three very different environments:

1. **Desktop and web browser**: Linux, macOS and Windows easily support a long-lived Python 3 backend (FastAPI, Uvicorn, SQLite), which the frontend talks to over HTTP.
2. **Android**: modern mobile operating systems aggressively terminate persistent background server daemons, and bundling an embedded Python interpreter (e.g. via Chaquopy or Termux) would grow the APK by 50–100MB+, slow boot time and complicate native filesystem permissions. Users also want to carry their `.md` task folders on Android storage and sync them peer-to-peer (Syncthing, Git, cloud drives) without an active localhost server.
3. **Static demo**: the project site hosts a try-it-out build on GitHub Pages. There is no backend and no filesystem, so the demo has to run entirely inside the browser.

We needed an architecture that shares the whole frontend (Vue 3, Pinia, Tailwind CSS, i18n, Lucide icons) across all three while adapting storage and execution to each environment.

An earlier version of this design had two runtimes (desktop HTTP and Android) behind a storage facade, with the demo implemented as a separate set of functions that `api.ts` switched to with an `if (IS_DEMO_MODE)` branch in every operation. That duplicated the dispatch logic in every API function and let the demo drift from the real adapters (for example, demo timeblocks silently called the HTTP adapter, and the demo's "all tasks" read a project that was never seeded).

## Decision

We use a **pluggable `StorageAdapter` interface** with one implementation per runtime, selected once by a factory.

```mermaid
flowchart TD
    subgraph Frontend [Shared Vue 3 Frontend Single Page Application]
        UI[Kanban UI Components / Views] --> Stores[Pinia Stores]
        Stores --> Api["api.ts (guards, cross-tab broadcasts)"]
        Api --> Factory["getStorageAdapter()"]
    end

    Factory --> Choice{Runtime?}

    subgraph DesktopPath [Desktop & Web Runtime]
        Choice -->|Default| HttpAdapter[HttpStorageAdapter]
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

    subgraph DemoPath [Static Demo - GitHub Pages]
        Choice -->|Demo mode| DemoAdapter[DemoStorageAdapter]
        DemoAdapter --> LocalStorage[(Browser localStorage)]
    end
```

Specifically:

1. **`StorageAdapter` abstraction** (`frontend/src/storage/types.ts`):
   - A single asynchronous contract covering projects, buckets, tasks, canvases, timeblocks, settings and system information. Capabilities that not every runtime has (attachments, changing the data directory) are optional methods.
   - All three adapters `implement` the interface, so the compiler enforces that a new operation is added everywhere.
2. **Platform detection** (`frontend/src/platform.ts`) is the single place that answers "where are we running?": `isNativeMobile` (Capacitor), `isDemoMode` (`VITE_DEMO_MODE=true`, or a `github.io` / `githubpreview.dev` host) and `appVersion` (the version Vite injects from the git tag).
3. **Adapter selection** (`frontend/src/storage/index.ts`):
   - `createStorageAdapter()` picks the demo adapter first, then the Capacitor adapter on native mobile, and otherwise the HTTP adapter.
   - `getStorageAdapter()` creates the adapter lazily on first use and memoises it. Nothing is constructed at import time. `setStorageAdapter()` replaces it, which is intended for tests.
4. **`api.ts` is a thin layer over whichever adapter is active.** It owns only what is independent of the runtime: rejecting blank project ids, broadcasting cross-tab change events ([ADR 11](./0011-cross-tab-broadcast-sync.md)) and raising a clear error when an adapter lacks an optional method. It contains no per-runtime branching.
5. **Desktop / web mode (`HttpStorageAdapter`)**:
   - Forwards all operations over HTTP (`fetch`) to the FastAPI backend running at `localhost:58271`.
   - The Python backend writes to local Markdown files and updates SQLite.
6. **Android mobile mode (`CapacitorFsStorageAdapter`)**:
   - Runs **completely in-process within the WebView** with zero Python dependencies.
   - Authoritatively reads and writes `.md` files directly on external/shared documents storage using `@capacitor/filesystem`.
   - Reconstructs and maintains an ephemeral client-side search/filter index in the browser's IndexedDB using **Dexie.js**, mirroring the desktop SQLite indexing behavior.
   - App settings and active UI state are persisted via `@capacitor/preferences`.
7. **Demo mode (`DemoStorageAdapter`)**:
   - Keeps projects, buckets, tasks, canvases, timeblocks and settings in the browser's `localStorage`, seeded with a sample project.
   - Deliberately limited: attachments are rejected with a clear error, Git history is always empty, changing the data directory is a no-op, and the reported version is `<appVersion> (demo)`.
   - Takes precedence over the native check, so a demo build behaves the same wherever it is opened.

## Rationale

- **Zero-footprint mobile app**: the signed release Android APK stays small (~5MB) and starts instantly without waking up Python or binding to local network sockets.
- **Identical user experience and code reuse**: over 95% of the frontend (components, filtering DSL, matrix views, settings dialogs) is identical across platforms.
- **Local-first data sovereignty**: on Android, tasks remain plain `.md` files in user-accessible storage folders (e.g. `Documents/Jotter`), ready to be synced with Syncthing, Nextcloud or Git.
- **The demo cannot drift silently**: because it is an ordinary adapter, the type checker flags a missing or mismatched method, and the demo is exercised through the same `api.ts` code path as the real runtimes.
- **One decision point**: runtime selection happens in one factory, and `api.ts` stays free of platform conditionals.

## Consequences

- Business logic relating to task frontmatter serialization, parsing and query indexing must be maintained in two places:
  - Python on the backend (`src/jotter/features/tasks/...`)
  - TypeScript on mobile (`frontend/src/storage/capacitorFsAdapter.ts`).
- The demo adapter is a third implementation of the data layer. It is small because it stores plain objects and does no Markdown parsing, but any new `StorageAdapter` method needs a (possibly trivial) demo implementation.
- Any schema additions or new frontmatter properties must be verified in both Python unit tests (`pytest`) and TypeScript frontend tests (`vitest`).
- Vault management is part of the adapter interface as optional methods. The HTTP adapter forwards to `/api/vaults`; the Android adapter keeps a vault registry in Capacitor Preferences (folders below `Documents`, one rebuilt index and one settings/timeblock snapshot per vault); the demo exposes a single built-in vault. Enabling Git versioning and manual commits still bypass the adapter and are HTTP-only, since Android has no Git.
- The demo adapter and the adapter factory are covered by unit tests, but the demo is excluded from coverage reporting.
- The Android runtime stores attachments in `<project>/attachments/<task id>/` like the desktop backend and serves them to the WebView through `Capacitor.convertFileSrc`. Time blocking and the canvas are not available on Android and are hidden there.
