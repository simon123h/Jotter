<script setup lang="ts">
import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  title: string;
  isToday: boolean;
  /** Earliest selectable date (YYYY-MM-DD). */
  minDate: string;
  /** Currently shown date (YYYY-MM-DD). */
  date: string;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'reset'): void;
  (e: 'pick', value: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center justify-between gap-1.5 bg-theme-column/40 p-1 rounded-lg border border-theme-border/60">
    <button
      type="button"
      :disabled="isToday"
      @click="emit('prev')"
      class="p-1 rounded transition-colors"
      :class="
        isToday
          ? 'opacity-30 cursor-not-allowed text-theme-text-muted'
          : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card cursor-pointer'
      "
      :title="isToday ? '' : t('timeblock.prevDay')"
    >
      <ChevronLeft class="w-4 h-4" />
    </button>

    <div class="flex items-center gap-1 min-w-0">
      <span class="text-xs font-bold text-theme-text-main truncate">
        {{ title }}
      </span>
      <button
        v-if="!isToday"
        type="button"
        @click="emit('reset')"
        class="p-1 rounded text-theme-primary hover:bg-theme-primary/15 transition-colors cursor-pointer shrink-0"
        :title="t('timeblock.jumpToToday')"
      >
        <RotateCcw class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex items-center gap-0.5">
      <label
        class="p-1 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card rounded cursor-pointer relative"
        :title="t('timeblock.pickDate')"
      >
        <Calendar class="w-3.5 h-3.5" />
        <input
          type="date"
          :min="minDate"
          :value="date"
          @change="emit('pick', ($event.target as HTMLInputElement).value)"
          class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <button
        type="button"
        @click="emit('next')"
        class="p-1 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card rounded transition-colors cursor-pointer"
        :title="t('timeblock.nextDay')"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
