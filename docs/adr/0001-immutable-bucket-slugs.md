# ADR 1: Immutable Bucket Slugs in Markdown Task Frontmatter

- **Status**: Accepted
- **Date**: 2026-05-31
- **Author**: Antigravity (AI Coding Assistant) & User

## Context

In Jotter, the kanban columns (called "buckets") are defined in `tasks/buckets.json`. Each bucket has a unique identifier slug `name` (e.g. `todo`, `in-progress`) and a human-readable `title` (e.g. "To Do", "In Progress"). Tasks are stored as plain markdown files with frontmatter metadata containing a `bucket` field (e.g. `bucket: todo`).

When a user renames a bucket in the UI (e.g. renaming "To Do" to "Inbox"), the backend needs to handle the association. We evaluated two designs:

1. **Mutable Slugs (Cascade Renames):** Update the slug `name` to match the new title (e.g. `inbox`). This requires:
   - Updating `buckets.json`.
   - Updating the SQLite index rows.
   - Rewriting every single task markdown file in that bucket on disk to replace `bucket: todo` with `bucket: inbox`.
2. **Immutable Slugs (Static Identifiers):** Keep the slug `name` static (e.g. `todo`) and only update the visual `title` in `buckets.json`. The task files continue to use `bucket: todo`.

## Decision

We decided to use **Immutable Slugs (Option 2)**.

When a bucket's title is modified, only its `title` field in `buckets.json` and the SQLite index is updated. The internal slug `name` remains unchanged, and no task markdown files on disk are modified.

## Rationale

- **Stability for Integrations:** External automation scripts, CLI utilities, and API consumers targeting `/tasks` can continue to write and query the same stable identifiers (e.g. `todo`) even if the user cosmetically renames columns in the UI.
- **Localization Support:** Multiple translations (e.g. "To Do" / "Zu erledigen") can easily map to the same underlying slug (`todo`), keeping files compatible across different user locales.
- **Sync & Git Cleanliness:** Local-first syncing tools (Syncthing, Dropbox) and version control (Git) do not experience massive merge noise or file update conflicts when a column title is tweaked, as task files are untouched.
- **No File Write Overhead:** Large column updates do not cause synchronous bulk filesystem I/O, maintaining instant response times.

## Consequences

- **Manual Note Editing Caveat:** If a user manually creates or edits a note in an external text editor (like Obsidian or VS Code), they must specify the stable slug (e.g. `bucket: todo`) in the frontmatter rather than the visual title (e.g. `bucket: Inbox`). If they use the visual title, the file sync process will auto-create a new column.
- **Data-to-UI Disconnect:** Looking at the markdown files directly might show `bucket: todo` even though the column is labeled "Incoming Tasks" in the UI. This is documented as expected behavior.
