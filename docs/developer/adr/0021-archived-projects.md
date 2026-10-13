# ADR 0021: Projects Can Be Archived

- **Status**: Accepted
- **Date**: 2026-10-13
- **Related**: `spec/FORMAT.md` (*Project manifest*), [ADR 0007](./0007-project-manifest-index-md.md), [ADR 0015](./0015-index-as-disposable-cache.md), [ADR 0019](./0019-time-model-recurrence-reminders.md)

## Context

The list of projects only grows. A finished or paused project (a trip, an apartment search) stays in the sidebar and in every "all tasks" view and search, and its reminders keep firing. The options today are to delete it, which loses the history, or to live with the clutter. Tasks already have this: the `archive` column puts finished work away without deleting it.

## Decision

A project is archived by `archived: true` in its `index.md`. The flag is optional, absent means not archived, and a writer omits the key when the project is not archived, so restoring is removing the key.

- **The flag lives in the manifest**, not in the SQLite index or the app's settings. The vault is the source of truth (ADR 0015), the flag then syncs to every device, and a reader that does not know the key ignores it and keeps it (the preservation rules).
- **Archived means out of the way, not frozen.** Nothing is moved or rewritten in its tasks. It leaves the project lists (apps show an "Archived" group of their own, to restore or delete from), the views and searches that span projects, reminders, and the MCP server (`list_projects` and the cross-project `list_tasks` skip it, unless asked for archived projects). Opening an archived project by id still works, so a link or an assistant that knows the project is not broken.
- **Reminders do not notify** while the project is archived. The mobile app arms only the reminders of projects in use, and re-arms when the flag changes, so restoring brings them back with no other step.
- **No automatic deletion.** The desktop's cleaning of old done tasks skips archived projects: putting a project away must not make its tasks disappear later.
- **Only a boolean `true` archives.** Anything else reads as not archived, which is the safe direction for a flag that hides things.
- **No "restore" metadata** (date archived, by whom). The file's history in Git has it.

## Consequences

- Both readers (Python manifest, TypeScript parser) and both writers get the key, covered by a project fixture and a round trip.
- The desktop index gets a column for the flag and the queries that span projects filter on it. The index is rebuilt from the files, so no migration beyond the schema version.
- Moving a task into an archived project is allowed (it is a folder like any other), and shows nowhere until the project is restored. The apps do not offer archived projects as targets.
- A project archived on one device is hidden on the others after the next scan or sync, not instantly.
- A vault edited by hand can contain `archived: yes` or `archived: "true"`. That reads as not archived. We accept the surprise to keep the rule one line long.
