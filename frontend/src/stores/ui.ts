import { ref } from 'vue';
import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';

export const STICKY_VIEW_MODES = ['board', 'list', 'matrix', 'time', 'tag', 'review'] as const;
export const SESSION_VIEW_MODES = ['canvas', 'triage'] as const;
export type StickyViewMode = (typeof STICKY_VIEW_MODES)[number];
export type SessionViewMode = (typeof SESSION_VIEW_MODES)[number];

export const useUiStore = defineStore('ui', () => {
  const isMobileViewsSheetOpen = ref(false);
  const lastViewMode = useStorage<string>('jotter-last-view-mode', 'board', localStorage, { flush: 'sync' });
  if (!STICKY_VIEW_MODES.includes(lastViewMode.value as any)) {
    lastViewMode.value = 'board';
  }
  const collapsedColumns = useStorage<Record<string, string[]>>('jotter-collapsed-columns', {}, localStorage, { flush: 'sync' });
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
    collapseEmptyColumns,
    virtualColumnLayouts,
    setLastViewMode,
    isColumnCollapsed,
    toggleColumnCollapse,
    setCollapseEmptyColumns,
    getVirtualColumnLayout,
    setVirtualColumnLayout,
  };
});
