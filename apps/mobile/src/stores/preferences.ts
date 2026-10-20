import { capacitorKeyValue as preferences } from '@/data/keyValue';
import { HORIZONS, type Horizon } from '@jotter/task-filter';
import { VIEWS, type Hidden, type View } from '@/stores/columns';

/**
 * What the user last looked at, kept in the device's preferences (not in web storage, which Android may clear).
 * Nothing here throws: unreadable or unwritable preferences fall back to the defaults.
 */

const LAST_PROJECT_KEY = 'jotter_lite_last_project';
const VIEW_KEY = 'jotter_lite_view';
const HIDDEN_KEY = 'jotter_lite_hidden';
const PINNED_KEY = 'jotter_lite_pinned';
const LAYOUT_KEY = 'jotter_lite_layout';
const COLLAPSED_KEY = 'jotter_lite_collapsed';

const save = (key: string, value: string) => void preferences.set(key, value).catch(() => undefined);

export const defaultHidden = (): Record<View, Hidden> => ({
  board: { done: false, archive: false, horizon: 'today' },
  tags: { done: true, archive: true, horizon: 'today' },
  planning: { done: true, archive: true, horizon: 'all' },
});

export const recallHidden = async (vaultId: string): Promise<Record<View, Hidden>> => {
  const hidden = defaultHidden();
  try {
    const stored = JSON.parse((await preferences.get(`${HIDDEN_KEY}:${vaultId}`)) ?? '{}');
    for (const v of VIEWS) {
      if (typeof stored?.[v]?.done === 'boolean') hidden[v].done = stored[v].done;
      if (typeof stored?.[v]?.archive === 'boolean') hidden[v].archive = stored[v].archive;
    }
  } catch {
    // Unreadable: the defaults apply
  }
  return hidden;
};
/** The horizon is not kept here: it follows the default of the vault unless a view has its own (see `recallHorizons`). */
export const rememberHidden = (vaultId: string, hidden: Record<View, Hidden>) =>
  save(
    `${HIDDEN_KEY}:${vaultId}`,
    JSON.stringify(Object.fromEntries(VIEWS.map((v) => [v, { done: hidden[v].done, archive: hidden[v].archive }])))
  );

const HORIZONS_KEY = 'jotter_lite_horizons';

/** The horizons the user set for a view; a view without one follows the default of the vault. */
export const recallHorizons = async (vaultId: string): Promise<Record<View, Horizon | null>> => {
  const horizons: Record<View, Horizon | null> = { board: null, tags: null, planning: null };
  try {
    const stored = JSON.parse((await preferences.get(`${HORIZONS_KEY}:${vaultId}`)) ?? '{}');
    for (const v of VIEWS) if (HORIZONS.includes(stored?.[v])) horizons[v] = stored[v] as Horizon;
    // Before the horizon there was a switch for postponed tasks: off showed everything. The planning view looks ahead anyway.
    const legacy = JSON.parse((await preferences.get(`${HIDDEN_KEY}:${vaultId}`)) ?? '{}');
    for (const v of VIEWS) if (v !== 'planning' && horizons[v] === null && legacy?.[v]?.postponed === false) horizons[v] = 'all';
  } catch {
    // Unreadable: the views follow the default
  }
  return horizons;
};
export const rememberHorizons = (vaultId: string, horizons: Record<View, Horizon | null>) =>
  save(`${HORIZONS_KEY}:${vaultId}`, JSON.stringify(horizons));

export const recallView = async (vaultId: string): Promise<View> => {
  try {
    const stored = await preferences.get(`${VIEW_KEY}:${vaultId}`);
    return VIEWS.find((v) => v === stored) ?? 'board';
  } catch {
    return 'board';
  }
};
export const rememberView = (vaultId: string, view: View) => save(`${VIEW_KEY}:${vaultId}`, view);

/** Pins used to live here; they are in the vault's settings.json now. Read once to move them over. */
export const recallPinned = async (vaultId: string): Promise<string[]> => {
  try {
    const stored = JSON.parse((await preferences.get(`${PINNED_KEY}:${vaultId}`)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

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

/** The columns as tabs you swipe between, or as one list with a section for each column. */
export type Layout = 'tabs' | 'list';

export const recallLayout = async (): Promise<Layout> => {
  try {
    return (await preferences.get(LAYOUT_KEY)) === 'list' ? 'list' : 'tabs';
  } catch {
    return 'tabs';
  }
};
export const rememberLayout = (layout: Layout) => save(LAYOUT_KEY, layout);

/** The sections the user collapsed or expanded in the list layout, by column key. A section not in it has its default. */
export const recallCollapsed = async (vaultId: string): Promise<Record<string, boolean>> => {
  try {
    const stored = JSON.parse((await preferences.get(`${COLLAPSED_KEY}:${vaultId}`)) ?? '{}');
    const collapsed: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(stored ?? {})) if (typeof value === 'boolean') collapsed[key] = value;
    return collapsed;
  } catch {
    return {};
  }
};
export const rememberCollapsed = (vaultId: string, collapsed: Record<string, boolean>) =>
  save(`${COLLAPSED_KEY}:${vaultId}`, JSON.stringify(collapsed));
