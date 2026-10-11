import { Preferences } from '@capacitor/preferences';

/** Small persistent key/value storage, for the vault registry and settings. */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const capacitorKeyValue: KeyValue = {
  async get(key) {
    return (await Preferences.get({ key })).value;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
};

export class MemoryKeyValue implements KeyValue {
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.map.set(key, value);
  }
  async remove(key: string) {
    this.map.delete(key);
  }
}
