import { Capacitor } from '@capacitor/core';
import type { StorageAdapter } from './types';
import { HttpStorageAdapter } from './httpAdapter';
import { CapacitorFsStorageAdapter } from './capacitorFsAdapter';

export const isNativeMobile = Capacitor.isNativePlatform();

let storageInstance: StorageAdapter;

if (isNativeMobile) {
  storageInstance = new CapacitorFsStorageAdapter();
} else {
  storageInstance = new HttpStorageAdapter();
}

export function getStorageAdapter(): StorageAdapter {
  return storageInstance;
}

export const activeStorage = storageInstance;
