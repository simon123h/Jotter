import { registerPlugin } from '@capacitor/core';

export interface StoragePermissionPluginInterface {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  setStatusBarColor(options: { color: string; darkIcons?: boolean }): Promise<void>;
}

export const StoragePermission = registerPlugin<StoragePermissionPluginInterface>('StoragePermission');

/** Asks for all-files access when the vault folders need it. Outside Android (browser, tests) there is nothing to ask. */
export async function ensureStoragePermission(): Promise<boolean> {
  try {
    const { granted } = await StoragePermission.checkPermission();
    if (granted) return true;
    return (await StoragePermission.requestPermission()).granted;
  } catch {
    return true;
  }
}
