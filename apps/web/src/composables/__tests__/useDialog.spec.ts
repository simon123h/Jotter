import { describe, it, expect } from 'vitest';
import { useDialog } from '../useDialog';

describe('useDialog Composable', () => {
  it('initializes with correct default values', () => {
    const dialog = useDialog();
    expect(dialog.isOpen.value).toBe(false);
    expect(dialog.title.value).toBe('');
    expect(dialog.message.value).toBe('');
    expect(dialog.type.value).toBe('info');
    expect(dialog.confirmText.value).toBe('OK');
    expect(dialog.cancelText.value).toBe('Cancel');
    expect(dialog.showCancel.value).toBe(false);
  });

  it('sets dialog options correctly on showDialog and handles confirm', async () => {
    const dialog = useDialog();

    const promise = dialog.showDialog({
      title: 'Alert Title',
      message: 'Alert Message',
      type: 'warning',
      confirmText: 'Yes',
      cancelText: 'No',
      showCancel: true,
    });

    expect(dialog.isOpen.value).toBe(true);
    expect(dialog.title.value).toBe('Alert Title');
    expect(dialog.message.value).toBe('Alert Message');
    expect(dialog.type.value).toBe('warning');
    expect(dialog.confirmText.value).toBe('Yes');
    expect(dialog.cancelText.value).toBe('No');
    expect(dialog.showCancel.value).toBe(true);

    // Click confirm
    dialog.handleConfirm();

    const result = await promise;
    expect(result).toBe(true);
    expect(dialog.isOpen.value).toBe(false);
  });

  it('handles cancel correctly', async () => {
    const dialog = useDialog();

    const promise = dialog.showDialog({
      message: 'Simple Message',
    });

    expect(dialog.isOpen.value).toBe(true);

    // Click cancel
    dialog.handleCancel();

    const result = await promise;
    expect(result).toBe(false);
    expect(dialog.isOpen.value).toBe(false);
  });
});
