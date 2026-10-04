<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { hideAddTaskButton, doneCleanPeriod } = storeToRefs(useSettingsStore());
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider">{{ t('settingsView.general') }}</h3>
    <div class="flex flex-col gap-3">
      <label
        class="flex items-start gap-3 p-4 bg-theme-card/60 border border-theme-border/60 rounded-xl cursor-pointer hover:bg-theme-column/30 transition-all select-none"
      >
        <input
          type="checkbox"
          v-model="hideAddTaskButton"
          class="mt-1 w-4 h-4 rounded text-theme-primary border border-theme-border/60 focus:ring-theme-ring focus:ring-2 focus:ring-offset-0 bg-theme-card/60"
        />
        <div class="flex flex-col">
          <span class="text-xs font-bold text-theme-text-main">{{ t('settingsView.hideAddTask') }}</span>
          <span class="text-xs text-theme-text-muted mt-0.5">{{ t('settingsView.hideAddTaskDesc') }}</span>
        </div>
      </label>

      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-theme-card/60 border border-theme-border/60 rounded-xl"
      >
        <div class="flex flex-col max-w-xl">
          <span class="text-xs font-bold text-theme-text-main">{{ t('settingsView.globalDoneCleanPeriod') }}</span>
          <span class="text-xs text-theme-text-muted mt-0.5 leading-relaxed">{{ t('settingsView.globalDoneCleanPeriodDesc') }}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <input
            type="number"
            min="0"
            max="365"
            v-model.number="doneCleanPeriod"
            :placeholder="t('settingsView.globalDoneCleanPeriodPlaceholder')"
            class="w-32 bg-theme-bg border border-theme-border/60 rounded-xl px-3 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30 text-center font-bold"
          />
          <span class="text-xs text-theme-text-muted font-bold">{{ t('projectEdit.days') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
