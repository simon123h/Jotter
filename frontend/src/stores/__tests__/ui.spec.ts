import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from '@/stores/ui';

describe('UI Store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('initializes with default value "board"', () => {
    const store = useUiStore();
    expect(store.lastViewMode).toBe('board');
  });

  it('can set and persist lastViewMode to localStorage', () => {
    const store = useUiStore();
    store.setLastViewMode('matrix');
    expect(store.lastViewMode).toBe('matrix');
    expect(localStorage.getItem('jotter-last-view-mode')).toBe('matrix');
  });

  it('initializes with a value from localStorage if present', () => {
    localStorage.setItem('jotter-last-view-mode', 'list');
    const store = useUiStore();
    expect(store.lastViewMode).toBe('list');
  });

  it('can manage and persist collapsed columns per project', () => {
    const store = useUiStore();
    expect(store.isColumnCollapsed('proj-1', 'todo')).toBe(false);

    // Toggle collapse on
    store.toggleColumnCollapse('proj-1', 'todo');
    expect(store.isColumnCollapsed('proj-1', 'todo')).toBe(true);

    // Toggle collapse off
    store.toggleColumnCollapse('proj-1', 'todo');
    expect(store.isColumnCollapsed('proj-1', 'todo')).toBe(false);
  });

  it('can set and persist collapseEmptyColumns toggle', () => {
    const store = useUiStore();
    expect(store.collapseEmptyColumns).toBe(false);

    store.setCollapseEmptyColumns(true);
    expect(store.collapseEmptyColumns).toBe(true);
    expect(localStorage.getItem('jotter-collapse-empty-columns')).toBe('true');
  });
});
