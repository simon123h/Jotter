import { describe, it, expect } from 'vitest';
import { sortTriageTasks } from '../triageSort';
import { createMockTask } from '@/__tests__/factories';

const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

describe('sortTriageTasks', () => {
  const tasks = [
    createMockTask({ id: 'b', created_at: '2026-01-02T00:00:00Z', priority: 'low', due_date: '2026-03-01' }),
    createMockTask({ id: 'a', created_at: '2026-01-01T00:00:00Z', priority: 'urgent', due_date: undefined }),
    createMockTask({ id: 'c', created_at: '2026-01-03T00:00:00Z', priority: undefined, due_date: '2026-02-01' }),
  ];

  it('sorts oldest first by default order', () => {
    expect(ids(sortTriageTasks(tasks, 'created-asc'))).toEqual(['a', 'b', 'c']);
  });

  it('sorts newest first', () => {
    expect(ids(sortTriageTasks(tasks, 'created-desc'))).toEqual(['c', 'b', 'a']);
  });

  it('sorts by priority, highest first, unset last', () => {
    expect(ids(sortTriageTasks(tasks, 'priority'))).toEqual(['a', 'b', 'c']);
  });

  it('sorts by due date with undated tasks last', () => {
    expect(ids(sortTriageTasks(tasks, 'due'))).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate its input', () => {
    const before = ids(tasks);
    sortTriageTasks(tasks, 'created-desc');
    expect(ids(tasks)).toEqual(before);
  });
});
