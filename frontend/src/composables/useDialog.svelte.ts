export interface DialogOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

let isOpenVal = $state(false);
let titleVal = $state('');
let messageVal = $state('');
let typeVal = $state<'success' | 'error' | 'warning' | 'info'>('info');
let confirmTextVal = $state('OK');
let cancelTextVal = $state('Cancel');
let showCancelVal = $state(false);
let resolveCallback: ((value: boolean) => void) | null = null;

export const dialogState = {
  get isOpen() { return isOpenVal; },
  set isOpen(v) { isOpenVal = v; },

  get title() { return titleVal; },
  set title(v) { titleVal = v; },

  get message() { return messageVal; },
  set message(v) { messageVal = v; },

  get type() { return typeVal; },
  set type(v) { typeVal = v; },

  get confirmText() { return confirmTextVal; },
  set confirmText(v) { confirmTextVal = v; },

  get cancelText() { return cancelTextVal; },
  set cancelText(v) { cancelTextVal = v; },

  get showCancel() { return showCancelVal; },
  set showCancel(v) { showCancelVal = v; }
};

export function useDialog() {
  const showDialog = (options: DialogOptions): Promise<boolean> => {
    titleVal = options.title || '';
    messageVal = options.message;
    typeVal = options.type || 'info';
    confirmTextVal = options.confirmText || 'OK';
    cancelTextVal = options.cancelText || 'Cancel';
    showCancelVal = options.showCancel || false;
    isOpenVal = true;

    return new Promise((resolve) => {
      resolveCallback = resolve;
    });
  };

  const handleConfirm = () => {
    isOpenVal = false;
    if (resolveCallback) {
      resolveCallback(true);
      resolveCallback = null;
    }
  };

  const handleCancel = () => {
    isOpenVal = false;
    if (resolveCallback) {
      resolveCallback(false);
      resolveCallback = null;
    }
  };

  return {
    get isOpen() { return isOpenVal; },
    get title() { return titleVal; },
    get message() { return messageVal; },
    get type() { return typeVal; },
    get confirmText() { return confirmTextVal; },
    get cancelText() { return cancelTextVal; },
    get showCancel() { return showCancelVal; },
    showDialog,
    handleConfirm,
    handleCancel,
  };
}
