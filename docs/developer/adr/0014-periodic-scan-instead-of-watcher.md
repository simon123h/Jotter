# ADR 0014: A Periodic Scan Instead of a Filesystem Watcher

- **Status**: Accepted
- **Date**: 2026-10-05
- **Supersedes**: [ADR 0004](./0004-silent-watchdog-sync.md)

## Context

ADR 0004 replaced a periodic full re-index with an in-process `watchdog` watcher so that external edits reached the SQLite index within a second. Operating it showed what it costs:

- **Complexity**: the watcher, a registry of Jotter's own recent writes (to suppress echo events, with a `Path.resolve()` on every task write), event classification, an incremental re-index path, and a coupling to the auto-commit scheduler, whose own Git activity fed events back into the watcher.
- **I/O load**: the recursive watcher wakes for every event under the vault, including everything Git does in `.git`. On Windows with antivirus this is a constant tax on every file operation, on the machines where file access is already slow.
- **Fragility**: event delivery can overflow or drop events during bursts (a commit, a sync tool writing many files), so a periodic full scan was needed as a safety net anyway.
- **Little user-visible benefit**: the frontend never polled for the changes the watcher found, so a fresh index only mattered at the next reload, and Jotter is mostly used by one person on one machine with an occasional (slow) sync tool.

The original reason for abandoning periodic scans was their cost, since every scan opened and parsed every task file. That changed once the index recorded each task file's modification time and size and a scan skipped files whose stat is unchanged ([ADR 0015](./0015-index-as-disposable-cache.md)).

## Decision

Remove the watcher and run one background thread (`VaultSyncScheduler`) that wakes up every 60 seconds and:

1. reconciles the SQLite index with the task files on disk, skipping files whose `mtime_ns` and size match what the index recorded (files modified in the last two seconds are not trusted and are re-read);
2. commits the vault to Git when Jotter changed something (the HTTP middleware and MCP tools mark the vault dirty), when the scan re-read or removed task files, or, as a safety net, on every tenth cycle.

A full rebuild that ignores the recorded stats runs on the manual sync, after a Git restore and once after a Jotter upgrade.

## Consequences

- External edits and sync-tool deliveries appear within a minute instead of a second. The manual sync (Settings) is available when that is too slow.
- Idle cost is one `stat` per task file and a few small queries per minute, with no per-event work and no dependency on OS notification APIs. The `watchdog` dependency and its PyInstaller hidden imports are removed.
- Commits are naturally rate-limited to one per cycle, so the separate debounce and cooldown logic is gone.
- An idle cycle must not write anything: unchanged project manifests are not rewritten ([ADR 0015](./0015-index-as-disposable-cache.md)), and git is only invoked when something changed or on the periodic safety-net cycle. A commit takes at most four git processes (`add`, `diff`, a single `cat-file --batch` for deleted task titles, `commit`).
- A change that keeps both a file's size and its mtime is not noticed until a full rebuild. Files younger than two seconds are re-read to avoid the common case of this.
