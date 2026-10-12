# Recurring Tasks and Reminders

A task can **come back** after you complete it, and it can **remind you** at a time you choose. Both work in the desktop app and in the Android app, and both are stored in the task's Markdown file, so a vault synced between devices carries them along.

## Recurring tasks

Open a task and choose **Repeat**: *Daily*, *Weekly*, *Monthly*, *Yearly*, or *Custom* (every 3 days, every 2 weeks, and so on). **Comes back** says how the next day is counted:

* **After it is completed**: the next day is counted from the day you complete it. "Every 3 days" means three days after you tick it off.
* **On the due date's rhythm**: the next day is counted from the task's due date, so "weekly" stays on the same weekday. Complete it late and it catches up to the next day on the rhythm instead of drifting.

### What happens when you complete it

Completing a recurring task (moving it to **Done**, ticking its circle, or a bulk action) does not finish it. The task **stays in its column** and:

* gets its next day as the **due date** (when it has one),
* is **postponed** until that day, so it reappears when it is time (see [Postponing Tasks](./postponing)),
* moves its planned date (when it is a date, not a keyword like *this week*) and its reminders by the same number of days,
* has its checklist unticked.

There is always **one** task, never a pile of copies. If you miss a day, the task simply stays overdue until you complete it. The history of what you completed is in your Git history, if you use one.

Month steps stop at the end of a shorter month (31 January plus one month is 28 February).

On mobile, **Undo** in the message after completing puts the old dates back.

## Reminders

Under **Reminders** in the task, add one or more date and time entries. A reminder is the clock time on the wall wherever you are: 09:00 is 09:00 in every time zone.

**On the phone**, reminders are Android notifications that the system shows at their time, also while Jotter is closed. The first time you add a reminder, Jotter asks for permission to show notifications. Jotter arms the reminders after it has read the vault, so a reminder you add on the desktop is armed on the phone the next time the app opens and has synced. Reminders only fire for the vault that is open: switching to another vault replaces the armed reminders with that vault's. Tapping a notification opens the task. If Android restricts exact alarms for the app, a reminder can come a few minutes late.

**On the desktop**, reminders are browser notifications, shown **while Jotter is open** (a browser cannot wake a closed page). The browser asks for permission with the first reminder you add. A reminder that came up to 15 minutes before you opened Jotter is still shown.

Reminders of tasks in **Done** or **Archive** are not shown. A reminder does not repeat by itself: for one that comes back, make the task recurring and give it a reminder. The reminder then moves along with each roll-over.

## In the file

```yaml
repeat:
  every: 2
  unit: week        # day, week, month or year
  from: due         # completion (the default) or due
reminders:
  - "2026-10-14T09:00"
```

The details are in the [file format](./format-spec) and in the [specification](https://github.com/simon123h/Jotter/blob/main/spec/FORMAT.md).
