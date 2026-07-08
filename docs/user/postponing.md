# Postponing Tasks

Jotter includes a powerful **Task Postponement** engine designed to help you battle task flood and keep your active workspace uncluttered. 

When you postpone a task to a future date:
1. It disappears from your active board columns (like *To Do* or *In Progress*).
2. It is placed into a virtual **Postponed** column.
3. The virtual column can be toggled visible or invisible. When hidden, postponed tasks are completely filtered out of your view.
4. Once the postponement date is reached (or passed), the task **automatically surfaces** back into its original column, ready for action.

---

## Postponing a Task

You can postpone a task in three ways:

### 1. From the Task Detail Overlay
Double-click a task card to open the Detail Modal. 
* Change the column dropdown to **Postponed**.
* A date input selector will appear below the column selector.
* Select the date until which the task should remain hidden. If no date is picked, it defaults to **tomorrow**.

### 2. Via Drag and Drop
On the Kanban Board, toggle the Postponed column visible (see below). Drag any task card from another column directly into the **Postponed** column. This will automatically set its postponement date to **tomorrow**.

### 3. Bulk Postponing
Select multiple tasks by clicking the checkbox at the top-right of any task card. In the Bulk Action Bar that appears at the bottom of the screen:
* Click the **Postpone** button.
* Select a preset (e.g., *Tomorrow*, *Next Week*, *In 2 Weeks*) or click **Pick Date** to choose a custom date.
* Click **Apply** to postpone all selected tasks at once.

---

## Hiding and Showing Postponed Tasks

You can toggle the visibility of the virtual Postponed column at any time:
* **Board View toolbar**: Use the **Hide Postponed** checkbox next to the *Hide Done* and *Hide Archive* checkboxes in the toolbar.
* **Filter Modal**: Open the Filter Modal (search bar filter icon) and check or uncheck the **Hide Postponed** toggle under Column Filters.

---

## How It Works Under the Hood

### Plain-Text Markdown Storage
Jotter is local-first and stores your tasks in plain-text Markdown files. Unlike moving a task to a separate physical folder, postponing preserves the task's original `bucket` parameter (e.g., `bucket: todo` or `bucket: in-progress`) in the YAML frontmatter and adds a `postponed_until` property:

```yaml
---
id: 01HJKM7ST89AB234CDEFGHJKMN
title: Redesign landing page
bucket: todo
postponed_until: 2026-07-15
---
```

Because the original `bucket` is preserved, Jotter knows exactly where to return the task when the postponement expires.

### Expired Postponements
When Jotter loads, it evaluates task postponement dates against the local calendar date:
* If `postponed_until` is in the **future**, the task is virtually mapped to the Postponed column.
* If `postponed_until` is in the **past** or is **today**, the task surfaces in its original `bucket` (e.g. `todo`) and renders as a normal active task. The expired date remains passively in the markdown frontmatter as a historical reference without triggering automatic file re-writes, keeping your Git synchronization history clean.
