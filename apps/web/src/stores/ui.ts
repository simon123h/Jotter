import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';

export const STICKY_VIEW_MODES = ['board', 'list', 'matrix', 'time', 'tag', 'review'] as const;
export const SESSION_VIEW_MODES = ['canvas', 'triage'] as const;
export type StickyViewMode = (typeof STICKY_VIEW_MODES)[number];
export type SessionViewMode = (typeof SESSION_VIEW_MODES)[number];

/** The share of the board's height the lower pane takes, in percent. */
export const DOCK_HEIGHT_MIN = 15;
export const DOCK_HEIGHT_MAX = 80;
export const DOCK_HEIGHT_DEFAULT = 40;

export const useUiStore = defineStore('ui', () => {
  const isMobileViewsSheetOpen = ref(false);
  const lastViewMode = useStorage<string>('jotter-last-view-mode', 'board', localStorage, { flush: 'sync' });
  if (!STICKY_VIEW_MODES.includes(lastViewMode.value as any)) {
    lastViewMode.value = 'board';
  }
  const collapsedColumns = useStorage<Record<string, string[]>>('jotter-collapsed-columns', {}, localStorage, { flush: 'sync' });
  // The columns of a project that sit in the lower pane of the board (desktop), and how much of the board it takes
  const dockedColumns = useStorage<Record<string, string[]>>('jotter-docked-columns', {}, localStorage, { flush: 'sync' });
  const dockHeight = useStorage<number>('jotter-dock-height', DOCK_HEIGHT_DEFAULT, localStorage, { flush: 'sync' });
  const collapseEmptyColumns = useStorage<boolean>('jotter-collapse-empty-columns', false, localStorage, { flush: 'sync' });
  const virtualColumnLayouts = useStorage<Record<string, 'list' | 'grid-2' | 'grid-3'>>('jotter-virtual-column-layouts', {}, localStorage, {
    flush: 'sync',
  });

  const setLastViewMode = (mode: string) => {
    if (STICKY_VIEW_MODES.includes(mode as any)) {
      lastViewMode.value = mode;
    }
  };

  const isColumnCollapsed = (projectId: string, bucketName: string): boolean => {
    if (!projectId) return false;
    return collapsedColumns.value[projectId]?.includes(bucketName) || false;
  };

  const toggleColumnCollapse = (projectId: string, bucketName: string) => {
    if (!projectId) return;
    if (!collapsedColumns.value[projectId]) {
      collapsedColumns.value[projectId] = [];
    }
    const list = collapsedColumns.value[projectId];
    const index = list.indexOf(bucketName);
    if (index === -1) {
      list.push(bucketName);
    } else {
      list.splice(index, 1);
    }
    collapsedColumns.value = { ...collapsedColumns.value };
  };

  const isColumnDocked = (projectId: string, bucketName: string): boolean => {
    if (!projectId) return false;
    return dockedColumns.value[projectId]?.includes(bucketName) || false;
  };

  const toggleColumnDock = (projectId: string, bucketName: string) => {
    if (!projectId) return;
    const list = dockedColumns.value[projectId] ?? [];
    const next = list.includes(bucketName) ? list.filter((name) => name !== bucketName) : [...list, bucketName];
    dockedColumns.value = { ...dockedColumns.value, [projectId]: next };
  };

  const setDockHeight = (percent: number) => {
    if (!Number.isFinite(percent)) return;
    dockHeight.value = Math.round(Math.min(DOCK_HEIGHT_MAX, Math.max(DOCK_HEIGHT_MIN, percent)));
  };

  const setCollapseEmptyColumns = (val: boolean) => {
    collapseEmptyColumns.value = val;
  };

  const getVirtualColumnLayout = (
    viewName: string,
    colId: string,
    defaultLayout: 'list' | 'grid-2' | 'grid-3' = 'list'
  ): 'list' | 'grid-2' | 'grid-3' => {
    return virtualColumnLayouts.value[`${viewName}-${colId}`] || defaultLayout;
  };

  const setVirtualColumnLayout = (viewName: string, colId: string, layout: 'list' | 'grid-2' | 'grid-3') => {
    virtualColumnLayouts.value[`${viewName}-${colId}`] = layout;
    virtualColumnLayouts.value = { ...virtualColumnLayouts.value };
  };

  return {
    isMobileViewsSheetOpen,
    lastViewMode,
    collapsedColumns,
    dockedColumns,
    dockHeight,
    collapseEmptyColumns,
    virtualColumnLayouts,
    setLastViewMode,
    isColumnCollapsed,
    toggleColumnCollapse,
    isColumnDocked,
    toggleColumnDock,
    setDockHeight,
    setCollapseEmptyColumns,
    getVirtualColumnLayout,
    setVirtualColumnLayout,
  };
});
