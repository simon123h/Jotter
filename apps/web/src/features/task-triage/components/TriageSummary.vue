<script setup lang="ts">
import { CheckSquare, Sparkle } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';

defineProps<{
  /** True after working through the whole queue; false when there was nothing to triage. */
  isCongrats: boolean;
  editedCount: number;
  completedCount: number;
  deletedCount: number;
}>();

const emit = defineEmits<{
  (e: 'restart'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="max-w-md w-full bg-theme-card border border-theme-border/60 rounded-2xl p-8 shadow-2xl text-center flex flex-col items-center gap-4 animate-scale-in"
  >
    <div class="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
      <CheckSquare class="w-8 h-8 text-emerald-400 animate-pulse" />
    </div>
    <h2 class="text-lg font-bold text-theme-text-main">
      {{ isCongrats ? t('triage.congratsTitle') : t('triage.noTasks') }}
    </h2>
    <p class="text-xs text-theme-text-muted leading-relaxed max-w-sm">
      {{ isCongrats ? t('triage.congratsDesc') : t('emptyStateText') }}
    </p>

    <!-- Session Stats Summary -->
    <div v-if="isCongrats" class="w-full bg-theme-column/30 border border-theme-border/30 rounded-xl p-4 mt-2 text-left space-y-2.5">
      <div
        class="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted pb-1.5 border-b border-theme-border/40 flex items-center gap-1.5"
      >
        <Sparkle class="w-3.5 h-3.5 text-theme-accent" />
        {{ t('triage.statsSession') }}
      </div>
      <div class="grid grid-cols-3 gap-2.5 text-center">
        <div class="bg-theme-card/60 p-2.5 rounded border border-theme-border/40">
          <div class="text-base font-extrabold text-theme-accent">{{ editedCount }}</div>
          <div class="text-[10px] text-theme-text-muted mt-0.5">{{ t('triage.edited') }}</div>
        </div>
        <div class="bg-theme-card/60 p-2.5 rounded border border-theme-border/40">
          <div class="text-base font-extrabold text-emerald-400">{{ completedCount }}</div>
          <div class="text-[10px] text-theme-text-muted mt-0.5">{{ t('triage.completed') }}</div>
        </div>
        <div class="bg-theme-card/60 p-2.5 rounded border border-theme-border/40">
          <div class="text-base font-extrabold text-rose-400">{{ deletedCount }}</div>
          <div class="text-[10px] text-theme-text-muted mt-0.5">{{ t('triage.deleted') }}</div>
        </div>
      </div>
    </div>

    <button
      @click="emit('restart')"
      class="px-4 py-2 mt-4 bg-theme-primary hover:bg-theme-primary-hover text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
    >
      {{ t('triage.restartSession') }}
    </button>
  </div>
</template>

<style scoped src="./triageAnimations.css"></style>
