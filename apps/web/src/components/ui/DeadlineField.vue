<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarPlus } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

/**
 * The due date, which is a deadline and the rarer date: its field shows once the task has one, or when asked for with
 * "Add deadline".
 */
const model = defineModel<string>({ default: '' });
const { t } = useI18n();

const adding = ref(false);
const shown = computed(() => !!model.value || adding.value);
</script>

<template>
  <div v-if="shown">
    <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1">{{ t('form.dueDateLabel') }}</label>
    <input
      v-model="model"
      type="date"
      class="w-full bg-theme-base/60 border border-theme-border rounded px-3 py-1.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
      data-testid="deadline-input"
    />
  </div>
  <div v-else class="flex items-end">
    <button
      type="button"
      class="flex w-full items-center gap-1.5 rounded border border-dashed border-theme-border px-3 py-1.5 text-sm text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary transition-colors cursor-pointer"
      data-testid="add-deadline"
      @click="adding = true"
    >
      <CalendarPlus class="w-4 h-4 shrink-0" />{{ t('form.addDeadline') }}
    </button>
  </div>
</template>
