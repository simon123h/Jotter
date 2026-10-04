import type { Task } from '@/types';

export type TriageSortOrder = 'created-asc' | 'created-desc' | 'priority' | 'due';

const PRIORITY_WEIGHTS: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

const createdAt = (task: Task) => new Date(task.created_at || 0).getTime();

/** Returns a sorted copy; the input is left untouched. Tasks without a due date sort last. */
export function sortTriageTasks(tasks: Task[], order: TriageSortOrder): Task[] {
  const list = [...tasks];
  switch (order) {
    case 'created-asc':
      return list.sort((a, b) => createdAt(a) - createdAt(b));
    case 'created-desc':
      return list.sort((a, b) => createdAt(b) - createdAt(a));
    case 'priority':
      return list.sort((a, b) => (PRIORITY_WEIGHTS[b.priority || 'none'] || 0) - (PRIORITY_WEIGHTS[a.priority || 'none'] || 0));
    case 'due':
      return list.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    default:
      return list;
  }
}
