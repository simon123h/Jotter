<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Database, FolderOpen, FolderPlus, Pencil, Trash2, Check, X, GitBranch } from '@lucide/vue';
import { useVaultStore } from '@/stores/vault';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { useToast } from '@/composables/useToast';
import BaseModal from '@/components/ui/BaseModal.vue';

defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const { t } = useI18n();
const { showDialog } = useDialog();
const toast = useToast();
const vaultStore = useVaultStore();
const { vaults, loading } = storeToRefs(vaultStore);

type Mode = 'open' | 'create';
const mode = ref<Mode>('open');
const newName = ref('');
const newPath = ref('');
const formError = ref('');

const editingId = ref<string | null>(null);
const editName = ref('');

const folderName = (path: string) =>
  path
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .pop() || '';

const onPathInput = () => {
  if (!newName.value.trim() || newName.value === lastAutoName) {
    lastAutoName = folderName(newPath.value);
    newName.value = lastAutoName;
  }
};
let lastAutoName = '';

const submit = async () => {
  formError.value = '';
  const path = newPath.value.trim();
  const name = newName.value.trim() || folderName(path);
  if (!path || !name) return;
  try {
    const created = await vaultStore.addVault({ name, path, create_dir: mode.value === 'create' });
    newName.value = '';
    newPath.value = '';
    lastAutoName = '';
    toast.success(t('vaults.added', { name: created.name }));
    if (
      await showDialog({
        title: t('vaults.switchTitle'),
        message: t('vaults.switchPrompt', { name: created.name }),
        showCancel: true,
        confirmText: t('vaults.switch'),
        cancelText: t('vaults.notNow'),
      })
    ) {
      await vaultStore.selectVault(created.id);
    }
  } catch (err: any) {
    formError.value = err.message;
  }
};

const startRename = (id: string, name: string) => {
  editingId.value = id;
  editName.value = name;
};

const saveRename = async () => {
  const id = editingId.value;
  const name = editName.value.trim();
  editingId.value = null;
  if (!id || !name) return;
  try {
    await vaultStore.editVault(id, name);
  } catch (err: any) {
    toast.error(err.message);
  }
};

const switchTo = async (id: string) => {
  try {
    await vaultStore.selectVault(id);
  } catch (err: any) {
    toast.error(err.message);
  }
};

const remove = async (id: string, name: string) => {
  const confirmed = await showDialog({
    title: t('vaults.removeTitle'),
    message: t('vaults.removeConfirm', { name }),
    type: 'warning',
    showCancel: true,
    confirmText: t('vaults.remove'),
    cancelText: t('buttons.cancel'),
  });
  if (!confirmed) return;
  try {
    await vaultStore.removeVault(id);
  } catch (err: any) {
    toast.error(err.message);
  }
};
</script>

<template>
  <BaseModal :is-open="isOpen" max-width="max-w-xl" :title="t('vaults.manage')" @close="emit('close')">
    <template #title>
      <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-2 truncate">
        <Database class="w-4 h-4 text-theme-accent shrink-0" />
        {{ t('vaults.manage') }}
      </h3>
    </template>

    <div class="p-5 space-y-5">
      <!-- Vault list -->
      <ul class="space-y-1.5" data-testid="vault-list">
        <li
          v-for="v in vaults"
          :key="v.id"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme-border/60 bg-theme-column/30"
          :class="{ 'border-theme-accent/60': v.is_active }"
        >
          <div class="min-w-0 flex-1">
            <form v-if="editingId === v.id" class="flex items-center gap-1" @submit.prevent="saveRename">
              <input
                v-model="editName"
                class="flex-1 min-w-0 text-sm bg-theme-base border border-theme-border rounded px-2 py-0.5 text-theme-text-main"
                autofocus
                @keydown.esc.stop="editingId = null"
              />
              <button type="submit" class="p-1 text-emerald-400 cursor-pointer" :title="t('buttons.save')">
                <Check class="w-3.5 h-3.5" />
              </button>
              <button type="button" class="p-1 text-theme-text-muted cursor-pointer" :title="t('buttons.cancel')" @click="editingId = null">
                <X class="w-3.5 h-3.5" />
              </button>
            </form>
            <template v-else>
              <div class="flex items-center gap-2 text-sm font-semibold text-theme-text-main truncate">
                {{ v.name }}
                <span
                  v-if="v.is_active"
                  class="text-[9px] uppercase font-bold tracking-wider px-1 rounded bg-theme-accent/15 text-theme-accent"
                >
                  {{ t('vaults.active') }}
                </span>
                <GitBranch v-if="v.is_git" class="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <div class="text-[11px] font-mono text-theme-text-muted truncate" :title="v.path">{{ v.path }}</div>
            </template>
          </div>
          <button
            v-if="!v.is_active"
            class="text-xs px-2 py-1 rounded border border-theme-border text-theme-text-muted hover:text-theme-accent hover:border-theme-accent cursor-pointer"
            :disabled="loading"
            @click="switchTo(v.id)"
          >
            {{ t('vaults.switch') }}
          </button>
          <button
            class="p-1.5 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column cursor-pointer"
            :title="t('vaults.rename')"
            @click="startRename(v.id, v.name)"
          >
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button
            class="p-1.5 rounded text-theme-text-muted hover:text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            :title="t('vaults.remove')"
            :disabled="vaults.length <= 1 || loading"
            @click="remove(v.id, v.name)"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </li>
      </ul>

      <!-- Add vault -->
      <form class="space-y-3 pt-4 border-t border-theme-border/60" @submit.prevent="submit">
        <div class="flex gap-1 p-0.5 rounded-lg bg-theme-column/40 w-fit">
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md cursor-pointer"
            :class="mode === 'open' ? 'bg-theme-card text-theme-accent shadow' : 'text-theme-text-muted'"
            @click="mode = 'open'"
          >
            <FolderOpen class="w-3.5 h-3.5" /> {{ t('vaults.openExisting') }}
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md cursor-pointer"
            :class="mode === 'create' ? 'bg-theme-card text-theme-accent shadow' : 'text-theme-text-muted'"
            @click="mode = 'create'"
          >
            <FolderPlus class="w-3.5 h-3.5" /> {{ t('vaults.createNew') }}
          </button>
        </div>

        <div>
          <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1">{{
            t('vaults.folderPath')
          }}</label>
          <input
            v-model="newPath"
            required
            :placeholder="mode === 'open' ? t('vaults.pathPlaceholderOpen') : t('vaults.pathPlaceholderCreate')"
            class="w-full text-sm font-mono bg-theme-base border border-theme-border rounded-lg px-3 py-2 text-theme-text-main focus:outline-none focus:border-theme-accent"
            data-testid="vault-path-input"
            @input="onPathInput"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1">{{ t('vaults.name') }}</label>
          <input
            v-model="newName"
            :placeholder="t('vaults.namePlaceholder')"
            class="w-full text-sm bg-theme-base border border-theme-border rounded-lg px-3 py-2 text-theme-text-main focus:outline-none focus:border-theme-accent"
            data-testid="vault-name-input"
          />
        </div>
        <p v-if="formError" class="text-xs text-red-400" data-testid="vault-form-error">{{ formError }}</p>
        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="loading || !newPath.trim()"
            class="text-sm font-semibold px-4 py-1.5 rounded-lg bg-theme-accent text-white hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {{ mode === 'open' ? t('vaults.open') : t('vaults.create') }}
          </button>
        </div>
      </form>
    </div>
  </BaseModal>
</template>
