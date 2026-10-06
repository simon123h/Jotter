# Markdown File Specification

Jotter is built on the philosophy that plain Markdown files are the single source of truth. Every task is stored as an individual `.md` file inside its project's folder (`<vault>/<project>/<task id>.md`). You can open, read, edit, and backup these files using any standard text editor, markdown tool, or version control system.

This page documents the schema and syntax Jotter uses to serialize and parse tasks. The normative definition, which all Jotter apps (desktop and mobile) are tested against, lives in the repository at [`spec/FORMAT.md`](https://github.com/simon123h/Jotter/blob/main/spec/FORMAT.md).

---

## File Structure

Each task file contains two main sections:
1. **Frontmatter**: A YAML block enclosed by triple-dash `---` separators at the top of the file, containing task metadata compliant with the Open Knowledge Format (OKF).
2. **Body**: The standard Markdown content representing task details, notes, checklists, and descriptions.

Here is an example of a complete, valid task file:

```markdown
---
type: task
id: 01HJKM7ST89AB234CDEFGHJKMN
project_id: default
title: Implement sidebar documentation links
status: in-progress
position: 1024.5
tags:
  - frontend
  - documentation
attachments:
  - design_mockup.png
due_date: "2026-06-15"
planned_date: thisWeek
priority: high
color: "#3b82f6"
postponed_until: "2026-07-09"
created_at: "2026-06-07T12:00:00Z"
updated_at: "2026-06-07T14:30:00Z"
---

This task tracks the implementation of the hyperlink pointing to the hosted documentation from within the Jotter sidebar.

### Subtasks
- [x] Create localized translation keys in English and German
- [ ] Implement side-by-side styles with Settings
- [ ] Add unit tests verifying alignment in mobile responsive view

### Implementation Notes
The hyperlink should point to `https://simon123h.github.io/Jotter/` and use the `BookOpen` icon.
```

---

## Task Frontmatter Schema

The YAML frontmatter block supports the following key-value pairs. All key names are case-sensitive and should be lowercase. Any custom or unknown frontmatter keys added by other PKM tools or AI agents are preserved when Jotter saves the file.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | String | No | OKF entity type identifier. Serialized as `task`. |
| `id` | String | No | A unique, URL-safe identifier (ULID or UUID) that uniquely identifies this task across the entire application. Defaults to the file name without `.md`. |
| `project_id` | String | No | The ID of the project this task belongs to. The folder the file is in always decides, so this is only a fallback. |
| `title` | String | No | The title of the task. Keep this on a single line. Defaults to `Untitled Task`. |
| `status` | String | No | The slug/name of the column this task belongs to (e.g. `backlog`, `todo`, `in-progress`, `done`). Defaults to `todo`. Note: Legacy files using `bucket:` are fully supported for backwards compatibility. |
| `position` | Float | No | A floating-point number used by the drag-and-drop system to maintain sorting order within a column. Defaults to `1000`. |
| `tags` | Array of Strings | No | A list of labels categorizing this task. Tags are normalized to lowercase by Jotter's parser. |
| `attachments` | Array of Strings | No | File names of the files attached to this task. The files are stored in `<project>/attachments/<task id>/`. |
| `due_date` | String | No | The date the task is due, formatted in ISO standard date format `YYYY-MM-DD` (or `null` if none). |
| `planned_date`| String | No | A relative scheduling marker used by the planning engine. Supported values: `today`, `tomorrow`, `thisWeek`, `nextWeek`, `thisMonth`, `nextMonth`, `thisYear`, `nextYear`, `someday`, `sometime`, or a `YYYY-MM-DD` date (hyphenated spellings such as `this-week` are read too). |
| `priority` | String | No | The task's priority level. Supported values: `low`, `medium`, `high`, `urgent`, or `null`. |
| `color` | String | No | A custom hex color code (e.g., `#ef4444`) to highlight the task card visually. |
| `postponed_until` | String | No | The date until which the task is postponed, formatted in ISO standard date format `YYYY-MM-DD` (or `null` if none). |
| `created_at` | String | No | ISO 8601 UTC timestamp of task creation (e.g., `2026-06-07T12:00:00Z`). |
| `updated_at` | String | No | ISO 8601 UTC timestamp of the last modification. |

---

## Project Manifest Specification (`index.md`)

Each project directory in Jotter is defined by an `index.md` file located directly in the project folder (e.g. `<data_dir>/<project_id>/index.md`). This file serves as both the canonical project manifest (defining columns/buckets and project metadata) and a rich markdown note compatible with Obsidian Folder Notes, Logseq namespaces, and PKM tools.

### Example `index.md`

```markdown
---
type: project
id: default
title: Main Project Board
description: Primary task tracking board for development.
done_clean_period: 7
buckets:
  - name: backlog
    title: Backlog
    position: 0.0
    is_default: false
  - name: todo
    title: To Do
    position: 1000.0
    is_default: false
  - name: in-progress
    title: In Progress
    position: 2000.0
    is_default: false
  - name: done
    title: Done
    position: 3000.0
    is_default: false
---

# Main Project Overview

Welcome to the project board documentation note. You can freely edit this markdown body in Obsidian or any text editor to record project goals, architecture decisions, and links to relevant notes.
```

### Manifest Frontmatter Schema

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | String | No | OKF entity type identifier. Serialized as `project`. |
| `id` | String | Yes | Unique project ID matching the directory name. |
| `title` | String | Yes | Display title of the project board. |
| `description` | String | No | Human-readable description of the project. |
| `done_clean_period` | Integer | No | Auto-prune policy for completed tasks in days (e.g. `0` for disabled, `1`, `7`, `30`, or `null` to use global default). |
| `buckets` | Array of Objects | Yes | List of board columns (buckets), ordered by `position`. Each object contains `name` (slug), `title`, `position`, `color`, `layout`, `max_tasks`, and `is_default`. |

> [!NOTE]
> **Note**: Legacy per-project `buckets.json` files and the old workspace-level `projects.json` are no longer read; project metadata comes from each project's `index.md`.

---

## Description Body and Markdown Elements

Everything below the second `---` separator is treated as the task body. Jotter parses this block using a highly compatible GitHub Flavored Markdown (GFM) parser.

### Standard Markdown Elements
You can use standard GFM elements within task descriptions:
* **Headers**: Use `#` to `######` for headings.
* **Formatting**: Bold (`**text**`), italics (`*text*`), and strikethroughs (`~~text~~`).
* **Links & Images**: Standard syntax, such as `[Link Text](url)`.
* **Code Blocks**: Syntax-highlighted code blocks using triple backticks.

### Task Lists and Checklists
Subtasks represented as markdown checklists are parsed and integrated with the Jotter UI:
* Uncompleted item: `- [ ] Implement feature`
* Completed item: `- [x] Implement feature`

When you check or uncheck items in the task detail overlay inside the Jotter application, Jotter directly edits the Markdown file, swapping `[ ]` for `[x]` (and vice versa) in real-time, preserving the surrounding text.

---

## Ephemeral Index Synchronization

Because Markdown files on your hard drive are the actual database, Jotter implements an incredibly fast, automatic index synchronization engine:

* **Startup Scan**: When you start Jotter, the backend scans your project's folders for `.md` files, parses their frontmatter, and updates an ephemeral SQLite index in your home directory's app data cache.
* **Periodic Scan**: While Jotter is running, it re-scans your task files once a minute. Files whose size and modification time are unchanged are skipped, so the scan stays cheap even for large vaults. If you edit or save a markdown file using an external text editor (like Obsidian or VS Code) or a sync tool delivers changes, Jotter picks them up within a minute.
* **Manual Re-indexing**: If you want changes to show up right away, or suspect the index is out of date, you can always click **Rebuild Search Index** in **Settings** to run a complete clean scan and rebuild the ephemeral database index.
