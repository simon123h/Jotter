# ADR 0024: Planned Dates Are Absolute, and Hiding Is a Setting of the View

- **Status**: Accepted
- **Date**: 2026-10-20
- **Supersedes**: parts of [ADR 0019](./0019-time-model-recurrence-reminders.md) (`postponed_until` as "hidden until the next occurrence")
- **Related**: `spec/FORMAT.md` (*Dates and times*, *Recurring tasks*), issue #154, [ADR 0015](./0015-index-as-disposable-cache.md)

## Context

A task carried three dates: `due_date`, `planned_date` and `postponed_until`.

- `planned_date` held a day or a **relative keyword** (`today`, `thisWeek`, `sometime`, ...). A keyword means something different on every day, so the same file says different things to two devices on different days, and a task could sit in "this week" for months without ever showing that it had slipped.
- `postponed_until` hid a task until a day. Planned and postponed were two fields for nearly one idea ("not before then"), and the recurrence roll reused `postponed_until` as a way to get the task off the board. That mixed two jobs, and the planning views, which are about the future, lost exactly the recurring tasks they should show (issue #154).

Most tasks need a planned date. A deadline is the rarer, sharper thing.

## Decision

- **A planned date is absolute**: a day (`YYYY-MM-DD`), an ISO week (`YYYY-Www`, "some day that week") or a month (`YYYY-MM`). The week and the month keep what the keywords were used for ("some day this week") without being relative. A passed value is *slipped*, and nothing changes it by itself.
- **`postponed_until` is gone.** Hiding is a **setting of the view**, the *horizon*: a view shows planned tasks up to today, tomorrow, the end of the week, the end of the month or without limit. A week or a month counts from its first day. Hiding is not part of the file, so it needs no rules in the spec.
- **Recurrence plans the task for its next occurrence.** The roll sets `planned_date` to `next` (a planned day keeps its distance to the due date; a week or a month becomes the day), so a recurring task reappears when the horizon reaches it, and the planning views can show it because it has a date.
- **Legacy values are resolved when a file is read**, against today: a keyword becomes the day, week or month it stands for (`thisYear`, `nextYear`, `someday` and `sometime` have no date), and a `postponed_until` that is still ahead becomes the planned date when it is later. Everything after the reader sees only absolute values. A writer drops the old keys, so a file is migrated when it is saved for another reason, and a file that is only read is not rewritten. Until then the apps read such a file again on every scan (the index flags it), so a legacy `today` still means today, the same on every device.
- **The search follows**: `planned:` takes a day, a week, a month or a keyword for one, and finds the tasks planned inside it; `planned:none` finds the unplanned ones. The Python index keeps a `planned_start` column for it.

## Consequences

- One field fewer in the format, in both readers, both apps and every menu; the hide switch of the board becomes a horizon.
- A task that is planned for a day in the future is hidden by the default horizon (*today*). Someone who wants "planned, but in sight" picks a longer horizon for the view.
- A week or a month is **coarse on purpose**. It cannot say "Wednesday or Thursday". Use a day for that.
- A vault read by an older version loses the new values: the old readers drop a `planned_date` they do not know, and drop it for good when they save the task. Update the desktop and the phone together.
- A legacy file is read again on every scan until it is saved (a few files at most), which keeps the devices in agreement. Done tasks planned for a day to come are not removed by the retention cleanup.
- A bare date in a title plans the task; `!` or `until` (`bis`) in front of it makes it a deadline.

## Alternatives Considered

- **Keep the keywords and add a horizon.** The least change, but it keeps the relative meaning and the silent drift.
- **Keep `postponed_until` next to the planned date.** Two fields for one idea, and the recurrence side effect stays.
- **Only days, no weeks and months.** Simpler, but it takes away planning for "some day this week", which is how many tasks are planned.
