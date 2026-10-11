<script setup lang="ts">
import { ref } from 'vue';
import { Trash2, Pencil, Check } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import VaultForm from './VaultForm.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const editing = ref<string | null>(null);
const editName = ref('');
const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));

async function open(id: string) {
  try {
    await app.switchVault(id);
    ui.close();
  } catch (err) {
    fail(err);
  }
}

async function saveRename() {
  const id = editing.value;
  editing.value = null;
  if (!id) return;
  try {
    await app.renameVault(id, editName.value);
  } catch (err) {
    fail(err);
  }
}

async function remove(id: string, name: string) {
  if (!window.confirm(t('vaults.confirmRemove', { name }))) return;
  try {
    await app.removeVault(id);
  } catch (err) {
    fail(err);
  }
}
</script>

<template>
  <BottomSheet :title="t('vaults.title')" @close="ui.close()">
    <ul class="space-y-2">
      <li v-for="v in app.vaults" :key="v.id" class="rounded-xl border border-line p-3" data-testid="vault-row">
        <div class="flex items-center gap-2">
          <form v-if="editing === v.id" class="flex flex-1 gap-2" @submit.prevent="saveRename">
            <input v-model="editName" class="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2" autofocus />
            <button type="submit" class="rounded-lg p-2 text-accent" :aria-label="t('common.save')"><Check class="h-5 w-5" /></button>
          </form>
          <div v-else class="min-w-0 flex-1">
            <div class="truncate font-medium">{{ v.name }}</div>
            <div class="truncate text-xs text-muted">{{ v.path }}</div>
          </div>
          <span v-if="v.id === app.vault?.id" class="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">{{
            t('vaults.active')
          }}</span>
          <button v-else class="rounded-lg border border-line px-3 py-1.5 text-sm" @click="open(v.id)">{{ t('vaults.switch') }}</button>
          <button
            class="rounded-full p-2 text-muted active:bg-line"
            :aria-label="t('common.rename')"
            @click="((editing = v.id), (editName = v.name))"
          >
            <Pencil class="h-4 w-4" />
          </button>
          <button
            class="rounded-full p-2 text-muted active:bg-line disabled:opacity-30"
            :disabled="app.vaults.length <= 1"
            :aria-label="t('vaults.remove')"
            @click="remove(v.id, v.name)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </li>
    </ul>

    <h3 class="mb-2 mt-5 text-sm font-semibold">{{ t('vaults.add') }}</h3>
    <VaultForm :submit-label="t('vaults.add')" @done="ui.close()" />
  </BottomSheet>
</template>
