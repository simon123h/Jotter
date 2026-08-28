import { ref } from 'vue';
import { defineStore } from 'pinia';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

  const scheduleRemoval = (id: string, duration: number) => {
    if (timerMap.has(id)) {
      clearTimeout(timerMap.get(id)!);
    }
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    timerMap.set(id, timer);
  };

  const addToast = (toast: Omit<Toast, 'id'>): string => {
    // Deduplicate: If an identical toast is already active on screen, refresh its timer instead of stacking
    const existing = toasts.value.find((t) => t.message === toast.message && t.type === toast.type);
    if (existing) {
      const duration = toast.duration ?? existing.duration ?? 4000;
      if (duration > 0) {
        scheduleRemoval(existing.id, duration);
      }
      return existing.id;
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? 4000;
    const newToast: Toast = {
      id,
      duration,
      ...toast,
    };
    toasts.value.push(newToast);

    if (duration > 0) {
      scheduleRemoval(id, duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    if (timerMap.has(id)) {
      clearTimeout(timerMap.get(id)!);
      timerMap.delete(id);
    }
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  const error = (message: string, title?: string, duration = 5000) => {
    return addToast({ type: 'error', message, title, duration });
  };

  const success = (message: string, title?: string, duration = 3500) => {
    return addToast({ type: 'success', message, title, duration });
  };

  const warning = (message: string, title?: string, duration = 4000) => {
    return addToast({ type: 'warning', message, title, duration });
  };

  const info = (message: string, title?: string, duration = 3500) => {
    return addToast({ type: 'info', message, title, duration });
  };

  const clear = () => {
    timerMap.forEach((timer) => clearTimeout(timer));
    timerMap.clear();
    toasts.value = [];
  };

  return {
    toasts,
    addToast,
    removeToast,
    error,
    success,
    warning,
    info,
    clear,
  };
});
