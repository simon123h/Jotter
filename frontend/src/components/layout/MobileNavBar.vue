<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutGrid,
  Layers,
  Plus,
  Timer,
  Box,
  List,
  Grid2X2,
  Tag,
  Clock,
  CheckCircle2,
  X,
  ChevronRight,
} from '@lucide/vue';
import { useModalStore } from '@/stores/modal';
import { useSettingsStore } from '@/stores/settings';
import { usePomodoroStore } from '@/stores/pomodoro';
import { useUiStore } from '@/stores/ui';
import { useProjectStore } from '@/stores/project';
import { useI18n } from '@/composables/useI18n';
import { triggerLightHaptic, triggerMediumHaptic } from '@/utils/haptics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const modalStore = useModalStore();
const settingsStore = useSettingsStore();
const pomodoroStore = usePomodoroStore();
const uiStore = useUiStore();
const projectStore = useProjectStore();

const activeProjectId = computed(() => {
  return (route.params.projectId as string) || projectStore.projects[0]?.id || 'all';
});

const isTabActive = (tab: string) => {
  const currentMode = (route.meta.backRoute as string) || String(route.name || '');
  return currentMode === tab;
};

const isBoardActive = computed(() => isTabActive('board'));
const isViewsActive = computed(() => {
  return (
    uiStore.isMobileViewsSheetOpen ||
    ['list', 'matrix', 'tag', 'time', 'triage', 'review'].includes(
      (route.meta.backRoute as string) || String(route.name || '')
    )
  );
});
const isPomodoroActive = computed(() => pomodoroStore.is_bar_open || pomodoroStore.status === 'running');
const isTimeblockActive = computed(() => Boolean(settingsStore.isTimeblockSidebarOpen));

const toggleViewsSheet = () => {
  triggerLightHaptic();
  uiStore.isMobileViewsSheetOpen = !uiStore.isMobileViewsSheetOpen;
};

const navigateTo = (viewName: string) => {
  triggerLightHaptic();
  uiStore.isMobileViewsSheetOpen = false;
  const pid = activeProjectId.value;
  router.push({ name: viewName, params: { projectId: pid }, query: route.query });
};

const handleQuickAdd = () => {
  triggerMediumHaptic();
  modalStore.openTaskCreate('todo');
};

const handleTogglePomodoro = () => {
  triggerLightHaptic();
  pomodoroStore.toggleBar();
};

const handleToggleTimeblock = () => {
  triggerLightHaptic();
  settingsStore.toggleTimeblockSidebar();
};

const viewOptions = computed(() => [
  {
    name: 'board',
    label: t('views.board') || 'Board',
    icon: LayoutGrid,
  },
  {
    name: 'list',
    label: t('views.list') || 'List',
    icon: List,
  },
  {
    name: 'matrix',
    label: t('views.matrix') || 'Matrix',
    icon: Grid2X2,
  },
  {
    name: 'tag',
    label: t('views.tag') || 'Tags',
    icon: Tag,
  },
  {
    name: 'time',
    label: t('views.time') || 'Schedule',
    icon: Clock,
  },
  {
    name: 'review',
    label: t('views.review') || 'Review',
    icon: CheckCircle2,
  },
]);
</script>

<template>
  <div>
    <!-- BOTTOM NAVIGATION BAR -->
    <nav
      class="md:hidden shrink-0 flex items-center justify-around bg-theme-sidebar/95 backdrop-blur border-t border-theme-border/80 px-2 pt-1.5 pb-safe z-30 select-none shadow-lg"
    >
      <!-- 1. Board Button -->
      <button
        @click="navigateTo('board')"
        class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
        :class="isBoardActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
        :title="t('views.board') || 'Board'"
      >
        <LayoutGrid class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] tracking-tight">{{ t('views.board') || 'Board' }}</span>
      </button>

      <!-- 2. Ansichten (Views Bottom Sheet) -->
      <button
        @click="toggleViewsSheet"
        class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
        :class="isViewsActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
        :title="t('overflowMenu.views') || 'Views'"
      >
        <Layers class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] tracking-tight">{{ t('overflowMenu.views') || 'Views' }}</span>
      </button>

      <!-- 3. Central Round FAB Quick Add -->
      <div class="flex items-center justify-center px-1">
        <button
          @click="handleQuickAdd"
          class="w-11 h-11 rounded-full bg-theme-accent text-white flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
          :title="t('addTaskButton') || 'Add Task'"
        >
          <Plus class="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      <!-- 4. Pomodoro Toggle -->
      <button
        @click="handleTogglePomodoro"
        class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
        :class="
          isPomodoroActive
            ? 'text-rose-500 font-bold'
            : 'text-theme-text-muted hover:text-theme-text-main'
        "
        :title="t('pomodoro.toggleTooltip') || 'Pomodoro'"
      >
        <Timer class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] tracking-tight">Pomodoro</span>
      </button>

      <!-- 5. Time Blocking Panel Toggle -->
      <button
        @click="handleToggleTimeblock"
        class="flex flex-col items-center justify-center p-1.5 rounded-lg transition-colors flex-1"
        :class="isTimeblockActive ? 'text-theme-accent font-bold' : 'text-theme-text-muted hover:text-theme-text-main'"
        :title="t('timeblock.toggleSidebarTooltip') || 'Time Blocking'"
      >
        <Box class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] tracking-tight">Timeblock</span>
      </button>
    </nav>

    <!-- VIEWS BOTTOM SHEET (MOBILE) -->
    <!-- Backdrop Overlay -->
    <transition name="fade">
      <div
        v-if="uiStore.isMobileViewsSheetOpen"
        class="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
        @click="uiStore.isMobileViewsSheetOpen = false"
      />
    </transition>

    <!-- Bottom Sheet Content -->
    <transition name="sheet-slide">
      <div
        v-if="uiStore.isMobileViewsSheetOpen"
        class="md:hidden fixed bottom-0 inset-x-0 bg-theme-card border-t border-theme-border rounded-t-2xl z-50 p-4 pb-safe shadow-2xl max-h-[85vh] flex flex-col select-none"
      >
        <!-- Pull Handle -->
        <div class="w-10 h-1 bg-theme-border rounded-full mx-auto mb-3 shrink-0"></div>

        <!-- Header -->
        <div class="flex items-center justify-between pb-3 mb-2 border-b border-theme-border/60 shrink-0">
          <div class="flex items-center gap-2">
            <Layers class="w-4 h-4 text-theme-accent" />
            <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider">
              {{ t('overflowMenu.views') || 'Views' }}
            </h3>
          </div>
          <button
            @click="uiStore.isMobileViewsSheetOpen = false"
            class="p-1 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40 transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Views List -->
        <div class="space-y-1.5 overflow-y-auto py-1">
          <button
            v-for="v in viewOptions"
            :key="v.name"
            @click="navigateTo(v.name)"
            class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left cursor-pointer"
            :class="[
              isTabActive(v.name)
                ? 'bg-theme-primary/10 border-theme-primary/30 text-theme-accent font-bold shadow-sm'
                : 'border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main',
            ]"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                :class="isTabActive(v.name) ? 'bg-theme-primary text-white shadow-sm' : 'bg-theme-column/40 text-theme-text-muted'"
              >
                <component :is="v.icon" class="w-4 h-4" />
              </div>
              <span class="text-sm font-semibold text-theme-text-main">{{ v.label }}</span>
            </div>

            <ChevronRight class="w-4 h-4 text-theme-text-muted/50 shrink-0" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
