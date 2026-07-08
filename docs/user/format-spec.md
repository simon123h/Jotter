# Markdown File Specification

Jotter is built on the philosophy that plain Markdown files are the single source of truth. Every task is stored as an individual `.md` file inside your workspace's `tasks` subdirectory. You can open, read, edit, and backup these files using any standard text editor, markdown tool, or version control system.

This page documents the precise schema and syntax Jotter uses to serialize and parse tasks.

---

## File Structure

Each task file contains two main sections:
1. **Frontmatter**: A YAML block enclosed by triple-dash `---` separators at the top of the file, containing task metadata.
2. **Body**: The standard Markdown content representing task details, notes, check-lists, and description.

Here is an example of a complete, valid task file:

```markdown
---
id: 01HJKM7ST89AB234CDEFGHJKMN
project_id: default
title: Implement sidebar documentation links
bucket: in-progress
position: 1024.5
tags:
  - frontend
  - documentation
attachments:
  - uploads/design_mockup.png
due_date: "2026-06-15"
planned_date: "this-week"
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

## Frontmatter Schema

The YAML frontmatter block supports the following key-value pairs. All key names are case-sensitive and should be lowercase.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | A unique, URL-safe identifier (typically an ULID or UUID) that uniquely identifies this task across the entire application. |
| `project_id` | String | Yes | The ID of the project this task belongs to. If not specified, this defaults to `default`. |
| `title` | String | Yes | The title of the task. Keep this on a single line. |
| `bucket` | String | Yes | The slug/name of the column this task belongs to (e.g. `backlog`, `todo`, `in-progress`, `done`). |
| `position` | Float | Yes | A floating-point number used by the drag-and-drop system to maintain sorting order within a column. |
| `tags` | Array of Strings | No | A list of labels categorizing this task. Tags are normalized to lowercase by Jotter's parser. |
| `attachments` | Array of Strings | No | Relative file paths of uploaded files associated with this task, located in the project's attachments folder. |
| `due_date` | String | No | The date the task is due, formatted in ISO standard date format `YYYY-MM-DD` (or `null` if none). |
| `planned_date`| String | No | A relative scheduling marker used by the planning engine. Supported values: `today`, `tomorrow`, `this-week`, `this-month`, `this-year`, `sometime-maybe`, or `null`. |
| `priority` | String | No | The task's priority level. Supported values: `low`, `medium`, `high`, `urgent`, or `null`. |
| `color` | String | No | A custom hex color code (e.g., `#ef4444`) to highlight the task card visually. |
| `postponed_until` | String | No | The date until which the task is postponed, formatted in ISO standard date format `YYYY-MM-DD` (or `null` if none). |
| `created_at` | String | Yes | ISO 8601 UTC timestamp of task creation (e.g., `2026-06-07T12:00:00Z`). |
| `updated_at` | String | Yes | ISO 8601 UTC timestamp of the last modification. |

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
* **File System Watchers**: While Jotter is running, a background file system watcher listens for file events. If you edit or save a markdown file using an external text editor (like Obsidian or VS Code), Jotter automatically parses the updated file and refreshes the UI instantly.
* **Manual Re-indexing**: If watch events are missed or files are synced in bulk, you can always click the **Sync** button in the sidebar to run a complete clean scan and rebuild the ephemeral database index.
