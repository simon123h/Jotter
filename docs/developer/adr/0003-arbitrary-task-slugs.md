# ADR 3: Support Arbitrary File Slugs and Non-Enforcement of ULID Format

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Antigravity (AI Coding Assistant) & User

## Context

Originally, Jotter generated 26-character Crockford Base32 ULIDs (e.g. `01ARZ3NDEKTSV4RRFFQ69G5FAV`) for all new task files (`<id>.md`). When reading and writing task Markdown files, the system used the task ID as the file stem.

As Jotter adopts the Open Knowledge Format (OKF) specification and embraces the "file-over-app" philosophy, users may point Jotter to existing Markdown vaults or note collections (e.g. Obsidian vaults, Foam workspaces, or external task repositories) where filenames follow diverse naming conventions (e.g. `fix-auth-header.md`, `t_2024_01_bug.md`, `my-meeting-notes.md`).

We needed to decide whether:
1. **Strict ULID Enforcement**: Enforce standard 26-character Crockford ULIDs for all task IDs and filenames, rejecting or force-renaming files that do not conform.
2. **Arbitrary Slugs as Task Identifiers**: Allow arbitrary string slugs / file names to serve as task IDs while still using ULIDs as the default generator when Jotter creates new tasks.

## Decision

We decided to **support arbitrary slugs and not enforce ULIDs (Option 2)**.

Specifically:
1. `TaskId` allows any non-empty string as a valid identifier slug, validating only that it does not contain path traversal characters (`/`, `\`, null bytes, or `.`/`..`).
2. New tasks created natively by Jotter continue to generate ULIDs (or timestamped IDs in offline mode) by default, preserving collision resistance and chronological sortability.
3. Existing or imported Markdown files with non-ULID filenames (e.g. `fix-auth-header.md`) are treated as first-class tasks. If no explicit `id` is declared in the frontmatter, the file stem serves as the task ID.
4. Saving, updating, and moving tasks persists to `<task.id>.md`, safely handling arbitrary slugs.
5. Atomic disk writes sanitize the temporary file prefix to prevent filesystem collisions with arbitrary slug characters.
6. The synchronization service and file reader automatically ignore hidden files (dotfiles like `.project.md`, `.tmp_*`) and non-task files (`index.md`, `readme.md`).

## Rationale

- **Interoperability & Open Knowledge Format (OKF)**: Jotter can act as an unobtrusive, zero-friction kanban view for existing Markdown repositories and note systems without demanding destructive file renames.
- **Safety**: By validating against path traversal (`/`, `\`, `..`), arbitrary slugs cannot escape project directories while still providing maximum naming flexibility.
- **Zero Disruption to Existing Workflows**: Existing projects and default task creation continue to use ULIDs without alteration.

## Consequences

- API endpoints (`/api/projects/{project_id}/tasks/{task_id}`) and client routes must accommodate arbitrary URL-encoded slugs.
- Future refactorings or schema additions must not introduce regular expressions or validations that restrict task IDs exclusively to ULIDs.
