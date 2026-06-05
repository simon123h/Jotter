export type ViewMode = 'board' | 'list' | 'matrix' | 'time' | 'settings';
export type SortBy = 'alpha' | 'mru';

function localRune<T>(key: string, defaultValue: T) {
  let val = $state<T>(defaultValue);

  // Load initial value
  const item = localStorage.getItem(key);
  if (item !== null) {
    try {
      if (typeof defaultValue === 'boolean') {
        val = (item === 'true') as T;
      } else if (typeof defaultValue === 'number') {
        val = Number(item) as T;
      } else if (typeof defaultValue === 'object' && defaultValue !== null) {
        val = JSON.parse(item) as T;
      } else {
        val = item as T;
      }
    } catch {
      val = defaultValue;
    }
  }

  return {
    get value() {
      return val;
    },
    set value(newVal: T) {
      val = newVal;
      if (newVal === null || newVal === undefined) {
        localStorage.removeItem(key);
      } else if (typeof newVal === 'object') {
        localStorage.setItem(key, JSON.stringify(newVal));
      } else {
        localStorage.setItem(key, String(newVal));
      }
    }
  };
}

export const settingsStore = (() => {
  const hideDoneColumn = localRune('jotter-hide-done-column', true);
  const isSidebarOpen = localRune('jotter-sidebar-open', true);
  const currentTheme = localRune('jotter-theme', 'nordic-light');
  const viewMode = localRune<ViewMode>('jotter-view-mode', 'board');
  const activeProjectId = localRune('jotter-active-project-id', 'default');
  const thresholdDays = localRune('jotter-matrix-threshold', 7);
  const pinnedProjectIds = localRune<string[]>('jotter-pinned-projects', []);
  const sortBy = localRune<SortBy>('jotter-projects-sort', 'alpha');
  const hideAddTaskButton = localRune('jotter-hide-add-task-button', true);

  return {
    get hideDoneColumn() { return hideDoneColumn.value; },
    set hideDoneColumn(v) { hideDoneColumn.value = v; },

    get isSidebarOpen() { return isSidebarOpen.value; },
    set isSidebarOpen(v) { isSidebarOpen.value = v; },

    get currentTheme() { return currentTheme.value; },
    set currentTheme(v) { currentTheme.value = v; },

    get viewMode() { return viewMode.value; },
    set viewMode(v) { viewMode.value = v; },

    get activeProjectId() { return activeProjectId.value; },
    set activeProjectId(v) { activeProjectId.value = v; },

    get thresholdDays() { return thresholdDays.value; },
    set thresholdDays(v) { thresholdDays.value = v; },

    get pinnedProjectIds() { return pinnedProjectIds.value; },
    set pinnedProjectIds(v) { pinnedProjectIds.value = v; },

    get sortBy() { return sortBy.value; },
    set sortBy(v) { sortBy.value = v; },

    get hideAddTaskButton() { return hideAddTaskButton.value; },
    set hideAddTaskButton(v) { hideAddTaskButton.value = v; },

    toggleHideDoneColumn() {
      hideDoneColumn.value = !hideDoneColumn.value;
    },
    toggleSidebar() {
      isSidebarOpen.value = !isSidebarOpen.value;
    },
    setTheme(theme: string) {
      currentTheme.value = theme;
    },
    setViewMode(mode: ViewMode) {
      viewMode.value = mode;
    },
    setActiveProjectId(projectId: string) {
      activeProjectId.value = projectId;
    },
    setThresholdDays(days: number) {
      thresholdDays.value = days;
    },
    pinProject(projectId: string) {
      if (!pinnedProjectIds.value.includes(projectId)) {
        pinnedProjectIds.value = [...pinnedProjectIds.value, projectId];
      }
    },
    unpinProject(projectId: string) {
      pinnedProjectIds.value = pinnedProjectIds.value.filter((id) => id !== projectId);
    },
    setSortBy(sort: SortBy) {
      sortBy.value = sort;
    },
    updateProjectMru(projectId: string) {
      localStorage.setItem(`jotter-project-mru-${projectId}`, String(Date.now()));
    },
    getProjectMru(projectId: string): number {
      return Number(localStorage.getItem(`jotter-project-mru-${projectId}`) || '0');
    },
    toggleHideAddTaskButton() {
      hideAddTaskButton.value = !hideAddTaskButton.value;
    }
  };
})();
