# ADR 0020: New Tasks Are Named After Their Title

- **Status**: Proposed (spec and fixtures only; no implementation yet)
- **Date**: 2026-10-13
- **Amends**: [ADR 0003](./0003-arbitrary-task-slugs.md), decision 2
- **Related**: `spec/FORMAT.md` (*File names of new tasks*), `spec/fixtures/filenames/slug.json`

## Context

A new task gets a 26-character ULID as its id and file name (`01M4S2ND8E9DXPX791FQB79MY2.md`). ULIDs never collide and sort by creation time, but a vault is also something people open in an editor: quick-open in VS Code or Obsidian matches file names, and a ULID tells nothing about the task. ADR 0003 already made every reader accept any file name and chose ULIDs only as the *default for new tasks*, so the decision to change is small.

## Decision

New tasks are named after their title: "Grocery shopping" becomes `grocery-shopping.md`, and that name is the task's id.

- **The slug is made once, at creation, and never changes.** Editing the title does not rename the file. The id is what attachments (`attachments/<task-id>/`), canvas links, reminders armed on a phone and undo records refer to; a rename would break all of them, and two devices renaming the same task would produce conflicts in a synced vault.
- **Rules are in the spec** (`FORMAT.md`): lowercase ASCII, German umlauts spelled out (`ä` is `ae`), other accents dropped, runs of other characters become one `-`, at most 60 characters (cut after a whole word), `task` when nothing is left. The cases are a conformance fixture, run by both writers.
- **A random suffix only on a name collision.** If the name is taken in the project folder, or reserved (`index`, `readme`, Windows device names), four random characters are appended (`buy-milk-7k3f.md`). A free name stays plain.
- **Moving a task** to another project keeps its name unless the target has it already.
- **Existing files keep their names.** No migration. ULIDs stay valid ids, as do names written by other tools.

## Consequences

- Two places write names and must agree: the Python backend (`shared/slug.py`, task creation) and the mobile app (`src/data/ulid.ts`, `repository.ts`). The static demo makes its own ids and is parked, so it stays as it is. The parser package only reads, so it is not affected.
- Names no longer sort by creation time. `created_at` and `position` already carry that.
- A title that has no Latin letters (Japanese, emoji only) is named `task`, then `task-xxxx` for the next one. The title is in the file; only the name is plain.
- A slug can go stale after a retitle (`grocery-shopping.md` holding "Weekly shopping"). That is the price of a stable id, and it is the choice that most notes apps make.
- Two devices that create the same title offline can write the same name before they sync. The sync tool keeps one of the files as a conflict copy, which shows up as an extra task; ULIDs could not do this. The probability is low and the result is visible, so a suffix on every name was not worth its cost in readability.
- Code that assumes ULID-shaped ids must not exist (already the rule since ADR 0003).
