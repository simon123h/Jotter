<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Info, Folder, RefreshCw } from '@lucide/vue';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { getSystemInfo, updateDataDir, syncSystem } from '@/api';
import { isNativeMobile } from '@/platform';
import type { SystemInfo } from '@/types';

const { t } = useI18n();
const { success: toastSuccess, error: toastError } = useToast();
const modalStore = useModalStore();
const projectStore = useProjectStore();

const systemInfo = ref<SystemInfo | null>(null);
const isEditingDataDir = ref(false);
const isUpdatingDataDir = ref(false);
const newDataDir = ref('');

onMounted(async () => {
  try {
    systemInfo.value = await getSystemInfo();
  } catch (err) {
    console.error('Error fetching system info:', err);
  }
});

const startEditDataDir = () => {
  if (systemInfo.value) {
    // Strip trailing platform notes like (Android Documents) for mobile clean editing
    const rawDir = systemInfo.value.data_dir.replace(/\s*\([^)]*\)\s*$/, '');
    newDataDir.value = rawDir;
  }
  isEditingDataDir.value = true;
};

const saveDataDir = async () => {
  const dir = newDataDir.value.trim();
  if (!dir) return;

  try {
    isUpdatingDataDir.value = true;
    const res = await updateDataDir(dir);
    if (systemInfo.value) {
      systemInfo.value.data_dir = res.data_dir;
    }
    isEditingDataDir.value = false;
    toastSuccess(t('settingsView.dataDirSuccess'));
    // Reload projects and tasks from the new directory
    await projectStore.fetchProjects();
    await projectStore.fetchTasks({ projectId: 'all' });
  } catch (err: any) {
    toastError(t('settingsView.dataDirError', { message: err.message || err }));
  } finally {
    isUpdatingDataDir.value = false;
  }
};

const isRebuildingIndex = ref(false);
const handleRebuildIndex = async () => {
  if (isRebuildingIndex.value) return;
  try {
    isRebuildingIndex.value = true;
    const res = await syncSystem();
    const count = (res as any)?.synchronized_tasks ?? (res as any)?.synced ?? 0;
    toastSuccess(t('sync.rebuildIndexSuccess', { count }));
  } catch (err: any) {
    toastError(t('sync.error', { message: err.message || err }));
  } finally {
    isRebuildingIndex.value = false;
  }
};
</script>

<template>
  <div v-if="systemInfo" class="flex flex-col gap-4">
    <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-1.5">
      <Info class="w-4 h-4 text-theme-accent shrink-0" />
      {{ t('settingsView.systemInfo') }}
    </h3>
    <div class="bg-theme-card/60 border border-theme-border/60 rounded-xl p-5 flex flex-col gap-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Version Info -->
        <div class="flex items-center gap-3.5 p-3.5 bg-theme-bg/40 border border-theme-border/30 rounded-xl">
          <Info class="w-5 h-5 text-theme-primary shrink-0" />
          <div class="flex flex-col min-w-0">
            <span class="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">{{ t('settingsView.versionLabel') }}</span>
            <span class="text-xs font-mono font-bold text-theme-text-main mt-0.5 truncate">{{ systemInfo.version }}</span>
          </div>
        </div>
        <!-- Data Directory Info & Edit -->
        <div class="flex flex-col gap-3 p-3.5 bg-theme-bg/40 border border-theme-border/30 rounded-xl">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <Folder class="w-5 h-5 text-theme-primary shrink-0" />
              <span class="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">{{ t('settingsView.dataDirLabel') }}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                v-if="!isEditingDataDir && !isNativeMobile"
                type="button"
                @click="modalStore.openVaultManage()"
                class="px-2.5 py-1 text-xs font-semibold bg-theme-primary/10 hover:bg-theme-primary/20 text-theme-accent rounded border border-theme-accent/20 transition-all cursor-pointer whitespace-nowrap"
                data-testid="settings-manage-vaults"
              >
                {{ t('vaults.manage') }}
              </button>
              <button
                v-if="!isEditingDataDir && isNativeMobile"
                type="button"
                @click="startEditDataDir"
                class="px-2.5 py-1 text-xs font-semibold bg-theme-primary/10 hover:bg-theme-primary/20 text-theme-accent rounded border border-theme-accent/20 transition-all cursor-pointer whitespace-nowrap"
              >
                {{ t('buttons.edit') }}
              </button>
            </div>
          </div>

          <template v-if="!isEditingDataDir">
            <span class="text-xs font-mono font-bold text-theme-text-main truncate" :title="systemInfo.data_dir">
              {{ systemInfo.data_dir }}
            </span>
            <p class="text-[11px] text-theme-text-muted leading-relaxed">
              {{ isNativeMobile ? t('settingsView.dataDirMobileHint') : t('settingsView.dataDirDesc') }}
            </p>
          </template>

          <template v-else>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <input
                  v-model="newDataDir"
                  type="text"
                  :placeholder="isNativeMobile ? t('settingsView.dataDirMobilePlaceholder') : t('settingsView.dataDirPlaceholder')"
                  class="flex-grow px-3 py-2 bg-theme-bg border border-theme-border/60 rounded-lg text-xs text-theme-text-main font-mono focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30"
                  :disabled="isUpdatingDataDir"
                  @keydown.enter="saveDataDir"
                />
              </div>
              <div class="flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  @click="isEditingDataDir = false"
                  :disabled="isUpdatingDataDir"
                  class="px-3 py-1.5 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
                >
                  {{ t('buttons.cancel') }}
                </button>
                <button
                  type="button"
                  @click="saveDataDir"
                  :disabled="isUpdatingDataDir || !newDataDir.trim()"
                  class="px-3.5 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                >
                  <span
                    v-if="isUpdatingDataDir"
                    class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></span>
                  <span>{{ t('buttons.save') }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Rebuild SQLite Search Index Maintenance -->
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-theme-bg/40 border border-theme-border/30 rounded-xl"
      >
        <div class="flex flex-col min-w-0 pr-2">
          <span class="text-xs font-bold text-theme-text-main">{{ t('sync.rebuildIndex') }}</span>
          <span class="text-[11px] text-theme-text-muted mt-0.5 leading-relaxed">{{ t('sync.rebuildIndexDesc') }}</span>
        </div>
        <button
          type="button"
          @click="handleRebuildIndex"
          :disabled="isRebuildingIndex"
          class="px-3.5 py-2 bg-theme-bg/60 hover:bg-theme-column/60 text-theme-text-main rounded-lg border border-theme-border/60 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5 text-theme-accent" :class="{ 'animate-spin': isRebuildingIndex }" />
          <span>{{ isRebuildingIndex ? t('sync.syncing') : t('sync.rebuildIndex') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
