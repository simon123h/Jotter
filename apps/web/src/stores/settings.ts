import { reactive, ref, toRefs, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';
import { useDebounceFn } from '@vueuse/core';
import { getSettings, saveSettings } from '@/api';
import { HORIZONS, exampleViews, newViewId, type SavedView } from '@jotter/task-filter';
import type { AppSettings } from '@/types';

export type SortBy = 'alpha' | 'manual';

const TIMEBLOCK_SIDEBAR_STORAGE_KEY = 'jotter-timeblock-sidebar-open';
const SIDEBAR_STORAGE_KEY = 'jotter-sidebar-open';

const getStoredBool = (key: string, defaultVal: boolean): boolean => {
  const val = localStorage.getItem(key);
  if (val === null) return defaultVal;
  return val === 'true';
};

export const useSettingsStore = defineStore('settings', () => {
  const state = reactive<AppSettings>({
    hideDoneColumn: true,
    hideArchiveColumn: true,
    planningHorizon: 'today',
    views: null,
    isSidebarOpen: getStoredBool(SIDEBAR_STORAGE_KEY, true),
    currentTheme: 'nordic-light',
    themeFollowsSystem: false,
    lightTheme: 'nordic-light',
    darkTheme: 'midnight',
    thresholdDays: 7,
    pinnedProjectIds: [],
    captureProjectId: null,
    sortBy: 'alpha',
    hideAddTaskButton: true,
    projectOrder: [],
    language: '',
    tagColors: {},
    timeblockStartHour: 6,
    timeblockEndHour: 18,
    isTimeblockSidebarOpen: getStoredBool(TIMEBLOCK_SIDEBAR_STORAGE_KEY, false),
    doneCleanPeriod: null,
    autoCommit: true,
  });

  let skipSave = false;
  // The settings of the vault are read: what is missing in them (the views) can be offered now
  const loaded = ref(false);

  const loadSettings = async () => {
    try {
      skipSave = true;
      loaded.value = false; // a vault switch reads them again, and the examples are offered again if it has no views
      const settings = await getSettings();
      Object.assign(state, settings);

      // Drop obsolete interval settings (auto-commit is automatic now)
      delete (state as unknown as Record<string, unknown>).autoSyncInterval;
      delete (state as unknown as Record<string, unknown>).autoCommitInterval;

      // Ensure defaults for optional/partial loads
      // A source that does not know views (the static demo) must not leave the ones of the vault before
      if (!('views' in settings)) state.views = null;
      if (!state.pinnedProjectIds) state.pinnedProjectIds = [];
      if (!state.projectOrder) state.projectOrder = [];
      if (!state.language) state.language = '';
      if (!state.tagColors) state.tagColors = {};
      // The static demo keeps whatever was stored in the browser
      if (!HORIZONS.includes(settings.planningHorizon)) state.planningHorizon = 'today';

      const startHour = state.timeblockStartHour ?? 6;
      state.timeblockStartHour = startHour;

      const endHour = state.timeblockEndHour ?? 18;
      state.timeblockEndHour = endHour;

      const sidebarOpen = state.isTimeblockSidebarOpen ?? false;
      state.isTimeblockSidebarOpen = sidebarOpen;
      localStorage.setItem(TIMEBLOCK_SIDEBAR_STORAGE_KEY, String(sidebarOpen));
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(state.isSidebarOpen));

      applyThemeToDocument(activeTheme());

      await nextTick();
      skipSave = false;
      loaded.value = true;
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
      const metaThemeColors = document.querySelectorAll('meta[name="theme-color"]');
      if (metaThemeColors.length > 0 && bgBase) {
        metaThemeColors.forEach((el) => el.setAttribute('content', bgBase));
      }
    } catch {
      // Ignore errors in non-browser environments
    }
  };

  // The device's light or dark setting, followed while the choice is "follow system"
  const darkQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;
  const deviceDark = ref(!!darkQuery?.matches);
  darkQuery?.addEventListener?.('change', (event) => (deviceDark.value = event.matches));

  function activeTheme(): string {
    if (!state.themeFollowsSystem) return state.currentTheme;
    return (deviceDark.value ? state.darkTheme : state.lightTheme) || state.currentTheme;
  }

  watch(
    activeTheme,
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
      localStorage.setItem(TIMEBLOCK_SIDEBAR_STORAGE_KEY, String(state.isTimeblockSidebarOpen));
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(state.isSidebarOpen));
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
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(state.isSidebarOpen));
  };

  const toggleTimeblockSidebar = (forceState?: boolean) => {
    state.isTimeblockSidebarOpen = forceState !== undefined ? forceState : !state.isTimeblockSidebarOpen;
    localStorage.setItem(TIMEBLOCK_SIDEBAR_STORAGE_KEY, String(state.isTimeblockSidebarOpen));
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

  // Saved views. A vault that never had any gets the examples once; the list is the user's after that, also when empty.
  const offerExampleViews = (names: { upcoming: string; recent: string }) => {
    if (!state.views) state.views = exampleViews(names);
  };

  const addView = (name: string, query: string): SavedView => {
    const views = state.views ?? [];
    const view = { id: newViewId(name, views), name: name.trim(), query: query.trim() };
    state.views = [...views, view];
    return view;
  };

  const updateView = (id: string, changes: Partial<Pick<SavedView, 'name' | 'query'>>) => {
    state.views = (state.views ?? []).map((view) => (view.id === id ? { ...view, ...changes } : view));
  };

  const removeView = (id: string) => {
    state.views = (state.views ?? []).filter((view) => view.id !== id);
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    Object.assign(state, updates);
  };

  return {
    ...toRefs(state),
    settings: state,
    loaded,
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
    offerExampleViews,
    addView,
    updateView,
    removeView,
  };
});
