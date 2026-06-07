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

  it('manages virtual column layouts with custom defaults', () => {
    const store = useUiStore();
    // Default to list if none specified
    expect(store.getVirtualColumnLayout('matrix-view', 'q1')).toBe('list');
    // Accepts custom default layout like grid-3
    expect(store.getVirtualColumnLayout('matrix-view', 'q1', 'grid-3')).toBe('grid-3');

    // Can set layout
    store.setVirtualColumnLayout('matrix-view', 'q1', 'grid-2');
    expect(store.getVirtualColumnLayout('matrix-view', 'q1', 'grid-3')).toBe('grid-2');
    expect(JSON.parse(localStorage.getItem('jotter-virtual-column-layouts') || '{}')).toEqual({
      'matrix-view-q1': 'grid-2',
    });
  });
});

