<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LayoutGrid, List, Grid2X2, Clock, Settings, Plus } from '@lucide/vue';
import { useModalStore } from '@/stores/modal';
import { useI18n } from '@/composables/useI18n';
import { triggerLightHaptic, triggerMediumHaptic } from '@/utils/haptics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const modalStore = useModalStore();

const activeProjectId = computed(() => (route.params.projectId as string) || 'default');

const isBoardActive = computed(() => route.name === 'project' || route.name === 'project-global');
const isListActive = computed(() => route.name === 'project-list');
const isMatrixActive = computed(() => route.name === 'project-matrix');
const isTimeActive = computed(() => route.name === 'time' || route.name === 'time-global');
const isSettingsActive = computed(() => route.name === 'settings');

const navigateTo = (viewName: string) => {
  triggerLightHaptic();
  const pid = activeProjectId.value || 'default';
  if (viewName === 'board') {
    router.push({ name: 'project', params: { projectId: pid } });
  } else if (viewName === 'list') {
    router.push({ name: 'project-list', params: { projectId: pid } });
  } else if (viewName === 'matrix') {
    router.push({ name: 'project-matrix', params: { projectId: pid } });
  } else if (viewName === 'time') {
    router.push({ name: 'time', params: { projectId: pid } });
  } else if (viewName === 'settings') {
    router.push({ name: 'settings' });
  }
};

const handleQuickAdd = () => {
  triggerMediumHaptic();
  modalStore.openTaskCreate('todo');
};
</script>

<template>
  <nav
    class="md:hidden shrink-0 flex items-center justify-around bg-theme-sidebar/95 backdrop-blur border-t border-theme-border/80 px-2 pt-1.5 pb-safe z-30 select-none shadow-lg"
  >
    <button
      @click="navigateTo('board')"
      class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
      :class="isBoardActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
    >
      <LayoutGrid class="w-5 h-5 mb-0.5" />
      <span class="text-[10px] tracking-tight">{{ t('views.board') || 'Board' }}</span>
    </button>

    <button
      @click="navigateTo('list')"
      class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
      :class="isListActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
    >
      <List class="w-5 h-5 mb-0.5" />
      <span class="text-[10px] tracking-tight">{{ t('views.list') || 'List' }}</span>
    </button>

    <!-- Quick Add Central FAB -->
    <div class="flex items-center justify-center px-1">
      <button
        @click="handleQuickAdd"
        class="w-11 h-11 rounded-full bg-theme-accent text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
        :title="t('addTaskButton') || 'Add Task'"
      >
        <Plus class="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>

    <button
      @click="navigateTo('matrix')"
      class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
      :class="isMatrixActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
    >
      <Grid2X2 class="w-5 h-5 mb-0.5" />
      <span class="text-[10px] tracking-tight">{{ t('views.matrix') || 'Matrix' }}</span>
    </button>

    <button
      @click="navigateTo('time')"
      class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
      :class="isTimeActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
    >
      <Clock class="w-5 h-5 mb-0.5" />
      <span class="text-[10px] tracking-tight">{{ t('views.time') || 'Time' }}</span>
    </button>

    <button
      @click="navigateTo('settings')"
      class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
      :class="isSettingsActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
    >
      <Settings class="w-5 h-5 mb-0.5" />
      <span class="text-[10px] tracking-tight">{{ t('settings.title') || 'Settings' }}</span>
    </button>
  </nav>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}
</style>
