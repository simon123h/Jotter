import { ref } from 'vue';

export interface DialogOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const isOpen = ref(false);
const title = ref('');
const message = ref('');
const type = ref<'success' | 'error' | 'warning' | 'info'>('info');
const confirmText = ref('OK');
const cancelText = ref('Cancel');
const showCancel = ref(false);
let resolveCallback: ((value: boolean) => void) | null = null;

export function useDialog() {
  const showDialog = (options: DialogOptions): Promise<boolean> => {
    title.value = options.title || '';
    message.value = options.message;
    type.value = options.type || 'info';
    confirmText.value = options.confirmText || 'OK';
    cancelText.value = options.cancelText || 'Cancel';
    showCancel.value = options.showCancel || false;
    isOpen.value = true;

    return new Promise((resolve) => {
      resolveCallback = resolve;
    });
  };

  const handleConfirm = () => {
    isOpen.value = false;
    if (resolveCallback) {
      resolveCallback(true);
      resolveCallback = null;
    }
  };

  const handleCancel = () => {
    isOpen.value = false;
    if (resolveCallback) {
      resolveCallback(false);
      resolveCallback = null;
    }
  };

  return {
    isOpen,
    title,
    message,
    type,
    confirmText,
    cancelText,
    showCancel,
    showDialog,
    handleConfirm,
    handleCancel,
  };
}
