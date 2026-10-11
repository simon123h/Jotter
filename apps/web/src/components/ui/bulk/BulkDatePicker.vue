<script setup lang="ts">
import { ref } from 'vue';
import { Check } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { DatePreset } from './types';

defineProps<{
  title: string;
  presets: DatePreset[];
}>();

const emit = defineEmits<{
  (e: 'select', date: string): void;
}>();

const { t } = useI18n();
const customDate = ref('');

const toIsoDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const selectPreset = (preset: DatePreset) => {
  emit('select', preset.offsetDays === null ? '' : toIsoDate(preset.offsetDays));
};
</script>

<template>
  <div class="p-3 space-y-3 min-w-[240px]">
    <div class="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1 text-left">
      {{ title }}
    </div>
    <!-- Presets -->
    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="preset in presets"
        :key="preset.id"
        @click="selectPreset(preset)"
        class="px-2 py-1.5 bg-theme-column/30 hover:bg-theme-column text-theme-text-main text-xs rounded border border-theme-border/50 text-left transition-colors cursor-pointer"
        :class="{ 'col-span-2': preset.wide }"
      >
        {{ preset.label }}
      </button>
    </div>

    <!-- Custom Date Picker -->
    <div class="space-y-1.5 pt-1 border-t border-theme-border/30">
      <label class="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider text-left">
        {{ t('bulkActions.customDate') }}
      </label>
      <div class="flex items-center gap-1.5">
        <input
          v-model="customDate"
          type="date"
          class="flex-grow px-2 py-1 text-xs bg-theme-bg border border-theme-border/60 rounded text-theme-text-input focus:outline-none focus:border-theme-primary"
        />
        <button
          @click="emit('select', customDate)"
          class="p-1.5 bg-theme-primary text-white rounded hover:bg-theme-primary-hover cursor-pointer"
        >
          <Check class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
