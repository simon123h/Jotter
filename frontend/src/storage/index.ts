import type { StorageAdapter } from './types';
import { HttpStorageAdapter } from './httpAdapter';
import { DemoStorageAdapter } from './demoAdapter';
import { isDemoMode } from '@/platform';

export function createStorageAdapter(): StorageAdapter {
  return isDemoMode ? new DemoStorageAdapter() : new HttpStorageAdapter();
}

let instance: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  return (instance ??= createStorageAdapter());
}

/** Replace the active adapter (pass null to reset to the platform default). Intended for tests. */
export function setStorageAdapter(adapter: StorageAdapter | null): void {
  instance = adapter;
}
