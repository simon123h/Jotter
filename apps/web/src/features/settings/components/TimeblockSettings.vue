<script setup lang="ts">
import { Box } from '@lucide/vue';
import { useSettingsStore } from '@/stores/settings';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const settingsStore = useSettingsStore();
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-1.5">
      <Box class="w-4 h-4 text-theme-accent shrink-0" />
      {{ t('settingsView.timeblockingTitle') }}
    </h3>
    <div class="bg-theme-card/60 border border-theme-border/60 rounded-xl p-5 flex flex-col gap-4">
      <!-- Start & End Hours -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="timeblock-start-hour" class="text-xs font-bold text-theme-text-main">
            {{ t('settingsView.timeblockStartHourLabel') }}
          </label>
          <input
            id="timeblock-start-hour"
            type="number"
            min="0"
            max="23"
            :value="settingsStore.settings.timeblockStartHour ?? 6"
            @change="
              (e) => {
                const val = Number((e.target as HTMLInputElement).value);
                settingsStore.updateSettings({ timeblockStartHour: val });
              }
            "
            class="w-full px-3.5 py-2 bg-theme-bg border border-theme-border/60 rounded-xl text-xs text-theme-text-main focus:outline-none focus:border-theme-primary"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="timeblock-end-hour" class="text-xs font-bold text-theme-text-main">
            {{ t('settingsView.timeblockEndHourLabel') }}
          </label>
          <input
            id="timeblock-end-hour"
            type="number"
            min="1"
            max="24"
            :value="settingsStore.settings.timeblockEndHour ?? 18"
            @change="
              (e) => {
                const val = Number((e.target as HTMLInputElement).value);
                settingsStore.updateSettings({ timeblockEndHour: val });
              }
            "
            class="w-full px-3.5 py-2 bg-theme-bg border border-theme-border/60 rounded-xl text-xs text-theme-text-main focus:outline-none focus:border-theme-primary"
          />
        </div>
      </div>
    </div>
  </div>
</template>
