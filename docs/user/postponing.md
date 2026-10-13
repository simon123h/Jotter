# Postponing Tasks

Jotter includes a powerful **Task Postponement** engine designed to help you battle task flood and keep your active workspace uncluttered. 

When you postpone a task to a future date:
1. It is hidden from the board. It stays in its own column (like *To Do* or *In Progress*), so nothing moves.
2. **Hide postponed tasks** is on by default. Switch it off to see them in their column, marked with the day they come back. The count next to the switch tells you how many are out of the way.
3. Once the postponement date is reached (or passed), the task **automatically surfaces** again, ready for action.

---

## Postponing a Task

You can postpone a task in two ways:

### 1. From the Task Detail Overlay
Double-click a task card to open the Detail Modal. 
* Fill in the **Postponed Until** date, which is below the column selector.
* Clear the date to end the postponement.

### 2. Bulk Postponing
Select multiple tasks by clicking the checkbox at the top-right of any task card. In the Bulk Action Bar that appears at the bottom of the screen:
* Click the **Postpone** button.
* Select a preset (e.g., *Tomorrow*, *Next Week*, *In 2 Weeks*) or click **Pick Date** to choose a custom date.
* Click **Apply** to postpone all selected tasks at once.

---

## Hiding and Showing Postponed Tasks

You can show or hide postponed tasks at any time:
* **Board View toolbar**: Use the **Hide Postponed** checkbox next to the *Hide Done* and *Hide Archive* checkboxes in the toolbar.
* **Filter Modal**: Open the Filter Modal (search bar filter icon) and check or uncheck the **Hide Postponed** toggle under Column Filters.

---

## How It Works Under the Hood

### Plain-Text Markdown Storage
Jotter is local-first and stores your tasks in plain-text Markdown files. Unlike moving a task to a separate physical folder, postponing preserves the task's original column (e.g., `status: todo` or `status: in-progress`) in the YAML frontmatter and adds a `postponed_until` property:

```yaml
---
id: 01HJKM7ST89AB234CDEFGHJKMN
title: Redesign landing page
status: todo
postponed_until: 2026-07-15
---
```

The `status` is never touched: postponing a task does not move it, and neither does the day it comes back. Moving a postponed task to another column keeps the postponement.

### Expired Postponements
When Jotter loads, it evaluates task postponement dates against the local calendar date:
* If `postponed_until` is in the **future**, the task is hidden (while *Hide postponed tasks* is on) and marked with its date when shown.
* If `postponed_until` is in the **past** or is **today**, the task surfaces in its original column (e.g. `todo`) and renders as a normal active task. The expired date remains passively in the markdown frontmatter as a historical reference without triggering automatic file re-writes, keeping your Git synchronization history clean.
