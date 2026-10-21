<script setup lang="ts">
import { ref, computed } from 'vue';
import { Trash2 } from '@lucide/vue';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '@/stores/settings';
import { useI18n } from '@/composables/useI18n';
import BaseModal from '@/components/ui/BaseModal.vue';
import type { SavedView } from '@/types';
import { parseQuery } from '@jotter/task-filter';
import { filtersToRouteQuery } from '@/utils/filterRoute';

const props = defineProps<{
  isOpen: boolean;
  /** The view to change; none: a new one is made from `initialQuery`. */
  view?: SavedView;
  initialQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
const router = useRouter();
const settingsStore = useSettingsStore();

const name = ref(props.view?.name ?? '');
const query = ref(props.view?.query ?? props.initialQuery ?? '');
const canSave = computed(() => !!name.value.trim() && !!query.value.trim());

const save = () => {
  if (!canSave.value) return;
  if (props.view) {
    settingsStore.updateView(props.view.id, { name: name.value.trim(), query: query.value.trim() });
  } else {
    const created = settingsStore.addView(name.value, query.value);
    // The new view is the one in view: the address says so, and the sidebar marks it
    router.push({ name: 'list', params: { projectId: 'all' }, query: filtersToRouteQuery(parseQuery(created.query)) });
  }
  emit('close');
};

const remove = () => {
  if (props.view) settingsStore.removeView(props.view.id);
  emit('close');
};
</script>

<template>
  <BaseModal
    :is-open="isOpen"
    max-width="max-w-md"
    :title="view ? t('savedViews.editTitle') : t('savedViews.saveTitle')"
    @close="emit('close')"
  >
    <form class="p-4 space-y-4" @submit.prevent="save">
      <label class="block space-y-1">
        <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('savedViews.name') }}</span>
        <input
          v-model="name"
          type="text"
          autofocus
          :placeholder="t('savedViews.namePlaceholder')"
          class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary"
          data-testid="view-name"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs font-bold uppercase tracking-wider text-theme-text-muted">{{ t('savedViews.query') }}</span>
        <input
          v-model="query"
          type="text"
          class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm font-mono text-theme-text-input focus:outline-none focus:border-theme-primary"
          data-testid="view-query"
        />
        <span class="block text-xs text-theme-text-muted">{{ t('savedViews.queryHelp') }}</span>
      </label>

      <div class="flex items-center justify-between gap-2 pt-2 border-t border-theme-border">
        <button
          v-if="view"
          type="button"
          class="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
          data-testid="view-delete"
          @click="remove"
        >
          <Trash2 class="w-4 h-4" /> {{ t('savedViews.delete') }}
        </button>
        <span v-else></span>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 border border-theme-border rounded text-sm font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
            @click="emit('close')"
          >
            {{ t('buttons.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="!canSave"
            class="px-5 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
            data-testid="view-save"
          >
            {{ t('buttons.save') }}
          </button>
        </div>
      </div>
    </form>
  </BaseModal>
</template>
