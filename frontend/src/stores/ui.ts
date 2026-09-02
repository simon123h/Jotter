import { defineStore } from 'pinia';
import { useStorage } from '@vueuse/core';

export const useUiStore = defineStore('ui', () => {
  const lastViewMode = useStorage<string>('jotter-last-view-mode', 'board', undefined, { flush: 'sync' });
  const collapsedColumns = useStorage<Record<string, string[]>>('jotter-collapsed-columns', {}, undefined, { flush: 'sync' });
  const collapseEmptyColumns = useStorage<boolean>('jotter-collapse-empty-columns', false, undefined, { flush: 'sync' });
  const virtualColumnLayouts = useStorage<Record<string, 'list' | 'grid-2' | 'grid-3'>>('jotter-virtual-column-layouts', {}, undefined, {
    flush: 'sync',
  });

  const setLastViewMode = (mode: string) => {
    lastViewMode.value = mode;
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
