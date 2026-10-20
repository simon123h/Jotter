import { describe, it, expect } from 'vitest';
import type { Bucket, Task } from '@jotter/vault-format';
import { isoDay } from '@jotter/task-filter';
import { columnsFor, planningColumns } from '@/stores/columns';
import { plannedSlot, slotValue, PLAN_SLOTS } from '@jotter/task-filter';
import { defaultHidden } from '@/stores/preferences';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  project_id: 'p',
  title: id,
  bucket: 'todo',
  position: 1000,
  tags: [],
  attachments: [],
  body: '',
  created_at: '',
  updated_at: '',
  ...extra,
});
const bucket = (name: string, position: number): Bucket => ({ name, title: name, position, is_default: name === 'todo' }) as Bucket;
const buckets = [bucket('todo', 1), bucket('done', 2), bucket('archive', 3)];

describe('columnsFor', () => {
  it('keeps a task planned ahead in its own column, and leaves it out while it lies beyond the horizon of the view', () => {
    const tasks = [task('a'), task('b', { planned_date: isoDay(3) })];
    const hidden = defaultHidden();
    const cols = columnsFor('board', buckets, tasks, hidden);
    expect(cols.map((c) => c.key)).toEqual(['todo', 'done', 'archive']);
    expect(cols[0]!.tasks.map((t) => t.id)).toEqual(['a']);
    hidden.board.horizon = 'all';
    const shown = columnsFor('board', buckets, tasks, hidden);
    expect(shown.map((c) => c.key)).toEqual(['todo', 'done', 'archive']);
    expect(shown[0]!.tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('collects tasks of an unknown bucket in a trailing column', () => {
    const cols = columnsFor('board', buckets, [task('x', { bucket: 'gone' })], defaultHidden());
    expect(cols.at(-1)).toMatchObject({ key: '__other', tasks: [{ id: 'x' }] });
  });

  it('lists a task under each of its tags and the rest as untagged, most urgent first', () => {
    const tasks = [task('low', { tags: ['a'], priority: 'low' }), task('hot', { tags: ['a', 'b'], priority: 'urgent' }), task('none')];
    const cols = columnsFor('tags', buckets, tasks, defaultHidden());
    expect(cols.map((c) => c.key)).toEqual(['tag:a', 'tag:b', 'tag:']);
    expect(cols[0]!.tasks.map((t) => t.id)).toEqual(['hot', 'low']);
    expect(cols[2]!.tasks.map((t) => t.id)).toEqual(['none']);
  });

  it('puts a planned value in the tab of the time it covers, and the slipped ones only when there are some', () => {
    const now = new Date(2026, 9, 14); // Wednesday, 14 October 2026: its week is 2026-W42, ends on the 18th
    const planned = (value: string | undefined) => task(String(value), { planned_date: value });
    const tasks = [
      planned('2026-10-14'),
      planned('2026-10-15'),
      planned('2026-10-17'),
      planned('2026-W42'),
      planned('2026-10-25'),
      planned('2026-10'),
      planned('2026-W44'),
      planned('2026-12'),
      planned('2026-10-01'),
      planned(undefined),
    ];
    const cols = planningColumns(tasks, now);
    const ids = (key: string) => cols.find((c) => c.key === key)!.tasks.map((t) => t.id);
    expect(cols.map((c) => c.key)).toEqual([
      'planned:slipped',
      'planned:today',
      'planned:tomorrow',
      'planned:week',
      'planned:month',
      'planned:later',
      'planned:none',
    ]);
    expect(ids('planned:slipped')).toEqual(['2026-10-01']);
    expect(ids('planned:today')).toEqual(['2026-10-14']);
    expect(ids('planned:tomorrow')).toEqual(['2026-10-15']);
    expect(ids('planned:week')).toEqual(['2026-10-17', '2026-W42']);
    expect(ids('planned:month')).toEqual(['2026-10-25', '2026-10']);
    expect(ids('planned:later')).toEqual(['2026-W44', '2026-12']);
    expect(ids('planned:none')).toEqual(['undefined']);
    expect(planningColumns([planned('2026-10-14')], now).map((c) => c.key)).not.toContain('planned:slipped');
  });

  it('files every stretch of time under itself, also a month in its last days when the week reaches into the next month', () => {
    const now = new Date(2026, 9, 29); // Thursday 29 October: the week goes on to Sunday 1 November
    for (const slot of PLAN_SLOTS.filter((s) => s !== 'slipped')) expect(plannedSlot(slotValue(slot, now) || undefined, now)).toBe(slot);
  });

  it('leaves done tasks out of the tag and planning views unless they are shown', () => {
    const tasks = [task('open'), task('finished', { bucket: 'done' })];
    const hidden = defaultHidden();
    const unplanned = (h: typeof hidden) =>
      columnsFor('planning', buckets, tasks, h)
        .at(-1)!
        .tasks.map((t) => t.id);
    expect(unplanned(hidden)).toEqual(['open']);
    hidden.planning.done = false;
    expect(unplanned(hidden).sort()).toEqual(['finished', 'open']);
  });
});
