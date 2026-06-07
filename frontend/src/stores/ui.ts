import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', () => {
  const lastViewMode = ref<string>(localStorage.getItem('jotter-last-view-mode') || 'board');

  const collapsedColumns = ref<Record<string, string[]>>(JSON.parse(localStorage.getItem('jotter-collapsed-columns') || '{}'));

  const collapseEmptyColumns = ref<boolean>(localStorage.getItem('jotter-collapse-empty-columns') === 'true');

  watch(
    lastViewMode,
    (newMode) => {
      localStorage.setItem('jotter-last-view-mode', newMode || 'board');
    },
    { flush: 'sync' }
  );

  watch(
    collapsedColumns,
    (newVal) => {
      localStorage.setItem('jotter-collapsed-columns', JSON.stringify(newVal));
    },
    { deep: true, flush: 'sync' }
  );

  watch(
    collapseEmptyColumns,
    (newVal) => {
      localStorage.setItem('jotter-collapse-empty-columns', String(newVal));
    },
    { flush: 'sync' }
  );

  const virtualColumnLayouts = ref<Record<string, 'list' | 'grid-2' | 'grid-3'>>(
    JSON.parse(localStorage.getItem('jotter-virtual-column-layouts') || '{}')
  );

  watch(
    virtualColumnLayouts,
    (newVal) => {
      localStorage.setItem('jotter-virtual-column-layouts', JSON.stringify(newVal));
    },
    { deep: true, flush: 'sync' }
  );

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
