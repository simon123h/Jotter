import { registerPlugin } from '@capacitor/core';

export interface StoragePermissionPluginInterface {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
}

export const StoragePermission = registerPlugin<StoragePermissionPluginInterface>('StoragePermission');
