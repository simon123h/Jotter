import type { Task, Bucket } from '@jotter/vault-format';
import { t } from '@/i18n';
import { isBeyond, today, type Horizon } from '@jotter/task-filter';
import { PLAN_SLOTS, plannedSlot, slotValue, type PlanSlot } from '@/planned';

/** How the tabs group the tasks: by column of the board, by tag, or by planned date. */
export type View = 'board' | 'tags' | 'planning';
export const VIEWS: View[] = ['board', 'tags', 'planning'];

/**
 * Which tasks a view leaves out: the finished ones (the tag and planning views list what is still to do, the board
 * everything) and those planned further ahead than the horizon.
 */
export type Hidden = { done: boolean; archive: boolean; horizon: Horizon };

export interface Column {
  key: string;
  title: string;
  /** The bucket name, or null for tasks whose bucket the project does not define (and in the other views). */
  bucket: string | null;
  /** The tag or the planned date the tab stands for ('' for Untagged and Unplanned). */
  value?: string;
  tasks: Task[];
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** The order in the tag and planning tabs: priority first, then the nearest due date, then the board position. */
const byUrgency = (a: Task, b: Task) =>
  (PRIORITY_RANK[a.priority ?? ''] ?? 4) - (PRIORITY_RANK[b.priority ?? ''] ?? 4) ||
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
  a.position - b.position;

/** A task planned beyond the horizon stays in its own column; it is only left out while the view's horizon is short. */
export const isHiddenIn = (task: Task, hidden: Hidden) =>
  (task.bucket === 'done' && hidden.done) ||
  (task.bucket === 'archive' && hidden.archive) ||
  isBeyond(task.planned_date, hidden.horizon, today());

/** Tasks the tag and planning views list, most urgent first. */
export const openTasksOf = (tasks: Task[], hidden: Hidden): Task[] => tasks.filter((task) => !isHiddenIn(task, hidden)).sort(byUrgency);

/** One column per bucket, plus one for tasks that name a bucket the project does not have. */
export function boardColumns(buckets: Bucket[], tasks: Task[], hidden: Hidden): Column[] {
  const known = new Set(buckets.map((b) => b.name));
  const cols: Column[] = buckets
    .filter((b) => !(b.name === 'done' && hidden.done) && !(b.name === 'archive' && hidden.archive))
    .map((b) => ({
      key: b.name,
      title: b.title,
      bucket: b.name,
      tasks: tasks.filter((task) => task.bucket === b.name && !isHiddenIn(task, hidden)),
    }));
  const orphans = tasks.filter((task) => !known.has(task.bucket) && !isHiddenIn(task, hidden));
  if (orphans.length) cols.push({ key: '__other', title: '', bucket: null, tasks: orphans });
  return cols;
}

/** One column per tag (a task with two tags is in both), then the tasks without tags. */
export function tagColumns(open: Task[]): Column[] {
  const tags = [...new Set(open.flatMap((task) => task.tags))].sort();
  return [
    ...tags.map((tag) => ({
      key: `tag:${tag}`,
      title: `#${tag}`,
      bucket: null,
      value: tag,
      tasks: open.filter((task) => task.tags.includes(tag)),
    })),
    { key: 'tag:', title: t('tags.untagged'), bucket: null, value: '', tasks: open.filter((task) => !task.tags.length) },
  ];
}

const SLOT_TITLES: Record<PlanSlot, () => string> = {
  slipped: () => t('planned.slipped'),
  today: () => t('planned.today'),
  tomorrow: () => t('planned.tomorrow'),
  week: () => t('planned.thisWeek'),
  month: () => t('planned.thisMonth'),
  later: () => t('planned.later'),
  none: () => t('planned.none'),
};

/**
 * One column for each stretch of time ahead: what has slipped (only when something has), today, tomorrow, the rest of the
 * week, the rest of the month, later, and the tasks that are not planned.
 */
export function planningColumns(open: Task[], now: Date = new Date()): Column[] {
  return PLAN_SLOTS.map((slot) => ({
    key: `planned:${slot}`,
    title: SLOT_TITLES[slot](),
    bucket: null,
    value: slotValue(slot, now),
    tasks: open.filter((task) => plannedSlot(task.planned_date, now) === slot),
  })).filter((column) => column.key !== 'planned:slipped' || column.tasks.length);
}

/** The columns a view shows for the given tasks (already narrowed by the search filter). */
export function columnsFor(view: View, buckets: Bucket[], tasks: Task[], hidden: Record<View, Hidden>): Column[] {
  if (view === 'board') return boardColumns(buckets, tasks, hidden.board);
  const open = openTasksOf(tasks, hidden[view]);
  return view === 'tags' ? tagColumns(open) : planningColumns(open);
}
