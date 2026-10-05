# ADR 0015: The SQLite Index Is a Disposable Cache, Kept Valid by File Stats

- **Status**: Accepted
- **Date**: 2026-10-05
- **Related**: [ADR 0005](./0005-explicit-in-process-cqrs.md), [ADR 0014](./0014-periodic-scan-instead-of-watcher.md)

## Context

Markdown files are the source of truth ([ADR 0005](./0005-explicit-in-process-cqrs.md)); `tasks.db` is a read model for queries, sorting and search. It is kept current in two ways: Jotter's own writes project into it immediately, and a sync reconciles it with the files on disk for everything else (external edits, sync tools, `git pull`).

That sync used to open and parse every task file every time. On a vault with thousands of tasks this is the dominant cost of startup, vault switch and any periodic scan, and it is far worse on Windows with antivirus, where each file open can trigger an on-access scan. It is also what made a periodic scan unattractive, which led to the filesystem watcher ([ADR 0004](./0004-silent-watchdog-sync.md)) and, in turn, to the cost of keeping a watcher ([ADR 0014](./0014-periodic-scan-instead-of-watcher.md)).

A cache that is never fully trusted is cheap to keep correct. A cache that is trusted blindly drifts. We need a rule for how much to trust the recorded state.

## Decision

Treat `tasks.db` as a cache that can be thrown away and rebuilt at any time, and skip work for files that provably have not changed.

1. **Record a file stat per task.** Each row stores the `mtime_ns` and size of the file it was read from. A sync `stat`s each task file and skips opening it when both match exactly (equality, not "newer than", so a sync tool that restores an older mtime is still noticed). Retention of done tasks is evaluated from the dates already in the index, so skipped files are still pruned on schedule.
2. **Do not trust a young mtime.** A file modified within the last two seconds could change again without its mtime advancing (coarse timestamp granularity), so its stat is not recorded and it is re-read on the next sync. This is the same idea as git's "racy timestamp" handling.
3. **Clear the stat when Jotter writes the task itself.** A write through the API projects the task without a stat, so the next sync re-reads that file once and records its stat. Jotter never needs to stat files on its own write path.
4. **Rebuild completely, ignoring recorded stats, when trust is in doubt:**
   - the manual sync (Settings), the MCP `sync_database` tool and after a Git restore (`sync_db_only(force=True)`);
   - once after a Jotter upgrade, because the projection (columns, parsing, normalisation) or the table layout may have changed. The version that built the index is kept in a `meta` table and compared when a vault is opened (`sync_on_startup`). On a mismatch (or no recorded version) all triggers and tables are dropped and the schema is recreated from scratch in one transaction before the files are re-read, so no schema change needs a migration. The stored version is the app version plus a `SCHEMA_VERSION` hash of the schema text, so a schema change in a build without a version number (a development checkout) also counts, with nothing to remember. Tables are dropped instead of deleting `tasks.db` because other connections (request threads, the scheduler, an MCP server) keep the file open. The version is recorded only after a rebuild in which no file failed with an I/O error (for example a Windows file lock), so such a rebuild is retried at the next start. Files that cannot be parsed do not count, as they would fail again every time.
5. **Skip unchanged rows on write.** Re-projecting an unchanged task does not update its row, and the FTS update trigger only fires when an indexed column (`project_id`, `title`, `body`, `tags`) changes, so bookkeeping such as recording a file stat does not rewrite the search index.
6. **Do not rewrite unchanged files while reconciling.** A sync saves every project and bucket, and each save used to rewrite the project manifest (`index.md`). A manifest whose content would be identical is left alone, so a periodic scan does not touch files, and therefore does not wake antivirus or sync tools, when nothing changed.
7. **Derive values from the index, not by scanning files.** For example, the next position for a new task comes from `MAX(position)` for its bucket in SQLite instead of reading every task file of the project.

## Alternatives Considered

- **Parse everything on every sync (previous behavior).** Correct and simple, but cost grows with vault size and file-access latency, which is exactly the problem on Windows with antivirus.
- **Content hashes instead of stats.** Immune to the same-size-same-mtime gap, but hashing means reading every file, which is what we are avoiding.
- **A scheduled unconditional full rebuild.** Would bound drift, but runs the expensive path regularly on the machines where it hurts most. Rebuilds on upgrade and on explicit user action cover the cases where drift matters.
- **One transaction around a full rescan.** Fewer commits, but it holds SQLite's write lock for the whole scan and can stall a save request for seconds. Many small transactions keep the lock short.

## Consequences

- Idle cost of a sync is one `stat` per task file plus a few queries, independent of file size or antivirus scanning on open.
- The first start after an upgrade re-reads every task file once and is slow on very large vaults; later starts are fast.
- **Known gap**: an edit that keeps both a file's size and its `mtime_ns` is not noticed until a full rebuild. Same-size edits within the racy window are covered by rule 2; tools that deliberately restore an identical mtime are not. The manual sync is the remedy.
- Neither a change to how tasks are projected nor a change to the schema needs a migration, because an upgrade drops and rebuilds the index. `init_schema` only ever runs `CREATE ... IF NOT EXISTS`; there are no `ALTER TABLE` migrations.
- A Jotter process of the previous version that is still running during an upgrade (for example an MCP server) finds its tables dropped under it and has to be restarted.
- A corrupt `tasks.db` is not detected or recreated automatically; deleting the file and restarting rebuilds it.
