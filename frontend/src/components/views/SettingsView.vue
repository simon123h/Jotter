<script setup lang="ts">
import { Settings, GitBranch } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import ThemeSettings from '@/components/settings/ThemeSettings.vue';
import LanguageSettings from '@/components/settings/LanguageSettings.vue';
import GeneralSettings from '@/components/settings/GeneralSettings.vue';
import TagColorSettings from '@/components/settings/TagColorSettings.vue';
import TimeblockSettings from '@/components/settings/TimeblockSettings.vue';
import SystemInfoSettings from '@/components/settings/SystemInfoSettings.vue';

const { t } = useI18n();
</script>

<template>
  <div class="h-full w-full overflow-y-auto p-6 bg-transparent scroller-thin flex flex-col gap-6 max-w-5xl mx-auto">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-theme-text-main flex items-center gap-2">
        <Settings class="w-5 h-5 text-theme-accent" />
        {{ t('views.settings') }}
      </h2>
      <p class="text-xs text-theme-text-muted mt-1">{{ t('settingsView.subtitle') }}</p>
    </div>

    <div class="border-t border-theme-border/30"></div>

    <ThemeSettings />

    <div class="border-t border-theme-border/30"></div>

    <LanguageSettings />

    <div class="border-t border-theme-border/30"></div>

    <GeneralSettings />

    <div class="border-t border-theme-border/30"></div>

    <TagColorSettings />

    <div class="border-t border-theme-border/30"></div>

    <!-- Git Sync Section -->
    <div class="flex flex-col gap-4">
      <h3 class="text-xs font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-1.5">
        <GitBranch class="w-4 h-4 text-theme-accent shrink-0" />
        {{ t('settingsView.gitSync') }}
      </h3>
      <div class="bg-theme-card/60 border border-theme-border/60 rounded-xl p-5 flex flex-col gap-3">
        <p class="text-xs text-theme-text-muted leading-relaxed">
          {{ t('settingsView.autoCommitDesc') }}
        </p>
      </div>
    </div>

    <div class="border-t border-theme-border/30"></div>

    <TimeblockSettings />

    <div class="border-t border-theme-border/30"></div>

    <SystemInfoSettings />
  </div>
</template>
