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

A planned date that has passed is **slipped**. Nothing changes it for you. The planning view shows a *Re-plan* tab as long as there is something in it, and from the selection toolbar you can plan those tasks again with one action, for example for today.

You can plan a task from the task page, the new-task dialog, the selection toolbar (*Plan for...*), by dragging a task between the columns of the planning view, or by typing a date into the title (`friday`, `21.5.`, `tomorrow`). A date in the title plans the task. To set a **deadline** instead, put `!` in front of it (`!friday`, `!21.5.`) or the word `until` (`bis` in German): `Send report until friday`. One title can hold both: `Buy bread tomorrow !21.5.` plans the task for tomorrow and sets the deadline.

---

## Planning ahead and the horizon

Tasks planned a long way off would crowd the board. The **horizon** decides how far ahead a view shows planned tasks. A task planned beyond it stays in its own column, but is hidden until it comes within reach.

| Horizon | Shows tasks planned up to |
| :--- | :--- |
| **Today** (the default) | today, and everything that has no date or has slipped |
| **Tomorrow** | tomorrow |
| **End of this week** | the last day of this week (Monday to Sunday) |
| **End of this month** | the last day of this month |
| **No limit** | everything |

A week or a month starts on its first day: a task planned for *next week* is hidden by a horizon of today, and shown by a horizon of *End of this week* only once it falls within it.

* **Web**: the setting *Show planned tasks up to* is in the toolbar of the board, and in the filter dialog. It applies to the board, the list, the tags and the matrix. The planning view always shows everything. The number next to it says how many tasks it keeps out of the way.
* **Android**: the ⋮ menu has *Show planned tasks…*, for the board and the tags together. It is stored in the vault, so it is the same value as the setting on the web. The planning view looks ahead by nature and has none.

**Searching and the horizon.** A query that names planned dates (`planned:2026-11`) is not cut by the horizon: you asked about planning, so you get the answer. For any other search, the tasks planned beyond the horizon stay hidden, and a line under the toolbar says *"3 more found, planned further ahead"* with a button to show them. A task you have just planned beyond the horizon is announced the same way, so it does not seem to have vanished.

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

### Files from before version 5

Earlier versions wrote words like `thisWeek` or `sometime` into `planned_date`, and a `postponed_until` date that hid a task until then. Version 5 turned them into dates when it read a file. From version 6 Jotter no longer reads them: a word is not a planned date, so the task shows as not planned, and a `postponed_until` no longer hides anything.

Convert a vault once, before you update (or right after, on a copy of the files you have not saved since):

```sh
python3 scripts/migrate_planned.py ~/path/to/vault           # lists what would change
python3 scripts/migrate_planned.py ~/path/to/vault --write   # changes the files
```

A word becomes the day, week or month it stands for today (`sometime` and `thisYear` mean "not planned"), and a `postponed_until` that is still ahead becomes the planned date. `hidePostponedColumn` in `settings.json` becomes a horizon. Only those lines change, so a Git commit before the run shows exactly what happened. The script is in the [repository](https://github.com/simon123h/Jotter/blob/main/scripts/migrate_planned.py).
