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
});
