# ADR 4: Silent Filesystem Indexing via Watchdog and Decoupling Git Sync

- **Status**: Superseded by [ADR 0014](./0014-periodic-scan-instead-of-watcher.md)
- **Date**: 2026-10-03
- **Author**: Antigravity (AI Coding Assistant) & User

## Context

Originally, Jotter exposed a prominent "Sync" button in the global navigation bar and ran an automatic timer in the frontend every few minutes. Under the hood, this single "sync" action performed two distinct operations simultaneously:
1. **Local Filesystem Reindexing (`sync_all`)**: Scanned the local task markdown directory on disk and reconciled the SQLite index with external changes (e.g. edits made in Obsidian, VS Code, or CLI).
2. **Git Synchronization (`git_sync`)**: Ran `git add`, `git commit`, `git fetch`, `git merge`, and `git push` against configured remote repositories across all projects.

This conflated architecture caused several issues:
- **Flawed Conceptual Model**: Users should not need to think about local database synchronization. In a "file-over-app" architecture, local file changes (made by text editors, scripts, or agents) should be reflected effortlessly and immediately in the UI.
- **Unwanted Git Operations**: Triggering Git sync every few minutes created excessive empty or micro-commits, network noise, and potential merge conflict alerts for users who merely wanted their local edits indexed.
- **Sluggish Feedback Loop**: Relying on a manual click or a periodic polling interval meant external edits were delayed, causing stale board state or confusing UI race conditions.

## Decision

We decided to **decouple local filesystem indexing from Git synchronization** and make local index reconciliation completely silent and automatic using an in-process filesystem watcher (`watchdog`).

Specifically:

1. **In-Process Filesystem Watcher (`watchdog`)**:
   - The backend runs a `FileWatcherService` during the FastAPI application lifespan.
   - It monitors the task directory for file creations, modifications, deletions, and moves.
   - It incorporates a 500ms debounce window and ignores temporary files (`.tmp_*`, hidden dotfiles, and SQLite lock/WAL files).
   - On detecting filesystem changes, it quietly runs `sync_all()` in the background to update the SQLite index.

2. **Removal of the Global "Sync" Button**:
   - The prominent "Sync" button in the top navigation bar has been removed.
   - Users no longer manually trigger local index updates.

3. **Multi-Tab / Window Revalidation**:
   - The frontend listens to browser `focus` and `visibilitychange` events to silently revalidate board state and active projects whenever the user switches back to the Jotter tab or window.

4. **Dedicated Git Sync Action**:
   - Git synchronization is isolated as a deliberate remote networking operation (`POST /api/git/sync` or MCP `git_sync`), independent of local database maintenance.

5. **Explicit Maintenance Card in Settings**:
   - To retain full operational control without cluttering everyday UI, a "Rebuild Search Index" button was added to the Settings view (`SettingsView.vue`) for manual re-indexing and troubleshooting.

## Rationale

- **"File-over-App" Harmony**: Changes made by external tools (Obsidian, vim, MCP agents, or scripts) update the database index sub-second without user intervention.
- **Separation of Concerns**: Git push/pull is a network and versioning concern, whereas database reindexing is an internal cache invalidation detail. Decoupling them prevents unwanted Git commits and unnecessary network roundtrips.
- **Cleaner UX**: Eliminates cognitive burden and visual clutter from the navigation bar.

## Architecture

```mermaid
flowchart TD
    subgraph External [External Actors]
        Editor[Obsidian / VS Code / Scripts]
        Agent[MCP Server / CLI]
    end

    subgraph Filesystem [Local Disk]
        Files[(Markdown Files .md)]
    end

    subgraph Backend [Jotter Backend Server]
        Watcher[Watchdog FileWatcherService]
        SyncEngine[SyncService.sync_all]
        DB[(SQLite Index tasks.db)]
    end

    subgraph Frontend [Vue 3 Client]
        Board[Kanban Board View]
        Focus[Window Focus / Visibility Change]
    end

    Editor -->|Edit / Save| Files
    Agent -->|Write / Move| Files
    Files -.->|FS Events| Watcher
    Watcher -->|Debounced (500ms)| SyncEngine
    SyncEngine -->|Reconcile| DB
    Focus -->|Silent Refetch| DB
    DB -->|Fresh State| Board
```

## Consequences

- The Python dependencies now require `watchdog >= 4.0.0`.
- In test environments with ephemeral directory setups, file watching should be disabled (`enable_watcher=False` in `create_app`) to avoid filesystem lock conflicts during teardown.
- Git sync is no longer periodic by default and is triggered either deliberately by the user or through automated CI/cron/MCP commands.
