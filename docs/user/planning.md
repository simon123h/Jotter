# Planning Tasks

A task has two dates that mean different things:

* The **due date** is a deadline: *when must it be done?* It turns red when it is missed.
* The **planned date** is an intention: *when do I plan to do it?* Missing it is quiet. The task simply slips and waits for you to plan it again.

Most tasks only need a planned date.

---

## What you can plan for

A planned date is always a real point in time, never "whenever the app thinks":

* a **day**, like *21 October 2026*,
* a **week**, like *week 43*: "some day that week",
* a **month**, like *October 2026*: "some day that month".

The menu offers *Today*, *Tomorrow*, *This week*, *Next week*, *This month* and *Next month*, and a day of your own choosing. Choosing *This week* writes the week that is on today; next week it is a past week.

A planned date that has passed is **slipped**. Nothing changes it for you. The planning view shows a *Slipped* tab as long as there is something in it, and from the selection toolbar you can plan those tasks again with one action, for example for today.

You can plan a task from the task page, the new-task dialog, the selection toolbar (*Plan for...*), by dragging a task between the columns of the planning view, or by typing a date into the title (`friday`, `21.5.`, `tomorrow`). A date in the title plans the task. To set a **deadline** instead, put `!` in front of it (`!friday`, `!21.5.`) or the word `until` (`bis` in German): `Send report until friday`.

---

## Planning ahead and the horizon

Tasks planned a long way off would crowd the board. The **horizon** decides how far ahead a view shows planned tasks. A task planned beyond it stays in its own column, but is hidden until it comes within reach.

| Horizon | Shows tasks planned up to |
| :--- | :--- |
| **Today** (the default) | today, and everything that has no date or has slipped |
| **Tomorrow** | tomorrow |
| **End of this week** | the last day of this week (Monday to Sunday) |
| **End of this month** | the last day of this month |
| **Everything** | no limit |

A week or a month starts on its first day: a task planned for *next week* is hidden by a horizon of today, and shown by a horizon of *End of this week* only once it falls within it.

* **Web**: the setting *Planned up to* is in the toolbar of the board, and in the filter dialog. It applies to the board, the list, the tags and the matrix. The planning view always shows everything. The number next to it says how many tasks it keeps out of the way.
* **Android**: the ⋮ menu has *Planned ahead*, separately for each view. The settings have *Planned tasks shown up to*, the horizon the board and the tags start with. It is stored in the vault, so it is the same value as *Planned up to* on the web. The planning view looks ahead by default.

**Searching and the horizon.** A query that names planned dates (`planned:2026-11`) is not cut by the horizon: you asked about planning, so you get the answer. For any other search, the tasks planned beyond the horizon stay hidden, and a line under the toolbar says *"3 more found, planned beyond the horizon"* with a button to show them. A task you have just planned beyond the horizon is announced the same way, so it does not seem to have vanished.

---

## Recurring tasks

When a recurring task is completed, it comes back planned for its next day, so it reappears when the horizon reaches it. See [Recurring Tasks and Reminders](./recurring-and-reminders).

---

## How It Works Under the Hood

The planned date is stored in the task's frontmatter as `YYYY-MM-DD`, `YYYY-Www` (an ISO week) or `YYYY-MM` (a month):

```yaml
---
id: 01HJKM7ST89AB234CDEFGHJKMN
title: Redesign landing page
status: todo
planned_date: 2026-W43
---
```

The `status` is never touched by planning. Hiding is a setting of the view, not part of the file.

### Older files

Earlier versions had words like `thisWeek` or `sometime` in `planned_date`, and a `postponed_until` date that hid a task until then. They are still read: a word is turned into the day, week or month it stands for on the day the file is read (`sometime`, `thisYear` and their kind mean "not planned"), and a `postponed_until` that is still ahead becomes the planned date. When Jotter next saves the task, it writes the new form and drops the old keys.
