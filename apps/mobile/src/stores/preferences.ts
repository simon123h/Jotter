import { capacitorKeyValue as preferences } from '@/data/keyValue';
import { VIEWS, type Hidden, type View } from '@/stores/columns';

/**
 * What the user last looked at, kept in the device's preferences (not in web storage, which Android may clear).
 * Nothing here throws: unreadable or unwritable preferences fall back to the defaults.
 */

const LAST_PROJECT_KEY = 'jotter_lite_last_project';
const VIEW_KEY = 'jotter_lite_view';
const HIDDEN_KEY = 'jotter_lite_hidden';
const PINNED_KEY = 'jotter_lite_pinned';

const save = (key: string, value: string) => void preferences.set(key, value).catch(() => undefined);

export const defaultHidden = (): Record<View, Hidden> => ({
  board: { done: false, archive: false, postponed: true },
  tags: { done: true, archive: true, postponed: true },
  planning: { done: true, archive: true, postponed: true },
});

export const recallHidden = async (vaultId: string): Promise<Record<View, Hidden>> => {
  const hidden = defaultHidden();
  try {
    const stored = JSON.parse((await preferences.get(`${HIDDEN_KEY}:${vaultId}`)) ?? '{}');
    for (const v of VIEWS) {
      if (typeof stored?.[v]?.done === 'boolean') hidden[v].done = stored[v].done;
      if (typeof stored?.[v]?.archive === 'boolean') hidden[v].archive = stored[v].archive;
      if (typeof stored?.[v]?.postponed === 'boolean') hidden[v].postponed = stored[v].postponed;
    }
  } catch {
    // Unreadable: the defaults apply
  }
  return hidden;
};
export const rememberHidden = (vaultId: string, hidden: Record<View, Hidden>) => save(`${HIDDEN_KEY}:${vaultId}`, JSON.stringify(hidden));

export const recallView = async (vaultId: string): Promise<View> => {
  try {
    const stored = await preferences.get(`${VIEW_KEY}:${vaultId}`);
    return VIEWS.find((v) => v === stored) ?? 'board';
  } catch {
    return 'board';
  }
};
export const rememberView = (vaultId: string, view: View) => save(`${VIEW_KEY}:${vaultId}`, view);

export const recallPinned = async (vaultId: string): Promise<string[]> => {
  try {
    const stored = JSON.parse((await preferences.get(`${PINNED_KEY}:${vaultId}`)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};
export const rememberPinned = (vaultId: string, pinned: string[]) => save(`${PINNED_KEY}:${vaultId}`, JSON.stringify(pinned));

export const recallProject = async (vaultId: string): Promise<string | null> => {
  try {
    return await preferences.get(`${LAST_PROJECT_KEY}:${vaultId}`);
  } catch {
    return null;
  }
};
export const rememberProject = (vaultId: string, projectId: string | null) => {
  if (projectId) save(`${LAST_PROJECT_KEY}:${vaultId}`, projectId);
};
