import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '@/stores/settings';

// Mock the API calls
vi.mock('@/api', () => ({
  getSettings: vi.fn(() =>
    Promise.resolve({
      hideDoneColumn: true,
      hideArchiveColumn: true,
      isSidebarOpen: true,
      currentTheme: 'nordic-light',
      thresholdDays: 7,
      pinnedProjectIds: [],
      sortBy: 'alpha',
      hideAddTaskButton: true,
      projectMru: {},
    })
  ),
  saveSettings: vi.fn(() => Promise.resolve()),
}));

describe('Settings Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('initializes with default values', () => {
    const store = useSettingsStore();
    expect(store.hideDoneColumn).toBe(true);
    expect(store.isSidebarOpen).toBe(true);
    expect(store.currentTheme).toBe('nordic-light');
    expect(store.thresholdDays).toBe(7);
    expect(store.pinnedProjectIds).toEqual([]);
    expect(store.sortBy).toBe('alpha');
  });

  it('can toggle hideDoneColumn', () => {
    const store = useSettingsStore();
    expect(store.hideDoneColumn).toBe(true);
    store.toggleHideDoneColumn();
    expect(store.hideDoneColumn).toBe(false);
  });

  it('can pin and unpin projects', () => {
    const store = useSettingsStore();
    store.pinProject('project-1');
    expect(store.pinnedProjectIds).toEqual(['project-1']);

    store.unpinProject('project-1');
    expect(store.pinnedProjectIds).toEqual([]);
  });

  it('can set and retrieve MRU project active timestamp', () => {
    const store = useSettingsStore();
    const before = Date.now();
    store.updateProjectMru('project-2');
    const mru = store.getProjectMru('project-2');
    expect(mru).toBeGreaterThanOrEqual(before);
  });
});
