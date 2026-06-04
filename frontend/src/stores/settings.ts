import { ref, watch, type Ref } from 'vue';
import { defineStore } from 'pinia';

export type ViewMode = 'board' | 'list' | 'matrix' | 'time' | 'settings';
export type SortBy = 'alpha' | 'mru';

/**
 * A utility helper to create a reactive ref synchronized with localStorage.
 */
function useLocalStorageRef<T>(key: string, defaultValue: T): Ref<T> {
  const getStoredValue = (): T => {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    try {
      if (typeof defaultValue === 'boolean') {
        return (item === 'true') as T;
      }
      if (typeof defaultValue === 'number') {
        return Number(item) as T;
      }
      if (typeof defaultValue === 'object' && defaultValue !== null) {
        return JSON.parse(item) as T;
      }
      return item as T;
    } catch {
      return defaultValue;
    }
  };

  const state = ref<T>(getStoredValue()) as Ref<T>;

  watch(
    state,
    (newValue) => {
      if (newValue === null || newValue === undefined) {
        localStorage.removeItem(key);
      } else if (typeof newValue === 'object') {
        localStorage.setItem(key, JSON.stringify(newValue));
      } else {
        localStorage.setItem(key, String(newValue));
      }
    },
    { deep: true, flush: 'sync' }
  );

  return state;
}

export const useSettingsStore = defineStore('settings', () => {
  // Settings synchronized with localStorage
  const hideDoneColumn = useLocalStorageRef('jotter-hide-done-column', false);
  const isSidebarOpen = useLocalStorageRef('jotter-sidebar-open', true);
  const currentTheme = useLocalStorageRef('jotter-theme', 'nordic-light');
  const viewMode = useLocalStorageRef<ViewMode>('jotter-view-mode', 'board');
  const activeProjectId = useLocalStorageRef('jotter-active-project-id', 'default');
  const thresholdDays = useLocalStorageRef('jotter-matrix-threshold', 7);
  const pinnedProjectIds = useLocalStorageRef<string[]>('jotter-pinned-projects', []);
  const sortBy = useLocalStorageRef<SortBy>('jotter-projects-sort', 'alpha');
  const hideAddTaskButton = useLocalStorageRef('jotter-hide-add-task-button', false);

  // Action methods to change states directly or let views change refs
  const toggleHideDoneColumn = () => {
    hideDoneColumn.value = !hideDoneColumn.value;
  };

  const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
  };

  const setTheme = (theme: string) => {
    currentTheme.value = theme;
  };

  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode;
  };

  const setActiveProjectId = (projectId: string) => {
    activeProjectId.value = projectId;
  };

  const setThresholdDays = (days: number) => {
    thresholdDays.value = days;
  };

  const pinProject = (projectId: string) => {
    if (!pinnedProjectIds.value.includes(projectId)) {
      pinnedProjectIds.value.push(projectId);
    }
  };

  const unpinProject = (projectId: string) => {
    pinnedProjectIds.value = pinnedProjectIds.value.filter((id) => id !== projectId);
  };

  const setSortBy = (sort: SortBy) => {
    sortBy.value = sort;
  };

  const updateProjectMru = (projectId: string) => {
    localStorage.setItem(`jotter-project-mru-${projectId}`, String(Date.now()));
  };

  const getProjectMru = (projectId: string): number => {
    return Number(localStorage.getItem(`jotter-project-mru-${projectId}`) || '0');
  };

  const toggleHideAddTaskButton = () => {
    hideAddTaskButton.value = !hideAddTaskButton.value;
  };

  return {
    hideDoneColumn,
    isSidebarOpen,
    currentTheme,
    viewMode,
    activeProjectId,
    thresholdDays,
    pinnedProjectIds,
    sortBy,
    hideAddTaskButton,
    toggleHideDoneColumn,
    toggleSidebar,
    setTheme,
    setViewMode,
    setActiveProjectId,
    setThresholdDays,
    pinProject,
    unpinProject,
    setSortBy,
    updateProjectMru,
    getProjectMru,
    toggleHideAddTaskButton,
  };
});
