<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { X, Box } from '@lucide/vue';
import { useRoute } from 'vue-router';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useModalStore } from '@/stores/modal';
import { useSelectionStore } from '@/stores/selection';
import { useI18n } from '@/composables/useI18n';
import { useActiveDay } from '../composables/useActiveDay';
import { useCurrentTime } from '../composables/useCurrentTime';
import { useTimeblockDrag } from '../composables/useTimeblockDrag';
import { useTimeblockTasks } from '../composables/useTimeblockTasks';
import { HOUR_HEIGHT } from '../utils/timeGrid';
import TimeblockDayNav from './TimeblockDayNav.vue';
import TimeblockCard from './TimeblockCard.vue';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const route = useRoute();
const { t } = useI18n();

const timeblockStore = useTimeblockStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const modalStore = useModalStore();
const selectionStore = useSelectionStore();

const activeProjectId = computed(() => (route.params.projectId as string) || projectStore.projects[0]?.id || 'default');

const { activeDateStr, todayStr, isToday, activeDayTitle, prevDay, nextDay, resetToToday, setDateFromInput } = useActiveDay();

// Visible hour range, strictly following user settings
const startHour = computed(() => settingsStore.settings?.timeblockStartHour ?? 6);
const endHour = computed(() => settingsStore.settings?.timeblockEndHour ?? 18);
const hoursList = computed(() => {
  const list: number[] = [];
  for (let h = startHour.value; h <= endHour.value; h++) list.push(h);
  return list;
});

const { currentTimeStr, nowIndicatorTop, nowIndicatorStyle } = useCurrentTime(startHour, endHour);
const { movingTimeblockId, resizingTimeblockId, startMove, startResize, getEffectiveTimeblock } = useTimeblockDrag(startHour, endHour);
const { getTasksForBlock, toggleTaskDone, unallocateTask, addSelectedTasksToBox, openTaskDetail } = useTimeblockTasks(activeProjectId);

const dayTimeblocks = computed(() =>
  timeblockStore
    .timeblocksByDate(activeDateStr.value)
    .map(getEffectiveTimeblock)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
);

// Click on an empty hour slot to create a timeblock there
const handleSlotClick = (hour: number) => {
  const startStr = `${String(hour).padStart(2, '0')}:00`;
  const endStr = `${String(Math.min(23, hour + 1)).padStart(2, '0')}:00`;
  modalStore.openTimeblockEdit(null, activeDateStr.value, startStr, endStr);
};

const gridScrollContainer = ref<HTMLElement | null>(null);

const scrollToCurrentTime = () => {
  if (!gridScrollContainer.value) return;
  if (isToday.value && nowIndicatorTop.value !== null) {
    gridScrollContainer.value.scrollTop = Math.max(0, nowIndicatorTop.value - 160);
  }
};

const loadTimeblocks = async () => {
  await timeblockStore.fetchTimeblocks();
};

watch(activeDateStr, () => {
  loadTimeblocks();
  setTimeout(scrollToCurrentTime, 100);
});

onMounted(() => {
  loadTimeblocks();
  setTimeout(scrollToCurrentTime, 150);
});
</script>

<template>
  <aside
    class="timeblock-sidebar timeblock-view w-84 sm:w-92 border-l border-theme-border/70 bg-theme-card/80 flex flex-col shrink-0 h-full overflow-hidden shadow-lg animate-slideLeft z-30 select-none"
  >
    <!-- Sidebar Header -->
    <div class="px-3.5 py-3 border-b border-theme-border/60 bg-theme-card/90 shrink-0 space-y-2.5">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
          <Box class="w-4 h-4 text-theme-primary" />
          <span>{{ t('timeblock.sidebarTitle') }}</span>
        </h2>
        <button
          type="button"
          @click="emit('close')"
          class="p-1 rounded-md text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/50 transition-colors cursor-pointer"
          :title="t('buttons.close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <TimeblockDayNav
        :title="activeDayTitle"
        :is-today="isToday"
        :min-date="todayStr"
        :date="activeDateStr"
        @prev="prevDay"
        @next="nextDay"
        @reset="resetToToday"
        @pick="setDateFromInput"
      />
    </div>

    <!-- Day Schedule Body -->
    <div ref="gridScrollContainer" class="flex-1 overflow-y-auto min-w-0 custom-scrollbar relative">
      <div class="flex relative" :style="{ minHeight: `${hoursList.length * HOUR_HEIGHT}px` }">
        <!-- Time Gutter -->
        <div class="w-12 shrink-0 border-r border-theme-border/40 flex flex-col select-none relative bg-theme-card/30">
          <div
            v-for="hour in hoursList"
            :key="hour"
            :style="{ height: `${HOUR_HEIGHT}px` }"
            class="border-b border-theme-border/20 text-[10px] font-semibold text-theme-text-muted/70 flex items-start justify-end pr-1.5 pt-1.5"
          >
            {{ String(hour).padStart(2, '0') }}:00
          </div>

          <!-- Current Time Gutter Pill -->
          <div
            v-if="isToday && nowIndicatorStyle"
            :style="nowIndicatorStyle"
            class="absolute left-0 right-0 z-30 pointer-events-none flex items-center justify-end pr-1 -translate-y-1/2"
          >
            <span
              class="px-1 py-0.25 rounded bg-rose-500 text-white font-mono font-extrabold text-[8px] shadow-sm flex items-center gap-0.5"
            >
              <span class="w-1 h-1 rounded-full bg-white animate-pulse"></span>
              {{ currentTimeStr }}
            </span>
          </div>
        </div>

        <!-- Day Slots Column -->
        <div class="timeblock-day-col flex-1 relative flex flex-col min-w-0 bg-theme-base/40">
          <!-- Background Hour Slot Rows (Clickable) -->
          <div
            v-for="hour in hoursList"
            :key="hour"
            :style="{ height: `${HOUR_HEIGHT}px` }"
            @click="handleSlotClick(hour)"
            class="border-b border-theme-border/20 hover:bg-theme-column/30 transition-colors cursor-pointer relative group"
          >
            <div
              class="hidden group-hover:flex absolute inset-0 items-center justify-center text-[10px] font-semibold text-theme-text-muted opacity-40"
            >
              + {{ String(hour).padStart(2, '0') }}:00
            </div>
          </div>

          <!-- Current Time Red Line Indicator (if today) -->
          <div
            v-if="isToday && nowIndicatorStyle"
            :style="nowIndicatorStyle"
            class="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
          >
            <div class="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-md ring-2 ring-rose-500/30"></div>
            <div class="h-0.5 bg-rose-500 flex-1 shadow-md"></div>
          </div>

          <!-- Timeblocks for Active Day -->
          <TimeblockCard
            v-for="tb in dayTimeblocks"
            :key="tb.id"
            :timeblock="tb"
            :tasks="getTasksForBlock(tb)"
            :start-hour="startHour"
            :end-hour="endHour"
            :is-moving="movingTimeblockId === tb.id"
            :is-resizing="resizingTimeblockId === tb.id"
            :has-selection="selectionStore.hasSelection"
            @move-start="startMove($event, tb)"
            @resize-start="startResize($event, tb)"
            @add-selected="addSelectedTasksToBox(tb.id, $event)"
            @open-task="openTaskDetail"
            @toggle-done="(task, event) => toggleTaskDone(task, tb.id, event)"
            @unallocate="(task, event) => unallocateTask(tb.id, task.id, event)"
          />
        </div>
      </div>
    </div>
  </aside>
</template>
