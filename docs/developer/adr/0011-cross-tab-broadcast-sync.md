# ADR 11: Cross-Tab Broadcast Synchronization and Window Focus Revalidation

- **Status**: Accepted
- **Date**: 2026-09-24
- **Author**: Antigravity (AI Coding Assistant) & User

## Context

Because Jotter is a local-first application, users frequently:
1. Open multiple browser tabs or windows showing different projects, views (e.g. Kanban board in one window, Canvas in another), or settings.
2. Edit markdown task files externally in third-party editors (such as Obsidian, VS Code, or Neovim) or run scripts / MCP agents in a terminal.
3. Switch back to Jotter after an external edit.

Without client synchronization, several problems emerged:
- **Stale State & Out-of-Order Updates**: Mutating a task in Tab A was not reflected in Tab B until a manual page refresh, creating risk of overwriting updates.
- **Server Load with Traditional Sockets**: Implementing persistent WebSocket connections or Server-Sent Events (SSE) for every open browser tab adds connection lifecycle overhead, idle resource consumption, and reconnect complexity.
- **Aggressive Polling Drawbacks**: Polling the backend API every second from multiple open tabs wastes CPU cycles and battery on laptops.

## Decision

We decided to implement a dual-layer, zero-backend-overhead synchronization strategy in the frontend:
1. **`BroadcastChannel` API** for instant cross-tab state notifications.
2. **Window Focus / Visibility Change Revalidation** with debounce guards.

```mermaid
flowchart TD
    subgraph BrowserTabs [Browser Environment]
        TabA[Tab A: User edits / moves task]
        TabB[Tab B: Background Tab]
    end

    subgraph Channel [BroadcastChannel 'jotter-sync']
        Msg[Event: tasks-updated / project-updated]
    end

    subgraph BackendAPI [FastAPI Backend]
        API[GET /api/tasks / SQLite]
    end

    TabA -->|1. Mutate Task| API
    TabA -->|2. Broadcast Message| Msg
    Msg -->|3. On Message (Ignore self)| TabB
    TabB -->|4. Silent Refetch| API

    UserFocus[User Switches Back / Tab Focus] --> FocusEvent[window.onfocus / visibilitychange]
    FocusEvent -->|5. Debounced Refetch (500ms)| API
```

Specifically:

1. **`BroadcastChannel('jotter-sync')`**:
   - Whenever a tab executes a write operation (creating, updating, moving, or deleting a task), it broadcasts a lightweight event: `{ type: "tasks-updated", projectId: "..." }`.
   - Other open tabs listening to the channel receive the notification instantly and silently refetch active queries.
   - Messages originating from the same tab instance are ignored via unique sender IDs to prevent redundant refetches.
2. **Window Focus & Visibility Revalidation**:
   - The frontend registers global event listeners for `window.addEventListener('focus', ...)` and `document.addEventListener('visibilitychange', ...)`.
   - When the user switches back to the Jotter tab or un-minimizes the browser window, the active project tasks, columns, and settings are revalidated against the backend SQLite index.
   - A 500ms debounce guard prevents duplicate rapid network calls when rapidly alt-tabbing.

## Rationale

- **Zero Server Overhead**: The browser handles inter-tab communication entirely in-memory using native web APIs (`BroadcastChannel`); no WebSocket servers or active socket connections to maintain.
- **Instantaneous Multi-Window Updates**: Dragging a task on a secondary monitor reflects immediately on the primary monitor.
- **Graceful External Integration**: When a user modifies a file in Obsidian or an MCP agent runs a command, the backend's `FileWatcherService` quietly updates SQLite (ADR 0004), and the moment the user clicks back into the Jotter window, the focus event revalidates the UI seamlessly.

## Consequences

- In environments without `BroadcastChannel` support (very old legacy browsers), each tab functions independently until window focus is triggered.
- Stores must guard against race conditions if multiple background refetches resolve out of order (handled via cancellation tokens / monotonic request counters).
