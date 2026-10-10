import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Vault } from '@/types';
import { getVaults, createVault, renameVault, switchVault, deleteVault, enableGitVersioning, getSystemInfo } from '@/api';
import { useProjectStore } from '@/stores/project';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { useSettingsStore } from '@/stores/settings';

export const useVaultStore = defineStore('vault', () => {
  const vaults = ref<Vault[]>([]);
  const activeVault = ref<Vault | null>(null);
  const loading = ref(false);
  const switching = ref(false);
  const error = ref<string | null>(null);

  const gitInstalled = ref(false);

  const isCurrentGit = computed(() => !!activeVault.value?.is_git);

  const fetchVaults = async () => {
    loading.value = true;
    error.value = null;
    try {
      vaults.value = await getVaults();
      const current = vaults.value.find((v) => v.is_active) || vaults.value[0] || null;
      activeVault.value = current;
      gitInstalled.value = await getSystemInfo()
        .then((info) => !!info.git_installed)
        .catch(() => false);
    } catch (err: any) {
      error.value = err.message || 'Failed to load vaults';
    } finally {
      loading.value = false;
    }
  };

  // Invalidate project and timeblock stores so they reload for the active vault
  const reloadWorkspace = async () => {
    const projectStore = useProjectStore();
    const timeblockStore = useTimeblockStore();
    // Per-vault settings (pins, project order, tag colors, ...) live in the vault's settings.json
    await useSettingsStore().loadSettings();
    projectStore.invalidate();
    await projectStore.fetchProjects();
    await timeblockStore.fetchTimeblocks();
  };

  const selectVault = async (vaultId: string) => {
    loading.value = true;
    switching.value = true;
    error.value = null;
    // Clear the old vault's data right away so the UI reacts immediately
    useProjectStore().reset();
    useTimeblockStore().reset();
    try {
      const switched = await switchVault(vaultId);
      activeVault.value = switched;
      await fetchVaults();

      await reloadWorkspace();
    } catch (err: any) {
      error.value = err.message || 'Failed to switch vault';
      // Restore the previous vault's data that was cleared above
      await fetchVaults();
      await reloadWorkspace().catch(() => {});
      throw err;
    } finally {
      loading.value = false;
      switching.value = false;
    }
  };

  const addVault = async (payload: { name: string; path: string; id?: string; create_dir?: boolean }) => {
    loading.value = true;
    error.value = null;
    try {
      const created = await createVault(payload);
      await fetchVaults();
      return created;
    } catch (err: any) {
      error.value = err.message || 'Failed to create vault';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const enableGit = async () => {
    await enableGitVersioning();
    await fetchVaults();
  };

  const editVault = async (vaultId: string, name: string) => {
    error.value = null;
    try {
      const updated = await renameVault(vaultId, name);
      await fetchVaults();
      return updated;
    } catch (err: any) {
      error.value = err.message || 'Failed to rename vault';
      throw err;
    }
  };

  const removeVault = async (vaultId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const wasActive = activeVault.value?.id === vaultId;
      if (wasActive) switching.value = true;
      await deleteVault(vaultId);
      await fetchVaults();
      if (wasActive) {
        useProjectStore().reset();
        useTimeblockStore().reset();
        await reloadWorkspace();
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete vault';
      throw err;
    } finally {
      loading.value = false;
      switching.value = false;
    }
  };

  return {
    vaults,
    activeVault,
    loading,
    switching,
    error,
    isCurrentGit,
    gitInstalled,
    fetchVaults,
    selectVault,
    addVault,
    editVault,
    removeVault,
    enableGit,
  };
});
