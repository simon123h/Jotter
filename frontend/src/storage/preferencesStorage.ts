import { Preferences } from '@capacitor/preferences';
import { isNativeMobile } from './index';

/**
 * Storage adapter that uses @capacitor/preferences (SharedPreferences on Android)
 * when running natively on mobile, and falls back to window.localStorage in browser/desktop.
 *
 * It provides synchronous read/write operations via an in-memory cache synchronized with Preferences,
 * allowing full compatibility with VueUse useStorage or standard key-value access.
 */
class PersistentStorageService implements Storage {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized || !isNativeMobile) {
      this.initialized = true;
      return;
    }

    try {
      const { keys } = await Preferences.keys();
      for (const key of keys) {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          this.cache.set(key, value);
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              window.localStorage.setItem(key, value);
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Preferences plugin error handling
    } finally {
      this.initialized = true;
    }
  }

  public getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          return val;
        }
      } catch {
        // Ignore
      }
    }
    return this.cache.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.cache.set(key, value);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Ignore
      }
    }
    if (isNativeMobile) {
      Preferences.set({ key, value }).catch(() => {});
    }
  }

  public removeItem(key: string): void {
    this.cache.delete(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }
    if (isNativeMobile) {
      Preferences.remove({ key }).catch(() => {});
    }
  }

  public clear(): void {
    this.cache.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
      } catch {
        // Ignore
      }
    }
    if (isNativeMobile) {
      Preferences.clear().catch(() => {});
    }
  }

  public get length(): number {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.length;
      } catch {
        // Ignore
      }
    }
    return this.cache.size;
  }

  public key(index: number): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.key(index);
      } catch {
        // Ignore
      }
    }
    const keys = Array.from(this.cache.keys());
    return keys[index] ?? null;
  }
}

export const persistentStorageService = new PersistentStorageService();

export async function initPersistentStorage(): Promise<void> {
  await persistentStorageService.init();
}

export const persistentStorage: Storage =
  typeof window !== 'undefined' && window.localStorage && !isNativeMobile ? (window.localStorage as Storage) : persistentStorageService;
