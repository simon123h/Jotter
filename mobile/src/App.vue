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
import MoveSheet from '@/components/MoveSheet.vue';
import NavDrawer from '@/components/NavDrawer.vue';
import SettingsSheet from '@/components/SettingsSheet.vue';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useAutoRefresh } from '@/composables/useAutoRefresh';

const app = useAppStore();
const ui = useUiStore();

const { scanNow } = useAutoRefresh();
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
        if (isActive) void scanNow();
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
    ui.searching = false;
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
    <Transition name="drawer" :duration="200">
      <NavDrawer v-if="ui.sheet?.type === 'drawer'" />
    </Transition>
    <TaskSheet v-if="ui.sheet?.type === 'task'" :id="ui.sheet.id" :key="ui.sheet.id" />
    <QuickAddSheet v-else-if="ui.sheet?.type === 'quickadd'" :bucket="app.columns[ui.activeColumn]?.bucket ?? null" />
    <ProjectsSheet v-else-if="ui.sheet?.type === 'projects'" />
    <VaultsSheet v-else-if="ui.sheet?.type === 'vaults'" />
    <FilterSheet v-else-if="ui.sheet?.type === 'filter'" />
    <MoveSheet v-else-if="ui.sheet?.type === 'move'" :id="ui.sheet.id" />
    <SettingsSheet v-else-if="ui.sheet?.type === 'settings'" />
  </template>

  <!-- The message bar sits at the bottom, left of the add button; it makes room while a card is being dragged -->
  <Transition name="snack">
    <div
      v-if="ui.toast && !ui.dragging"
      class="fixed bottom-4 left-3 right-[5rem] z-50 flex items-center gap-2 rounded-lg bg-ink py-2.5 pl-4 text-sm text-surface shadow-lg"
      :class="ui.toast.action ? 'pr-1.5' : 'pointer-events-none pr-4'"
      style="margin-bottom: env(safe-area-inset-bottom)"
      role="status"
      data-testid="toast"
    >
      <span class="min-w-0 flex-1 truncate">{{ ui.toast.message }}</span>
      <button
        v-if="ui.toast.action"
        class="shrink-0 rounded-md px-3 py-1 font-semibold uppercase tracking-wide text-accent active:bg-white/10"
        data-testid="toast-action"
        @click="ui.toast.action.run()"
      >
        {{ ui.toast.action.label }}
      </button>
    </div>
  </Transition>
</template>
