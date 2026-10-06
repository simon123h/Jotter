import { getStorageAdapter } from '@/storage';
import { FULL_CAPABILITIES, type AdapterCapabilities } from '@/storage/types';

/** What the active storage runtime supports. Gate features on this, not on `isNativeMobile`. */
export function getCapabilities(): AdapterCapabilities {
  return { ...FULL_CAPABILITIES, ...getStorageAdapter().capabilities };
}
