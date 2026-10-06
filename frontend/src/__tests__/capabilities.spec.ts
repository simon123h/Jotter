import { describe, it, expect, afterEach } from 'vitest';
import { getCapabilities } from '@/capabilities';
import { setStorageAdapter } from '@/storage';
import type { StorageAdapter } from '@/storage/types';
import { HttpStorageAdapter } from '@/storage/httpAdapter';
import { CapacitorFsStorageAdapter } from '@/storage/capacitorFsAdapter';
import { DemoStorageAdapter } from '@/storage/demoAdapter';

describe('getCapabilities', () => {
  afterEach(() => setStorageAdapter(null));

  it('supports everything when the adapter declares nothing', () => {
    setStorageAdapter({} as StorageAdapter);
    expect(getCapabilities()).toEqual({ timeblocks: true, canvas: true, git: true });
  });

  it('lets an adapter switch individual features off', () => {
    setStorageAdapter({ capabilities: { canvas: false } } as StorageAdapter);
    expect(getCapabilities()).toEqual({ timeblocks: true, canvas: false, git: true });
  });

  it('declares the real runtimes', () => {
    expect(new HttpStorageAdapter().capabilities).toBeUndefined();
    expect(new CapacitorFsStorageAdapter().capabilities).toEqual({ timeblocks: false, canvas: false, git: false });
    expect(new DemoStorageAdapter().capabilities).toEqual({ git: false });
  });
});
