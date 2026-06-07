import { ref, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';
import { getSettings, saveSettings } from '@/api';
import type { AppSettings } from '@/types';

export type SortBy = 'alpha' | 'mru';

export const useSettingsStore = defineStore('settings', () => {
  // Default values matching backend defaults
  const hideDoneColumn = ref(true);
  const hideArchiveColumn = ref(true);
  const isSidebarOpen = ref(true);
  const currentTheme = ref('nordic-light');
  const thresholdDays = ref(7);
  const pinnedProjectIds = ref<string[]>([]);
  const sortBy = ref<SortBy>('alpha');
  const hideAddTaskButton = ref(true);
  const projectMru = ref<Record<string, number>>({});

  let skipSave = false;

  const loadSettings = async () => {
    try {
      skipSave = true;
      const settings = await getSettings();
      hideDoneColumn.value = settings.hideDoneColumn;
      hideArchiveColumn.value = settings.hideArchiveColumn;
      isSidebarOpen.value = settings.isSidebarOpen;
      currentTheme.value = settings.currentTheme || 'nordic-light';
      thresholdDays.value = settings.thresholdDays ?? 7;
      pinnedProjectIds.value = settings.pinnedProjectIds || [];
      sortBy.value = (settings.sortBy as SortBy) || 'alpha';
      hideAddTaskButton.value = settings.hideAddTaskButton ?? true;
      projectMru.value = settings.projectMru ? { ...settings.projectMru } : {};

      await nextTick();
      skipSave = false;
    } catch (err) {
      const isTest = typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test';
      if (!isTest) {
        console.error('Failed to load settings:', err);
      }
      skipSave = false;
    }
  };

  // Trigger load immediately when store is instantiated
  loadSettings();

  // Watch for theme changes and apply to document element
  const applyThemeToDocument = (theme: string) => {
    if (typeof document === 'undefined') return;
    const docClasses = document.documentElement.classList;
    docClasses.forEach((c) => {
      if (c.startsWith('theme-')) {
        docClasses.remove(c);
      }
    });
    if (theme && theme !== 'nordic-light') {
      docClasses.add('theme-' + theme);
    }
  };

  watch(
    currentTheme,
    (newTheme) => {
      applyThemeToDocument(newTheme);
    },
    { immediate: true }
  );

  // Debounced save
  let saveTimeout: any = null;
  const triggerSave = () => {
    if (skipSave) return;

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        const payload: AppSettings = {
          hideDoneColumn: hideDoneColumn.value,
          hideArchiveColumn: hideArchiveColumn.value,
          isSidebarOpen: isSidebarOpen.value,
          currentTheme: currentTheme.value,
          thresholdDays: thresholdDays.value,
          pinnedProjectIds: [...pinnedProjectIds.value],
          sortBy: sortBy.value,
          hideAddTaskButton: hideAddTaskButton.value,
          projectMru: { ...projectMru.value },
        };
        await saveSettings(payload);
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    }, 500);
  };

  watch(
    [
      hideDoneColumn,
      hideArchiveColumn,
      isSidebarOpen,
      currentTheme,
      thresholdDays,
      pinnedProjectIds,
      sortBy,
      hideAddTaskButton,
      projectMru,
    ],
    () => {
      triggerSave();
    },
    { deep: true }
  );

  // Actions
  const toggleHideDoneColumn = () => {
    hideDoneColumn.value = !hideDoneColumn.value;
  };

  const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
  };

  const setTheme = (theme: string) => {
    currentTheme.value = theme;
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
    projectMru.value[projectId] = Date.now();
  };

  const getProjectMru = (projectId: string): number => {
    return projectMru.value[projectId] || 0;
  };

  const toggleHideAddTaskButton = () => {
    hideAddTaskButton.value = !hideAddTaskButton.value;
  };

  return {
    hideDoneColumn,
    hideArchiveColumn,
    isSidebarOpen,
    currentTheme,
    thresholdDays,
    pinnedProjectIds,
    sortBy,
    hideAddTaskButton,
    projectMru,
    loadSettings,
    toggleHideDoneColumn,
    toggleSidebar,
    setTheme,
    setThresholdDays,
    pinProject,
    unpinProject,
    setSortBy,
    updateProjectMru,
    getProjectMru,
    toggleHideAddTaskButton,
  };
});
