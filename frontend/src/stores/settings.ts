import { reactive, toRefs, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';
import { getSettings, saveSettings } from '@/api';
import type { AppSettings } from '@/types';

export type SortBy = 'alpha' | 'manual';

export const useSettingsStore = defineStore('settings', () => {
  const state = reactive<AppSettings>({
    hideDoneColumn: true,
    hideArchiveColumn: true,
    hidePostponedColumn: true,
    isSidebarOpen: true,
    currentTheme: 'nordic-light',
    thresholdDays: 7,
    pinnedProjectIds: [],
    sortBy: 'alpha',
    hideAddTaskButton: true,
    projectOrder: [],
    gitRemoteUrl: '',
    language: '',
    tagColors: {},
    autoSyncInterval: 0,
  });

  let skipSave = false;

  const loadSettings = async () => {
    try {
      skipSave = true;
      const settings = await getSettings();
      Object.assign(state, settings);

      // Ensure defaults for optional/partial loads
      if (!state.pinnedProjectIds) state.pinnedProjectIds = [];
      if (!state.projectOrder) state.projectOrder = [];
      if (!state.gitRemoteUrl) state.gitRemoteUrl = '';
      if (!state.language) state.language = '';
      if (!state.tagColors) state.tagColors = {};
      if (state.autoSyncInterval === undefined) state.autoSyncInterval = 0;
      if (state.hidePostponedColumn === undefined) state.hidePostponedColumn = true;

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
    () => state.currentTheme,
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
        await saveSettings({ ...state });
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    }, 500);
  };

  watch(
    state,
    () => {
      triggerSave();
    },
    { deep: true }
  );

  // Actions
  const toggleHideDoneColumn = () => {
    state.hideDoneColumn = !state.hideDoneColumn;
  };

  const toggleSidebar = () => {
    state.isSidebarOpen = !state.isSidebarOpen;
  };

  const setTheme = (theme: string) => {
    state.currentTheme = theme;
  };

  const setThresholdDays = (days: number) => {
    state.thresholdDays = days;
  };

  const pinProject = (projectId: string) => {
    if (!state.pinnedProjectIds.includes(projectId)) {
      state.pinnedProjectIds.push(projectId);
    }
  };

  const unpinProject = (projectId: string) => {
    state.pinnedProjectIds = state.pinnedProjectIds.filter((id) => id !== projectId);
  };

  const setSortBy = (sort: SortBy) => {
    state.sortBy = sort;
  };

  const setProjectOrder = (order: string[]) => {
    state.projectOrder = order;
  };

  const toggleHideAddTaskButton = () => {
    state.hideAddTaskButton = !state.hideAddTaskButton;
  };

  const setTagColor = (tag: string, color: string) => {
    if (!state.tagColors) {
      state.tagColors = {};
    }
    const normalized = tag.trim().toLowerCase();
    if (color) {
      state.tagColors[normalized] = color;
    } else {
      delete state.tagColors[normalized];
    }
  };

  const removeTagColor = (tag: string) => {
    if (state.tagColors) {
      delete state.tagColors[tag.trim().toLowerCase()];
    }
  };

  const setAutoSyncInterval = (minutes: number) => {
    state.autoSyncInterval = minutes;
  };

  return {
    ...toRefs(state),
    loadSettings,
    toggleHideDoneColumn,
    toggleSidebar,
    setTheme,
    setThresholdDays,
    pinProject,
    unpinProject,
    setSortBy,
    setProjectOrder,
    toggleHideAddTaskButton,
    setTagColor,
    removeTagColor,
    setAutoSyncInterval,
  };
});
