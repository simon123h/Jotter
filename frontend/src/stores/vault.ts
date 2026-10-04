import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Vault } from '@/types';
import { getVaults, createVault, switchVault, deleteVault, enableGitVersioning, getSystemInfo } from '@/api';
import { useProjectStore } from '@/stores/project';
import { useTimeblockStore } from '@/stores/timeblock';

export const useVaultStore = defineStore('vault', () => {
  const vaults = ref<Vault[]>([]);
  const activeVault = ref<Vault | null>(null);
  const loading = ref(false);
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

  const selectVault = async (vaultId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const switched = await switchVault(vaultId);
      activeVault.value = switched;
      await fetchVaults();

      // Invalidate project and timeblock store to reload for new vault
      const projectStore = useProjectStore();
      const timeblockStore = useTimeblockStore();
      projectStore.invalidate();
      await projectStore.fetchProjects();
      await timeblockStore.fetchTimeblocks();
    } catch (err: any) {
      error.value = err.message || 'Failed to switch vault';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const addVault = async (payload: { name: string; path: string; id?: string }) => {
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

  const removeVault = async (vaultId: string) => {
    loading.value = true;
    error.value = null;
    try {
      await deleteVault(vaultId);
      await fetchVaults();
    } catch (err: any) {
      error.value = err.message || 'Failed to delete vault';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    vaults,
    activeVault,
    loading,
    error,
    isCurrentGit,
    gitInstalled,
    fetchVaults,
    selectVault,
    addVault,
    removeVault,
    enableGit,
  };
});
