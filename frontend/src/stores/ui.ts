import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', () => {
  const lastViewMode = ref<string>(localStorage.getItem('jotter-last-view-mode') || 'board');

  watch(lastViewMode, (newMode) => {
    localStorage.setItem('jotter-last-view-mode', newMode || 'board');
  }, { flush: 'sync' });

  const setLastViewMode = (mode: string) => {
    lastViewMode.value = mode;
    localStorage.setItem('jotter-last-view-mode', mode || 'board');
  };

  return {
    lastViewMode,
    setLastViewMode,
  };
});
