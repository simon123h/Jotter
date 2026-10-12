# ADR 0019: One Time Model: Recurrence Rolls in Place, Reminders Are Floating

- **Status**: Accepted (spec only; no implementation yet)
- **Date**: 2026-10-12
- **Supersedes**: [ADR 0002](./0002-decline-recurring-tasks.md)
- **Related**: `spec/FORMAT.md` (*Dates and times*, *Reminders*, *Recurring tasks*), [ADR 0015](./0015-index-as-disposable-cache.md), [ADR 0017](./0017-mobile-app.md)

## Context

A task carries `due_date`, `planned_date` and `postponed_until`. Two wanted features add more time: tasks that come back (recurrence) and notifications at a given time (reminders). Added one by one, each would bring its own date format and its own rules about how it relates to the others. ADR 0002 declined recurrence for its complexity, but already sketched the preferred design.

Two constraints decide most of the design:

- **No server process.** The mobile app has none, and the desktop backend is not always running. Nothing can happen "at midnight". Every change must be computed when a task is completed or an app opens.
- **Several devices edit the same files** (often through Git or a sync tool). Two devices must not produce conflicting files from the same event.

## Decision

Give each time field one job (`spec/FORMAT.md`, *Dates and times*), and add exactly two keys:

- **`repeat`**: `every` (integer), `unit` (`day`, `week`, `month`, `year`) and `from` (`completion` or `due`). A structured mapping, so that both parsers validate it with fixtures and need no mini language.
- **`reminders`**: a list of *floating* local date-times (`YYYY-MM-DDTHH:mm`, no zone).

Recurrence **rolls the task over in place** when it is completed (ADR 0002's Option A):

- It is one file with a stable id. There are never copies for later occurrences.
- The new occurrence's day `next` becomes `due_date` (when set) and `postponed_until`. **`postponed_until` is reused as "hidden until the next occurrence"**, so the existing Postponed handling does the work and recurring tasks need no state of their own.
- `planned_date` (when a day) and the reminders move by the same number of days. Planning keywords stay.
- The task goes back to its bucket and its checklist is unticked.
- The result depends only on the file and today's date, so two devices that complete the same task write the same dates.

Not part of the design:

- **Recurrence regardless of completion** (a fixed grid that creates a task per period). A missed occurrence would pile up tasks. A task that is not completed stays overdue.
- **Recurring reminders.** A reminder that comes back is a recurring task with a reminder.
- **Days of the week** (`every Monday and Thursday`). It can be added later as an optional key.
- **A time of day in `due_date`.** Time of day belongs to reminders and time blocks.
- **Fired state of a reminder in the vault.** It is device state, so devices cannot conflict over it.

## Rationale

- **Floating time** is what people mean by "9:00". A UTC instant would move after a flight or a change of daylight saving time.
- **In place** is idempotent and keeps history in Git. Spawning a new file per occurrence would need deterministic ids to survive two devices acting at once.
- **Reusing `postponed_until`** costs no new field, no new column and no new UI state.
- Keeping the keys flat keeps the aliases, the "unknown keys survive" rule and the existing readers working: a reader that does not know `repeat` or `reminders` preserves them.

## Consequences

- The spec and the fixtures come first, then the Python backend, then `packages/vault-format`, then the UIs. Until a reader implements the two keys, its conformance runner lists the new task fixtures as known divergences.
- Rolling over is a pure function (file and today in, fields out), shared in spirit by both implementations and checked by `spec/fixtures/repeat/roll.json`.
- Reminders only fire while an app can run: mobile schedules Android alarms from the vault whenever it opens or syncs. The desktop app only sets and shows reminders: a browser cannot wake a closed page, so notifications there would only work while Jotter is open, and were left out (they are kept on the branch `feat/desktop-reminder-notifications`). Moving or editing a reminder re-arms it.
- A month or year step clamps to the end of a shorter month, and the clamp sticks (31 January, 28 February, 28 March).
- Completing a recurring task is not completing it: the Done column never shows it. The history is in Git. If a visible log becomes necessary, a `completed` note in the body is the place for it, not a new key.

## Alternatives Considered

- **One file per occurrence.** Keeps a trail in the board, but piles up files, needs deterministic ids, and makes "done" and "archive" cleanup interact with recurrence.
- **iCalendar `RRULE` strings.** Complete and standard, but a large grammar to parse identically in two languages, for rules this app does not need.
- **A nested `schedule:` block** holding all dates. Tidy, but it breaks the legacy aliases and the flat key rules of the existing format.
- **Absolute instants (UTC) for reminders.** Right for meetings across zones, wrong for personal reminders.
