import { nextTick } from 'vue';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '@/stores/settings';

// Mock the API calls
vi.mock('@/api', () => ({
  getSettings: vi.fn(() =>
    Promise.resolve({
      hideDoneColumn: true,
      hideArchiveColumn: true,
      isSidebarOpen: true,
      currentTheme: 'nordic-light',
      thresholdDays: 7,
      pinnedProjectIds: [],
      sortBy: 'alpha',
      hideAddTaskButton: true,
      projectOrder: [],
    })
  ),
  saveSettings: vi.fn(() => Promise.resolve()),
}));

describe('Settings Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('initializes with default values', () => {
    const store = useSettingsStore();
    expect(store.hideDoneColumn).toBe(true);
    expect(store.isSidebarOpen).toBe(true);
    expect(store.currentTheme).toBe('nordic-light');
    expect(store.thresholdDays).toBe(7);
    expect(store.pinnedProjectIds).toEqual([]);
    expect(store.sortBy).toBe('alpha');
  });

  it('can toggle hideDoneColumn', () => {
    const store = useSettingsStore();
    expect(store.hideDoneColumn).toBe(true);
    store.toggleHideDoneColumn();
    expect(store.hideDoneColumn).toBe(false);
  });

  it('can pin and unpin projects', () => {
    const store = useSettingsStore();
    store.pinProject('project-1');
    expect(store.pinnedProjectIds).toEqual(['project-1']);

    store.unpinProject('project-1');
    expect(store.pinnedProjectIds).toEqual([]);
  });

  it('can set and retrieve manual project order', () => {
    const store = useSettingsStore();
    store.setProjectOrder(['project-2', 'project-1']);
    expect(store.projectOrder).toEqual(['project-2', 'project-1']);
  });

  it('falls back to today when the stored horizon is none (the static demo keeps its settings in the browser)', async () => {
    const { getSettings } = await import('@/api');
    vi.mocked(getSettings).mockResolvedValueOnce({ planningHorizon: 'soon' } as any);
    const store = useSettingsStore();
    await vi.waitFor(() => expect(store.planningHorizon).toBe('today'));
  });

  it('keeps saved views: adds, changes and removes them', () => {
    const store = useSettingsStore();
    const view = store.addView(' Today ', ' planned:today ');
    expect(store.views).toEqual([{ id: 'today', name: 'Today', query: 'planned:today' }]);

    store.addView('Today', 'planned:tomorrow');
    expect(store.views!.map((v) => v.id)).toEqual(['today', 'today-2']);

    store.updateView(view.id, { name: 'Now' });
    expect(store.views![0]).toEqual({ id: 'today', name: 'Now', query: 'planned:today' });

    store.removeView('today');
    expect(store.views!.map((v) => v.id)).toEqual(['today-2']);
  });

  it('offers the example views only while the vault has never had a list of views', () => {
    const store = useSettingsStore();
    const names = { upcoming: 'Upcoming', recent: 'Recent' };
    store.offerExampleViews(names);
    expect(store.views!.map((v) => v.id)).toEqual(['upcoming', 'recent']);

    store.removeView('upcoming');
    store.removeView('recent');
    store.offerExampleViews(names);
    expect(store.views).toEqual([]);
  });

  it('reads the settings again for another vault, and offers the examples if it has no views', async () => {
    const { getSettings } = await import('@/api');
    const store = useSettingsStore();
    await vi.waitFor(() => expect(store.loaded).toBe(true));
    store.addView('Old vault view', 'tag:x');

    vi.mocked(getSettings).mockResolvedValueOnce({ views: null } as any);
    const reading = store.loadSettings();
    expect(store.loaded).toBe(false);
    await reading;
    expect(store.loaded).toBe(true);
    expect(store.views).toBeNull(); // nothing of the vault before is left; the sidebar offers the examples now

    vi.mocked(getSettings).mockResolvedValueOnce({} as any); // a source that does not know views
    await store.loadSettings();
    expect(store.views).toBeNull();
  });

  it('knows when the settings are read', async () => {
    const store = useSettingsStore();
    await vi.waitFor(() => expect(store.loaded).toBe(true));
  });

  it('drops obsolete auto-commit interval settings on load', async () => {
    const { getSettings } = await import('@/api');
    vi.mocked(getSettings).mockResolvedValueOnce({ autoSyncInterval: 30, autoCommitInterval: 60 } as any);
    const store = useSettingsStore();
    await store.loadSettings();
    expect((store as any).autoSyncInterval).toBeUndefined();
    expect((store as any).autoCommitInterval).toBeUndefined();
  });
});

describe('Settings Store: following the device theme', () => {
  const classes = () => [...document.documentElement.classList].filter((c) => c.startsWith('theme-'));

  it('uses the light or the dark theme chosen, as the device switches', async () => {
    let notify: (event: { matches: boolean }) => void = () => undefined;
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: (_: string, listener: typeof notify) => (notify = listener) }));
    try {
      setActivePinia(createPinia());
      const store = useSettingsStore();
      store.themeFollowsSystem = true;
      store.lightTheme = 'earth-light';
      store.darkTheme = 'forest';
      await nextTick();
      expect(classes()).toEqual(['theme-earth-light']);

      notify({ matches: true });
      await nextTick();
      expect(classes()).toEqual(['theme-forest']);

      store.themeFollowsSystem = false;
      await nextTick();
      expect(classes()).toEqual([]); // currentTheme is the default theme
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
