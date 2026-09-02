import { reactive, toRefs, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';
import { useDebounceFn } from '@vueuse/core';
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
    timeblockStartHour: 6,
    timeblockEndHour: 18,
    isTimeblockSidebarOpen: false,
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

      const startHour = state.timeblockStartHour ?? 6;
      state.timeblockStartHour = startHour;

      const endHour = state.timeblockEndHour ?? 18;
      state.timeblockEndHour = endHour;

      const sidebarOpen = state.isTimeblockSidebarOpen ?? false;
      state.isTimeblockSidebarOpen = sidebarOpen;

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

  // Watch for theme changes and apply to document element & meta theme-color
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

    // Sync PWA window title bar color via meta theme-color
    try {
      const bgBase =
        typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement).getPropertyValue('--theme-bg-base').trim() : '';
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor && bgBase) {
        metaThemeColor.setAttribute('content', bgBase);
      }
    } catch {
      // Ignore errors in non-browser environments
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
  const debouncedSave = useDebounceFn(async () => {
    if (skipSave) return;
    try {
      await saveSettings({ ...state });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, 500);

  watch(
    state,
    () => {
      debouncedSave();
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

  const toggleTimeblockSidebar = (forceState?: boolean) => {
    state.isTimeblockSidebarOpen = forceState !== undefined ? forceState : !state.isTimeblockSidebarOpen;
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

  const updateSettings = (updates: Partial<AppSettings>) => {
    Object.assign(state, updates);
  };

  return {
    ...toRefs(state),
    settings: state,
    updateSettings,
    loadSettings,
    toggleHideDoneColumn,
    toggleSidebar,
    toggleTimeblockSidebar,
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
