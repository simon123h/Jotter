import { describe, it, expect, beforeEach } from 'vitest';
import { settingsStore } from '@/stores/settings';

describe('Settings Store', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset singleton settingsStore properties to defaults for test isolation
    settingsStore.hideDoneColumn = true;
    settingsStore.isSidebarOpen = true;
    settingsStore.currentTheme = 'nordic-light';
    settingsStore.viewMode = 'board';
    settingsStore.activeProjectId = 'default';
    settingsStore.thresholdDays = 7;
    settingsStore.pinnedProjectIds = [];
    settingsStore.sortBy = 'alpha';
  });

  it('initializes with default values', () => {
    expect(settingsStore.hideDoneColumn).toBe(true);
    expect(settingsStore.isSidebarOpen).toBe(true);
    expect(settingsStore.currentTheme).toBe('nordic-light');
    expect(settingsStore.viewMode).toBe('board');
    expect(settingsStore.activeProjectId).toBe('default');
    expect(settingsStore.thresholdDays).toBe(7);
    expect(settingsStore.pinnedProjectIds).toEqual([]);
    expect(settingsStore.sortBy).toBe('alpha');
  });

  it('can toggle hideDoneColumn', () => {
    expect(settingsStore.hideDoneColumn).toBe(true);
    settingsStore.toggleHideDoneColumn();
    expect(settingsStore.hideDoneColumn).toBe(false);
    expect(localStorage.getItem('jotter-hide-done-column')).toBe('false');
  });

  it('can pin and unpin projects', () => {
    settingsStore.pinProject('project-1');
    expect(settingsStore.pinnedProjectIds).toEqual(['project-1']);
    expect(JSON.parse(localStorage.getItem('jotter-pinned-projects') || '[]')).toEqual(['project-1']);

    settingsStore.unpinProject('project-1');
    expect(settingsStore.pinnedProjectIds).toEqual([]);
    expect(JSON.parse(localStorage.getItem('jotter-pinned-projects') || '[]')).toEqual([]);
  });

  it('can set and retrieve MRU project active timestamp', () => {
    const before = Date.now();
    settingsStore.updateProjectMru('project-2');
    const mru = settingsStore.getProjectMru('project-2');
    expect(mru).toBeGreaterThanOrEqual(before);
  });
});
