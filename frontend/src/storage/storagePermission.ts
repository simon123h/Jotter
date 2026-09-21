import { registerPlugin } from '@capacitor/core';

export interface StoragePermissionPluginInterface {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  setStatusBarColor(options: { color: string; darkIcons?: boolean }): Promise<void>;
}

export const StoragePermission = registerPlugin<StoragePermissionPluginInterface>('StoragePermission');
