import type { Task, Bucket } from '@jotter/vault-format';
import { t } from '@/i18n';
import { isPostponed } from '@/dates';
import { PLANNED_CHOICES, plannedKey, plannedLabel } from '@/planned';

/** How the tabs group the tasks: by column of the board, by tag, or by planned date. */
export type View = 'board' | 'tags' | 'planning';
export const VIEWS: View[] = ['board', 'tags', 'planning'];

/** Which finished tasks a view leaves out. The tag and planning views list what is still to do, the board everything. */
export type Hidden = { done: boolean; archive: boolean; postponed: boolean };

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

/** Where a task is shown: a task postponed to a later day is in the Postponed column, whatever its own column. */
export const shownBucket = (task: Task) => (isPostponed(task) ? 'postponed' : task.bucket);

export const isHiddenIn = (task: Task, hidden: Hidden) =>
  (task.bucket === 'done' && hidden.done) ||
  (task.bucket === 'archive' && hidden.archive) ||
  (shownBucket(task) === 'postponed' && hidden.postponed);

/** Tasks the tag and planning views list, most urgent first. */
export const openTasksOf = (tasks: Task[], hidden: Hidden): Task[] => tasks.filter((task) => !isHiddenIn(task, hidden)).sort(byUrgency);

/** One column per bucket, plus one for tasks that name a bucket the project does not have. */
export function boardColumns(buckets: Bucket[], tasks: Task[], hidden: Hidden): Column[] {
  const known = new Set([...buckets.map((b) => b.name), 'postponed']);
  const all: Column[] = buckets.map((b) => ({ key: b.name, title: b.title, bucket: b.name, tasks: [] as Task[] }));
  // Postponed tasks have a column even when the project defines none, just before Done
  if (!all.some((c) => c.key === 'postponed')) {
    const at = all.findIndex((c) => c.key === 'done');
    all.splice(at < 0 ? all.length : at, 0, { key: 'postponed', title: t('postponed.title'), bucket: 'postponed', tasks: [] });
  }
  for (const col of all) col.tasks = tasks.filter((task) => shownBucket(task) === col.key);
  const cols = all.filter((c) => !hidden[c.key as keyof Hidden]);
  const orphans = tasks.filter((task) => !known.has(shownBucket(task)));
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

/** One column per planned date the menu offers, the dates tasks carry besides those, then the unplanned tasks. */
export function planningColumns(open: Task[]): Column[] {
  const used = [...new Set(open.map((task) => plannedKey(task.planned_date)).filter(Boolean))];
  const extra = used.filter((key) => !(PLANNED_CHOICES as readonly string[]).includes(key)).sort();
  return [
    ...[...PLANNED_CHOICES, ...extra].map((key) => ({
      key: `planned:${key}`,
      title: plannedLabel(key),
      bucket: null,
      value: key,
      tasks: open.filter((task) => plannedKey(task.planned_date) === key),
    })),
    { key: 'planned:', title: t('planned.none'), bucket: null, value: '', tasks: open.filter((task) => !task.planned_date?.trim()) },
  ];
}

/** The columns a view shows for the given tasks (already narrowed by the search filter). */
export function columnsFor(view: View, buckets: Bucket[], tasks: Task[], hidden: Record<View, Hidden>): Column[] {
  if (view === 'board') return boardColumns(buckets, tasks, hidden.board);
  const open = openTasksOf(tasks, hidden[view]);
  return view === 'tags' ? tagColumns(open) : planningColumns(open);
}
