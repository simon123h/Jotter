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

  const addToast = (toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: Toast = {
      id,
      duration: toast.duration ?? 4000,
      ...toast,
    };
    toasts.value.push(newToast);

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
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
