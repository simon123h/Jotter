import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export type Sheet =
  | { type: 'task'; id: string }
  | { type: 'quickadd' }
  | { type: 'projects' }
  | { type: 'vaults' }
  | { type: 'filter' }
  | { type: 'settings' }
  | { type: 'drawer' };

/** Which overlay is open. One at a time; the back button closes it. */
export const useUiStore = defineStore('ui', () => {
  const sheet = ref<Sheet | null>(null);
  const toast = ref<{ message: string; action?: { label: string; run: () => void } } | null>(null);
  /** The board column in view, so quick add files a task where the user is looking. */
  const activeColumn = ref(0);
  /** The column position while swiping, fractional (1.5 is halfway to the third column): drives the tab indicator. */
  const columnProgress = ref(0);
  /** The search field is open in the app bar. */
  const searching = ref(false);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const isOpen = computed(() => sheet.value !== null);

  const open = (next: Sheet) => {
    sheet.value = next;
  };
  const close = () => {
    sheet.value = null;
  };
  /** A short message at the top. With an action (Undo) it stays longer, since it needs a thumb. */
  const showToast = (message: string, action?: { label: string; run: () => void }) => {
    toast.value = { message, action };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.value = null), action ? 6000 : 2500);
  };
  const dismissToast = () => {
    clearTimeout(toastTimer);
    toast.value = null;
  };

  return { sheet, toast, dismissToast, activeColumn, columnProgress, searching, isOpen, open, close, showToast };
});
