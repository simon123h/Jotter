<script setup lang="ts">
import { Database } from '@lucide/vue';
import { THEMES } from '@jotter/themes';
import { HORIZONS, type Horizon } from '@jotter/task-filter';
import BottomSheet from './BottomSheet.vue';
import { t, type MessageKey } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useAppStore } from '@/stores/app';

const settings = useSettingsStore();
const ui = useUiStore();
const app = useAppStore();
const field = 'w-full rounded-xl border border-line bg-surface px-3 py-3 text-base outline-none focus:border-accent';
const version = __APP_VERSION__;
</script>

<template>
  <BottomSheet :title="t('settings.title')" @close="ui.close()">
    <div class="space-y-4 pb-2">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('settings.language') }}</span>
        <select v-model="settings.language" :class="field" data-testid="setting-language">
          <option value="system">{{ t('settings.system') }}</option>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('settings.theme') }}</span>
        <select v-model="settings.theme" :class="field" data-testid="setting-theme">
          <option value="system">{{ t('settings.system') }}</option>
          <option v-for="theme in THEMES" :key="theme.id" :value="theme.id">{{ t(`theme.${theme.id}` as MessageKey) }}</option>
        </select>
      </label>
      <template v-if="settings.theme === 'system'">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-muted">{{ t('settings.themeLight') }}</span>
          <select v-model="settings.lightTheme" :class="field" data-testid="setting-theme-light">
            <option v-for="theme in THEMES.filter((entry) => !entry.dark)" :key="theme.id" :value="theme.id">
              {{ t(`theme.${theme.id}` as MessageKey) }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-muted">{{ t('settings.themeDark') }}</span>
          <select v-model="settings.darkTheme" :class="field" data-testid="setting-theme-dark">
            <option v-for="theme in THEMES.filter((entry) => entry.dark)" :key="theme.id" :value="theme.id">
              {{ t(`theme.${theme.id}` as MessageKey) }}
            </option>
          </select>
        </label>
      </template>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('settings.captureProject') }}</span>
        <select
          :value="app.captureProject?.id ?? ''"
          :class="field"
          data-testid="setting-capture-project"
          @change="app.setCaptureProject(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">{{ t('settings.captureNone') }}</option>
          <option v-for="p in app.orderedProjects" :key="p.id" :value="p.id">{{ p.title }}</option>
        </select>
        <span class="mt-1 block text-xs text-muted">{{ t('settings.captureHint') }}</span>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-muted">{{ t('settings.horizon') }}</span>
        <select
          :value="app.defaultHorizon"
          :class="field"
          data-testid="setting-horizon"
          @change="app.setDefaultHorizon(($event.target as HTMLSelectElement).value as Horizon)"
        >
          <option v-for="horizon in HORIZONS" :key="horizon" :value="horizon">{{ t(`horizon.${horizon}` as MessageKey) }}</option>
        </select>
        <span class="mt-1 block text-xs text-muted">{{ t('settings.horizonHint') }}</span>
      </label>
      <button
        class="inline-flex items-center gap-2 text-sm font-medium text-accent"
        data-testid="setting-vaults"
        @click="ui.open({ type: 'vaults' })"
      >
        <Database class="h-4 w-4" />{{ t('settings.vaults') }}
      </button>
      <div class="border-t border-line pt-3 text-sm text-muted">
        <div class="font-medium text-ink">{{ t('app.name') }}</div>
        <div>{{ t('settings.version', { version }) }}</div>
      </div>
    </div>
  </BottomSheet>
</template>
