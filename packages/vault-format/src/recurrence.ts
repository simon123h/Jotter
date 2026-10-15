import type { RepeatRule, Task } from "./types";

/**
 * Rolling a recurring task over when it is completed (spec/FORMAT.md, "Recurring tasks").
 * Pure: the result depends on the task and `today` only, so two devices that complete the same task on the same
 * day write the same dates. Days are `YYYY-MM-DD` strings, calculated in UTC so that no time zone shifts them.
 */

const DAY_MS = 86_400_000;

const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);
const formatDay = (date: Date) => date.toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

/** `day` plus `steps` times `every` units. A month or year step clamps to the end of a shorter month. */
export function addUnits(
  day: string,
  every: number,
  unit: RepeatRule["unit"],
  steps = 1,
): string {
  const n = every * steps;
  const date = parseDay(day);
  if (unit === "day" || unit === "week")
    return formatDay(
      new Date(date.getTime() + n * (unit === "week" ? 7 : 1) * DAY_MS),
    );
  const months =
    date.getUTCFullYear() * 12 +
    date.getUTCMonth() +
    (unit === "year" ? n * 12 : n);
  const year = Math.floor(months / 12);
  const month = months % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return formatDay(
    new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))),
  );
}

/** The day the task comes back: from the completion day, or from the due day on the rhythm, never before today. */
export function nextOccurrence(
  rule: RepeatRule,
  due: string | undefined,
  today: string,
): string {
  if (rule.from === "due" && due) {
    let steps = 1;
    while (addUnits(due, rule.every, rule.unit, steps) < today) steps++;
    return addUnits(due, rule.every, rule.unit, steps);
  }
  return addUnits(today, rule.every, rule.unit);
}

/** The task as it is after its completion: it comes back on the next day and stays out of the way until then. */
export function rollOver(
  task: Task,
  today: string,
  defaultBucket: string,
  previousBucket?: string | null,
): Task {
  if (!task.repeat) return task;
  const following = nextOccurrence(task.repeat, task.due_date, today);

  const reminders = task.reminders ?? [];
  const plannedDay = task.planned_date && /^\d{4}-\d{2}-\d{2}$/.test(task.planned_date) ? task.planned_date : undefined;
  const anchor = task.due_date ?? reminders[0]?.slice(0, 10) ?? plannedDay ?? today; // reminders are sorted
  const shift = daysBetween(anchor, following);

  const rolled: Task = {
    ...task,
    bucket: previousBucket || defaultBucket,
    postponed_until: following,
    reminders: reminders.map(
      (r) => `${addUnits(r.slice(0, 10), shift, "day")}T${r.slice(11, 16)}`,
    ),
    body: task.body.replace(/^(\s*[-*+] \[)[xX](\])/gm, "$1 $2"),
    updated_at: new Date().toISOString(),
  };
  if (task.due_date) rolled.due_date = following;
  if (plannedDay) rolled.planned_date = addUnits(plannedDay, shift, "day");
  return rolled;
}
