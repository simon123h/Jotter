<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue';
import { App as CapApp } from '@capacitor/app';
import OnboardingScreen from '@/screens/OnboardingScreen.vue';
import BoardScreen from '@/screens/BoardScreen.vue';
import TaskSheet from '@/components/TaskSheet.vue';
import QuickAddSheet from '@/components/QuickAddSheet.vue';
import ProjectsSheet from '@/components/ProjectsSheet.vue';
import VaultsSheet from '@/components/VaultsSheet.vue';
import FilterSheet from '@/components/FilterSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const ui = useUiStore();

const listeners: Array<{ remove: () => Promise<void> }> = [];

onMounted(async () => {
  try {
    // Android back closes the open sheet before it leaves the app
    listeners.push(
      await CapApp.addListener('backButton', ({ canGoBack }) => {
        if (ui.isOpen) ui.close();
        else if (!canGoBack) void CapApp.exitApp();
      })
    );
    // Coming back to the app: pick up changes a sync tool made meanwhile
    listeners.push(
      await CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void app.refresh().catch(() => {});
      })
    );
  } catch {
    // Not running inside Capacitor (browser, tests)
  }
});

onBeforeUnmount(() => listeners.forEach((l) => void l.remove()));

// Opening another vault or project must not leave a sheet for a task that is no longer there
watch(
  () => app.projectId,
  () => {
    if (ui.sheet?.type === 'task') ui.close();
  }
);
</script>

<template>
  <div v-if="app.status === 'loading'" class="flex flex-1 items-center justify-center text-muted" data-testid="loading">…</div>

  <main
    v-else-if="app.status === 'error'"
    class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
    data-testid="error"
  >
    <h1 class="text-lg font-semibold">{{ t('error.title') }}</h1>
    <p class="text-sm text-muted">{{ app.error === 'storage' ? t('error.storage') : app.error }}</p>
    <button class="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink" @click="app.init()">{{ t('common.retry') }}</button>
  </main>

  <OnboardingScreen v-else-if="app.status === 'onboarding'" />

  <template v-else>
    <BoardScreen />
    <TaskSheet v-if="ui.sheet?.type === 'task'" :id="ui.sheet.id" :key="ui.sheet.id" />
    <QuickAddSheet v-else-if="ui.sheet?.type === 'quickadd'" :bucket="app.columns[ui.activeColumn]?.bucket ?? null" />
    <ProjectsSheet v-else-if="ui.sheet?.type === 'projects'" />
    <VaultsSheet v-else-if="ui.sheet?.type === 'vaults'" />
    <FilterSheet v-else-if="ui.sheet?.type === 'filter'" />
  </template>

  <div
    v-if="ui.toast"
    class="pointer-events-none fixed bottom-24 left-1/2 z-50 max-w-[85%] -translate-x-1/2 truncate rounded-full bg-ink px-4 py-2 text-sm text-surface shadow-lg"
    role="status"
    data-testid="toast"
  >
    {{ ui.toast }}
  </div>
</template>
