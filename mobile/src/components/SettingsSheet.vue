<script setup lang="ts">
import { Database } from '@lucide/vue';
import BottomSheet from './BottomSheet.vue';
import { t } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';

const settings = useSettingsStore();
const ui = useUiStore();
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
          <option value="light">{{ t('settings.light') }}</option>
          <option value="dark">{{ t('settings.dark') }}</option>
        </select>
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
