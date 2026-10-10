<script setup lang="ts">
import { Loader2 } from '@lucide/vue';
import type { LogEntry } from '../composables/useImportWizard';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  importProgressCurrent: number;
  importProgressTotal: number;
  logs: LogEntry[];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="space-y-6 py-6 text-center">
    <div class="flex flex-col items-center">
      <Loader2 class="w-10 h-10 text-theme-primary animate-spin mb-4" />
      <h4 class="text-sm font-bold text-theme-text-main">{{ t('importWizard.importingTasks') }}</h4>
      <p class="text-xs text-theme-text-muted mt-1">{{ t('importWizard.importingDesc') }}</p>
    </div>

    <!-- Progress Bar -->
    <div class="space-y-2">
      <div class="flex justify-between text-xs font-mono text-theme-text-muted">
        <span>{{ t('importWizard.progressLabel') }}</span>
        <span
          >{{ importProgressCurrent }} / {{ importProgressTotal }} ({{
            importProgressTotal > 0 ? Math.round((importProgressCurrent / importProgressTotal) * 100) : 0
          }}%)</span
        >
      </div>
      <div class="w-full bg-theme-column/30 rounded-full h-2 overflow-hidden border border-theme-border/50">
        <div
          class="bg-theme-primary h-full rounded-full transition-all duration-300"
          :style="{ width: `${importProgressTotal > 0 ? (importProgressCurrent / importProgressTotal) * 100 : 0}%` }"
        ></div>
      </div>
    </div>

    <!-- Logs / Output -->
    <div
      class="text-left space-y-1 bg-slate-950 p-4 rounded font-mono text-[10.5px] h-44 overflow-y-auto border border-theme-border/30 scroller-thin"
    >
      <div
        v-for="(log, idx) in logs"
        :key="idx"
        :class="{
          'text-emerald-400': log.type === 'success',
          'text-yellow-400': log.type === 'warn',
          'text-red-400': log.type === 'error',
          'text-sky-400': log.type === 'info',
        }"
      >
        &gt; {{ log.text }}
      </div>
    </div>
  </div>
</template>
