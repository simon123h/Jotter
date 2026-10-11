import { describe, it, expect } from 'vitest';
import type { Bucket, Task } from '@jotter/vault-format';
import { isoDay } from '@/dates';
import { columnsFor } from '@/stores/columns';
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
  it('puts a postponed task in a virtual Postponed column before Done, hidden on the board by default', () => {
    const tasks = [task('a'), task('b', { postponed_until: isoDay(3) })];
    const hidden = defaultHidden();
    expect(columnsFor('board', buckets, tasks, hidden).map((c) => c.key)).toEqual(['todo', 'done', 'archive']);
    hidden.board.postponed = false;
    const cols = columnsFor('board', buckets, tasks, hidden);
    expect(cols.map((c) => c.key)).toEqual(['todo', 'postponed', 'done', 'archive']);
    expect(cols.find((c) => c.key === 'postponed')!.tasks.map((t) => t.id)).toEqual(['b']);
    expect(cols[0]!.tasks.map((t) => t.id)).toEqual(['a']);
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
