<script setup lang="ts">
import { ref, computed } from 'vue';
import { Trash2 } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ id?: string; query?: string }>();

const app = useAppStore();
const ui = useUiStore();

const existing = computed(() => app.views.find((v) => v.id === props.id));
const name = ref(existing.value?.name ?? '');
const search = ref(existing.value?.query ?? props.query ?? '');
const canSave = computed(() => !!name.value.trim() && !!search.value.trim());

async function save() {
  if (!canSave.value) return;
  if (existing.value) {
    await app.updateView(existing.value.id, { name: name.value.trim(), query: search.value.trim() });
    ui.close();
    return;
  }
  const created = app.addView(name.value, search.value);
  ui.close();
  await app.openView(created.id);
}

async function remove() {
  if (!existing.value) return;
  ui.close();
  await app.removeView(existing.value.id);
}
</script>

<template>
  <BottomSheet :title="existing ? t('views.editTitle') : t('views.saveTitle')" @close="ui.close()">
    <form class="space-y-4 pb-2" @submit.prevent="save">
      <label class="block space-y-1">
        <span class="text-sm font-medium text-muted">{{ t('views.name') }}</span>
        <input
          v-model="name"
          class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
          data-testid="view-name"
          autofocus
        />
      </label>
      <label class="block space-y-1">
        <span class="text-sm font-medium text-muted">{{ t('views.query') }}</span>
        <input
          v-model="search"
          class="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-base"
          autocapitalize="off"
          autocorrect="off"
          data-testid="view-query"
        />
        <span class="block text-xs text-muted">{{ t('views.queryHelp') }}</span>
      </label>
      <div class="flex items-center justify-between gap-2">
        <button
          v-if="existing"
          type="button"
          class="flex h-11 items-center gap-2 rounded-full px-4 text-danger active:bg-line"
          data-testid="view-delete"
          @click="remove"
        >
          <Trash2 class="h-5 w-5" />{{ t('views.delete') }}
        </button>
        <span v-else></span>
        <button
          type="submit"
          :disabled="!canSave"
          class="h-11 rounded-full bg-accent px-6 font-medium text-accent-ink disabled:opacity-50"
          data-testid="view-save"
        >
          {{ t('common.save') }}
        </button>
      </div>
    </form>
  </BottomSheet>
</template>
