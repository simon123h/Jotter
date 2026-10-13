import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useVaultStore } from '@/stores/vault';
import { useProjectStore } from '@/stores/project';
import * as api from '@/api';
import type { Vault } from '@/types';

vi.mock('@/api', () => ({
  getVaults: vi.fn(),
  createVault: vi.fn(),
  renameVault: vi.fn(),
  switchVault: vi.fn(),
  deleteVault: vi.fn(),
  enableGitVersioning: vi.fn(),
  getSystemInfo: vi.fn(),
  // The stores that the vault store reloads
  getProjects: vi.fn(() => Promise.resolve([])),
  getSettings: vi.fn(() => Promise.resolve({})),
  saveSettings: vi.fn(() => Promise.resolve()),
}));

const timeblocks = { fetchTimeblocks: vi.fn(() => Promise.resolve()), reset: vi.fn() };
vi.mock('@/features/timeblock/stores/timeblock', () => ({ useTimeblockStore: () => timeblocks }));

const vault = (id: string, extra: Partial<Vault> = {}): Vault => ({
  id,
  name: id.toUpperCase(),
  path: `/vaults/${id}`,
  is_active: false,
  is_git: false,
  created_at: '',
  ...extra,
});

describe('vault store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.getVaults).mockResolvedValue([vault('a'), vault('b', { is_active: true, is_git: true })]);
    vi.mocked(api.getSystemInfo).mockResolvedValue({ git_installed: true } as never);
    vi.mocked(api.getProjects).mockResolvedValue([]);
    timeblocks.fetchTimeblocks.mockResolvedValue(undefined);
  });

  describe('listing the vaults', () => {
    it('loads the vaults, takes the active one and asks whether Git is installed', async () => {
      const store = useVaultStore();
      await store.fetchVaults();

      expect(store.vaults.map((v) => v.id)).toEqual(['a', 'b']);
      expect(store.activeVault?.id).toBe('b');
      expect(store.isCurrentGit).toBe(true);
      expect(store.gitInstalled).toBe(true);
      expect(store.loading).toBe(false);
    });

    it('takes the first vault when none is marked active, and none when there are none', async () => {
      const store = useVaultStore();
      vi.mocked(api.getVaults).mockResolvedValueOnce([vault('a'), vault('b')]);
      await store.fetchVaults();
      expect(store.activeVault?.id).toBe('a');
      expect(store.isCurrentGit).toBe(false);

      vi.mocked(api.getVaults).mockResolvedValueOnce([]);
      await store.fetchVaults();
      expect(store.activeVault).toBeNull();
    });

    it('goes on without Git information when the system info is not there', async () => {
      const store = useVaultStore();
      vi.mocked(api.getSystemInfo).mockRejectedValueOnce(new Error('no'));
      await store.fetchVaults();
      expect(store.gitInstalled).toBe(false);
      expect(store.error).toBeNull();
    });

    it('keeps the message when the vaults cannot be loaded', async () => {
      const store = useVaultStore();
      vi.mocked(api.getVaults).mockRejectedValueOnce(new Error('offline'));
      await store.fetchVaults();
      expect(store.error).toBe('offline');
      expect(store.loading).toBe(false);
    });
  });

  describe('switching', () => {
    it('empties the old vault at once, then loads the new one', async () => {
      const project = useProjectStore();
      project.projects = [{ id: 'old', title: 'Old', created_at: '' }];
      const store = useVaultStore();
      let during: { projects: number; switching: boolean } | null = null;
      vi.mocked(api.switchVault).mockImplementationOnce(async () => {
        during = { projects: project.projects.length, switching: store.switching };
        return vault('a', { is_active: true });
      });
      vi.mocked(api.getProjects).mockResolvedValueOnce([{ id: 'new', title: 'New', created_at: '' }]);

      await store.selectVault('a');

      expect(during).toEqual({ projects: 0, switching: true });
      expect(timeblocks.reset).toHaveBeenCalled();
      expect(api.getSettings).toHaveBeenCalled();
      expect(project.projects.map((p) => p.id)).toEqual(['new']);
      expect(store.switching).toBe(false);
      expect(store.loading).toBe(false);
    });

    it('loads the old vault again, keeps the message and passes the error on when the switch fails', async () => {
      const store = useVaultStore();
      vi.mocked(api.switchVault).mockRejectedValueOnce(new Error('locked'));

      await expect(store.selectVault('a')).rejects.toThrow('locked');

      expect(store.error).toBe('locked');
      expect(api.getVaults).toHaveBeenCalled();
      expect(api.getProjects).toHaveBeenCalled(); // the workspace came back
      expect(store.switching).toBe(false);
      expect(store.loading).toBe(false);
    });

    it('still passes the error on when the old workspace cannot be restored either', async () => {
      const store = useVaultStore();
      vi.mocked(api.switchVault).mockRejectedValueOnce(new Error('locked'));
      vi.mocked(api.getProjects).mockRejectedValue(new Error('also gone'));
      timeblocks.fetchTimeblocks.mockRejectedValue(new Error('also gone'));

      await expect(store.selectVault('a')).rejects.toThrow('locked');
    });
  });

  describe('adding, renaming, Git', () => {
    it('adds a vault, lists them again and returns it', async () => {
      const store = useVaultStore();
      vi.mocked(api.createVault).mockResolvedValueOnce(vault('c'));

      const created = await store.addVault({ name: 'C', path: '/vaults/c', create_dir: true });

      expect(created.id).toBe('c');
      expect(api.createVault).toHaveBeenCalledWith({ name: 'C', path: '/vaults/c', create_dir: true });
      expect(api.getVaults).toHaveBeenCalled();
      expect(store.loading).toBe(false);
    });

    it('keeps the message and passes the error on when a vault cannot be added', async () => {
      const store = useVaultStore();
      vi.mocked(api.createVault).mockRejectedValueOnce(new Error('exists'));
      await expect(store.addVault({ name: 'C', path: '/x' })).rejects.toThrow('exists');
      expect(store.error).toBe('exists');
      expect(store.loading).toBe(false);
    });

    it('renames a vault and lists them again; a failure keeps its message', async () => {
      const store = useVaultStore();
      vi.mocked(api.renameVault).mockResolvedValueOnce(vault('a', { name: 'New name' }));
      expect((await store.editVault('a', 'New name')).name).toBe('New name');
      expect(api.renameVault).toHaveBeenCalledWith('a', 'New name');

      vi.mocked(api.renameVault).mockRejectedValueOnce(new Error('taken'));
      await expect(store.editVault('a', 'x')).rejects.toThrow('taken');
      expect(store.error).toBe('taken');
    });

    it('turns on Git for the vault and lists them again', async () => {
      const store = useVaultStore();
      await store.enableGit();
      expect(api.enableGitVersioning).toHaveBeenCalled();
      expect(api.getVaults).toHaveBeenCalled();
    });
  });

  describe('removing', () => {
    it('removes a vault that is not open without touching the workspace', async () => {
      const store = useVaultStore();
      await store.fetchVaults(); // b is open
      timeblocks.reset.mockClear();

      await store.removeVault('a');

      expect(api.deleteVault).toHaveBeenCalledWith('a');
      expect(timeblocks.reset).not.toHaveBeenCalled();
      expect(store.switching).toBe(false);
    });

    it('empties and reloads the workspace when the open vault is removed', async () => {
      const store = useVaultStore();
      await store.fetchVaults();
      const project = useProjectStore();
      project.projects = [{ id: 'old', title: 'Old', created_at: '' }];
      vi.mocked(api.getVaults).mockResolvedValueOnce([vault('a', { is_active: true })]);
      vi.mocked(api.getProjects).mockResolvedValueOnce([{ id: 'other', title: 'Other', created_at: '' }]);

      await store.removeVault('b');

      expect(timeblocks.reset).toHaveBeenCalled();
      expect(store.activeVault?.id).toBe('a');
      expect(project.projects.map((p) => p.id)).toEqual(['other']);
      expect(store.switching).toBe(false);
      expect(store.loading).toBe(false);
    });

    it('keeps the message and passes the error on when a vault cannot be removed', async () => {
      const store = useVaultStore();
      vi.mocked(api.deleteVault).mockRejectedValueOnce(new Error('last vault'));
      await expect(store.removeVault('a')).rejects.toThrow('last vault');
      expect(store.error).toBe('last vault');
      expect(store.loading).toBe(false);
      expect(store.switching).toBe(false);
    });
  });
});
