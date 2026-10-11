import { useToastStore } from '@/stores/toast';

export function useToast() {
  const toastStore = useToastStore();

  return {
    error: toastStore.error,
    success: toastStore.success,
    warning: toastStore.warning,
    info: toastStore.info,
    addToast: toastStore.addToast,
    removeToast: toastStore.removeToast,
    clear: toastStore.clear,
  };
}
