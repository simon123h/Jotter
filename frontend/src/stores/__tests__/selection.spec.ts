import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSelectionStore } from '@/stores/selection';
import type { Task } from '@/types';

describe('Selection Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with empty selection', () => {
    const store = useSelectionStore();
    expect(store.selectedIds.size).toBe(0);
    expect(store.hasSelection).toBe(false);
    expect(store.selectionCount).toBe(0);
  });

  it('can toggle task selection', () => {
    const store = useSelectionStore();
    store.toggleSelection('task-1');
    expect(store.isSelected('task-1')).toBe(true);
    expect(store.selectionCount).toBe(1);
    expect(store.hasSelection).toBe(true);

    store.toggleSelection('task-1');
    expect(store.isSelected('task-1')).toBe(false);
    expect(store.selectionCount).toBe(0);
    expect(store.hasSelection).toBe(false);
  });

  it('can select all tasks', () => {
    const store = useSelectionStore();
    const mockTasks = [
      { id: 'task-1' },
      { id: 'task-2' },
    ] as Task[];

    store.selectAll(mockTasks);
    expect(store.isSelected('task-1')).toBe(true);
    expect(store.isSelected('task-2')).toBe(true);
    expect(store.selectionCount).toBe(2);
  });

  it('can clear selection', () => {
    const store = useSelectionStore();
    store.toggleSelection('task-1');
    expect(store.selectionCount).toBe(1);

    store.clearSelection();
    expect(store.selectionCount).toBe(0);
    expect(store.hasSelection).toBe(false);
  });
});
