import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export type Sheet =
  | { type: 'task'; id: string }
  | { type: 'quickadd' }
  | { type: 'projects' }
  | { type: 'vaults' }
  | { type: 'filter' }
  | { type: 'settings' };

/** Which overlay is open. One at a time; the back button closes it. */
export const useUiStore = defineStore('ui', () => {
  const sheet = ref<Sheet | null>(null);
  const toast = ref<string | null>(null);
  /** The board column in view, so quick add files a task where the user is looking. */
  const activeColumn = ref(0);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const isOpen = computed(() => sheet.value !== null);

  const open = (next: Sheet) => {
    sheet.value = next;
  };
  const close = () => {
    sheet.value = null;
  };
  const showToast = (message: string) => {
    toast.value = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.value = null), 2500);
  };

  return { sheet, toast, activeColumn, isOpen, open, close, showToast };
});
