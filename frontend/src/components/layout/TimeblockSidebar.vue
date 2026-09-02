<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { ChevronLeft, ChevronRight, Calendar, X, CheckCircle2, Circle, Box, ListPlus, RotateCcw, Repeat } from '@lucide/vue';
import { useRouter, useRoute } from 'vue-router';
import { useTimeblockStore } from '@/stores/timeblock';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useModalStore } from '@/stores/modal';
import { useSelectionStore } from '@/stores/selection';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { updateTask } from '@/api';
import type { Task, Timeblock } from '@/types';

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();

const timeblockStore = useTimeblockStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const modalStore = useModalStore();
const selectionStore = useSelectionStore();

const activeProjectId = computed(() => (route.params.projectId as string) || projectStore.projects[0]?.id || 'default');

// Format date helper
const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Active Date State
const activeDate = ref<Date>(new Date());
const activeDateStr = computed(() => formatDateStr(activeDate.value));

const todayStr = computed(() => formatDateStr(new Date()));

const isToday = computed(() => {
  return todayStr.value === activeDateStr.value;
});

// Title for active day
const activeDayTitle = computed(() => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const formatted = activeDate.value.toLocaleDateString(undefined, options);
  const todayLabel = t('timeblock.today') || 'Today';
  return isToday.value ? `${todayLabel}, ${formatted}` : formatted;
});

// Date navigation (strictly bounded to today and future)
const prevDay = () => {
  if (isToday.value) return;
  const d = new Date(activeDate.value);
  d.setDate(d.getDate() - 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) {
    activeDate.value = new Date();
  } else {
    activeDate.value = d;
  }
};

const nextDay = () => {
  const d = new Date(activeDate.value);
  d.setDate(d.getDate() + 1);
  activeDate.value = d;
};

const resetToToday = () => {
  activeDate.value = new Date();
};

const handleDateInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  if (val) {
    const [y, m, d] = val.split('-').map(Number);
    const chosen = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activeDate.value = chosen < today ? new Date() : chosen;
  }
};

// Fetch time blocks
const loadTimeblocks = async () => {
  await timeblockStore.fetchTimeblocks();
};

// Current time indicator
const currentTime = ref(new Date());
let timeInterval: any = null;
const gridScrollContainer = ref<HTMLElement | null>(null);

// Hour bounds (strictly respect user configured settings)
const startHour = computed(() => settingsStore.settings?.timeblockStartHour ?? settingsStore.settings?.timeblockStartHour ?? 6);
const endHour = computed(() => settingsStore.settings?.timeblockEndHour ?? settingsStore.settings?.timeblockEndHour ?? 18);

const hoursList = computed(() => {
  const list: number[] = [];
  for (let h = startHour.value; h <= endHour.value; h++) {
    list.push(h);
  }
  return list;
});

// Generous hour height (+20% longer for ample task space)
const HOUR_HEIGHT = 132;

const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Moving & Resizing Timeblock state
const isMovingTimeblock = ref(false);
const movingTimeblockId = ref<string | null>(null);
const movingGhost = ref<{ id: string; start_time: string; end_time: string } | null>(null);

const isResizingTimeblock = ref(false);
const resizingTimeblockId = ref<string | null>(null);
const resizingGhost = ref<{ id: string; start_time: string; end_time: string } | null>(null);

// Matching identical Task Card color palette
const TASK_CARD_COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
};

// Calculate box positioning styling with identical Task Card color mix
const getTimeblockStyle = (tb: Timeblock) => {
  const minMinutes = startHour.value * 60;
  const maxMinutes = (endHour.value + 1) * 60;

  const startMin = Math.max(minMinutes, timeToMinutes(tb.start_time));
  const endMin = Math.min(maxMinutes, timeToMinutes(tb.end_time));
  const durationMin = Math.max(20, endMin - startMin);

  const topPx = ((startMin - minMinutes) / 60) * HOUR_HEIGHT;
  const heightPx = (durationMin / 60) * HOUR_HEIGHT;

  const rawColor = tb.color || 'blue';
  const hex = TASK_CARD_COLOR_MAP[rawColor] || TASK_CARD_COLOR_MAP.blue;

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    '--card-tint': hex,
    backgroundColor: `color-mix(in srgb, ${hex} 22%, var(--theme-bg-card))`,
    borderColor: `color-mix(in srgb, ${hex} 48%, var(--theme-border))`,
  };
};

// Resolve task objects for a time block (always reactively linked to projectStore.tasks)
const getTasksForBlock = (tb: Timeblock): Task[] => {
  const ids = tb.task_ids || (tb.tasks ? tb.tasks.map((t) => t.id) : []);
  if (ids.length === 0) return [];

  return ids
    .map((id) => projectStore.tasks.find((t) => t.id === id) || tb.tasks?.find((t) => t.id === id))
    .filter((t): t is Task => !!t && !isTaskDone(t));
};

const isTaskDone = (task: Task): boolean => {
  return ['done', 'archive', 'archived', 'completed'].includes(task.bucket.toLowerCase());
};

import { triggerDoneParticleBurst } from '@/utils/effects';

// Toggle task completion from inside timeblock with board synchronization
const toggleTaskDone = async (task: Task, timeblockId: string, e: Event) => {
  e.stopPropagation();
  const currentlyDone = isTaskDone(task);
  const targetBucket = currentlyDone ? 'todo' : 'done';

  if (targetBucket === 'done') {
    const mouseEvent = e as MouseEvent;
    const target = (e.currentTarget as HTMLElement) || (e.target as HTMLElement);
    if (target && target.getBoundingClientRect) {
      const rect = target.getBoundingClientRect();
      triggerDoneParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else if (mouseEvent.clientX && mouseEvent.clientY) {
      triggerDoneParticleBurst(mouseEvent.clientX, mouseEvent.clientY);
    }
  }

  try {
    const updated = await updateTask(task.project_id || activeProjectId.value, task.id, {
      bucket: targetBucket,
      position: targetBucket === 'done' ? 1000000.0 : 1000.0,
    });
    task.bucket = targetBucket;

    // 1. If marked done, unallocate from the timeblock so recurring or standard blocks stay clean
    if (targetBucket === 'done') {
      await timeblockStore.unallocateTask(timeblockId, task.id);
    }

    // 2. Synchronize projectStore so board/list/matrix view immediately reflects the done status
    const storeTask = projectStore.tasks.find((t) => t.id === task.id);
    if (storeTask) {
      Object.assign(storeTask, updated);
    }
    await projectStore.invalidate();
  } catch (err: any) {
    toast.error(err.message || 'Failed to update task');
  }
};

// Start moving a timeblock
const startTimeblockMove = (event: MouseEvent, tb: Timeblock) => {
  if (event.button !== 0) return;

  const target = event.target as HTMLElement;
  if (target.closest('button, .task-item-card, .timeblock-resize-handle, input, a')) return;

  const startClientY = event.clientY;
  const origStartMin = timeToMinutes(tb.start_time);
  const origEndMin = timeToMinutes(tb.end_time);
  const durationMin = origEndMin - origStartMin;

  let hasMoved = false;

  const onMouseMove = (e: MouseEvent) => {
    const deltaY = e.clientY - startClientY;

    if (!hasMoved && Math.abs(deltaY) > 4) {
      hasMoved = true;
      isMovingTimeblock.value = true;
      movingTimeblockId.value = tb.id;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
    }

    if (hasMoved) {
      const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
      const rawStartMinutes = origStartMin + deltaMinutes;
      const snappedStartMin = Math.round(rawStartMinutes / 15) * 15;

      const minAllowed = startHour.value * 60;
      const maxAllowed = (endHour.value + 1) * 60 - durationMin;
      const clampedStartMin = Math.max(minAllowed, Math.min(maxAllowed, snappedStartMin));
      const clampedEndMin = clampedStartMin + durationMin;

      movingGhost.value = {
        id: tb.id,
        start_time: minutesToTime(clampedStartMin),
        end_time: minutesToTime(clampedEndMin),
      };
    }
  };

  const onMouseUp = async () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    if (hasMoved && movingGhost.value) {
      const { start_time: newStart, end_time: newEnd } = movingGhost.value;
      if (newStart !== tb.start_time || newEnd !== tb.end_time) {
        await timeblockStore.updateTimeblock(tb.id, {
          start_time: newStart,
          end_time: newEnd,
        });
      }
    } else if (!hasMoved) {
      modalStore.openTimeblockEdit(tb);
    }

    isMovingTimeblock.value = false;
    movingTimeblockId.value = null;
    movingGhost.value = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// Start resizing a timeblock
const startTimeblockResize = (event: MouseEvent, tb: Timeblock) => {
  if (event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();

  const startClientY = event.clientY;
  const origStartMin = timeToMinutes(tb.start_time);
  const origEndMin = timeToMinutes(tb.end_time);
  const origDuration = origEndMin - origStartMin;

  let hasResized = false;

  const onMouseMove = (e: MouseEvent) => {
    const deltaY = e.clientY - startClientY;

    if (!hasResized && Math.abs(deltaY) > 3) {
      hasResized = true;
      isResizingTimeblock.value = true;
      resizingTimeblockId.value = tb.id;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
    }

    if (hasResized) {
      const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
      const rawDuration = origDuration + deltaMinutes;
      const snappedDuration = Math.max(15, Math.round(rawDuration / 15) * 15);

      const maxMinutes = (endHour.value + 1) * 60;
      const clampedDuration = Math.min(maxMinutes - origStartMin, snappedDuration);
      const newEndMin = origStartMin + clampedDuration;

      resizingGhost.value = {
        id: tb.id,
        start_time: tb.start_time,
        end_time: minutesToTime(newEndMin),
      };
    }
  };

  const onMouseUp = async () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    if (hasResized && resizingGhost.value) {
      const { end_time: newEnd } = resizingGhost.value;
      if (newEnd !== tb.end_time) {
        await timeblockStore.updateTimeblock(tb.id, { end_time: newEnd });
      }
    }

    isResizingTimeblock.value = false;
    resizingTimeblockId.value = null;
    resizingGhost.value = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const getEffectiveTimeblock = (tb: Timeblock): Timeblock => {
  if (movingGhost.value && movingGhost.value.id === tb.id) {
    return {
      ...tb,
      start_time: movingGhost.value.start_time,
      end_time: movingGhost.value.end_time,
    };
  }
  if (resizingGhost.value && resizingGhost.value.id === tb.id) {
    return {
      ...tb,
      end_time: resizingGhost.value.end_time,
    };
  }
  return tb;
};

const dayTimeblocks = computed(() => {
  return timeblockStore
    .timeblocksByDate(activeDateStr.value)
    .map(getEffectiveTimeblock)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
});

// Click-to-allocate selected tasks into a timeblock
const addSelectedTasksToBox = async (timeblockId: string, e: Event) => {
  e.stopPropagation();
  const selectedCount = selectionStore.selectedIds.size;
  if (selectionStore.hasSelection && selectedCount > 0) {
    const ids = Array.from(selectionStore.selectedIds);
    for (const id of ids) {
      await timeblockStore.allocateTask(timeblockId, id);
    }
    toast.success(t('timeblock.addSelectedTooltip'));
    selectionStore.clearSelection();
  } else {
    toast.info(t('timeblock.noTasksSelectedHelper'));
  }
};

const unallocateTask = async (timeblockId: string, taskId: string, e: Event) => {
  e.stopPropagation();
  await timeblockStore.unallocateTask(timeblockId, taskId);
};

// Modal creation helper on slot click
const handleSlotClick = (hour: number) => {
  const startStr = `${String(hour).padStart(2, '0')}:00`;
  const endStr = `${String(Math.min(23, hour + 1)).padStart(2, '0')}:00`;
  modalStore.openTimeblockEdit(null, activeDateStr.value, startStr, endStr);
};

const openTaskDetail = (task: Task) => {
  router.push({
    name: 'board-task',
    params: { projectId: task.project_id || activeProjectId.value, taskId: task.id },
  });
};

const currentTimeStr = computed(() => {
  const now = currentTime.value;
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
});

const scrollToCurrentTime = () => {
  if (!gridScrollContainer.value) return;
  if (isToday.value && nowIndicatorStyle.value) {
    const topPx = parseFloat(nowIndicatorStyle.value.top);
    gridScrollContainer.value.scrollTop = Math.max(0, topPx - 160);
  }
};

watch(activeDateStr, () => {
  loadTimeblocks();
  setTimeout(scrollToCurrentTime, 100);
});

onMounted(() => {
  loadTimeblocks();
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60000);
  setTimeout(scrollToCurrentTime, 150);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});

const nowIndicatorStyle = computed(() => {
  const now = currentTime.value;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const minMinutes = startHour.value * 60;
  const maxMinutes = (endHour.value + 1) * 60;

  if (minutes < minMinutes || minutes > maxMinutes) return null;
  const topPx = ((minutes - minMinutes) / 60) * HOUR_HEIGHT;
  return { top: `${topPx}px` };
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

      <!-- Day Navigation Controls -->
      <div class="flex items-center justify-between gap-1.5 bg-theme-column/40 p-1 rounded-lg border border-theme-border/60">
        <button
          type="button"
          :disabled="isToday"
          @click="prevDay"
          class="p-1 rounded transition-colors"
          :class="
            isToday
              ? 'opacity-30 cursor-not-allowed text-theme-text-muted'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card cursor-pointer'
          "
          :title="isToday ? '' : t('timeblock.prevDay')"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>

        <div class="flex items-center gap-1 min-w-0">
          <span class="text-xs font-bold text-theme-text-main truncate">
            {{ activeDayTitle }}
          </span>
          <button
            v-if="!isToday"
            type="button"
            @click="resetToToday"
            class="p-1 rounded text-theme-primary hover:bg-theme-primary/15 transition-colors cursor-pointer shrink-0"
            :title="t('timeblock.jumpToToday')"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="flex items-center gap-0.5">
          <label
            class="p-1 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card rounded cursor-pointer relative"
            :title="t('timeblock.pickDate')"
          >
            <Calendar class="w-3.5 h-3.5" />
            <input
              type="date"
              :min="todayStr"
              :value="activeDateStr"
              @change="handleDateInput"
              class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
          <button
            type="button"
            @click="nextDay"
            class="p-1 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card rounded transition-colors cursor-pointer"
            :title="t('timeblock.nextDay')"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
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

          <!-- Render Timeblocks for Active Day -->
          <div
            v-for="tb in dayTimeblocks"
            :key="tb.id"
            :style="getTimeblockStyle(tb)"
            @mousedown="startTimeblockMove($event, tb)"
            class="timeblock-item absolute left-1.5 right-1.5 rounded-lg border p-2 shadow-sm transition-all flex flex-col overflow-hidden cursor-pointer group select-none z-10"
            :class="[
              movingTimeblockId === tb.id ? 'ring-2 ring-white/80 shadow-2xl opacity-90 scale-[1.02] z-30' : '',
              resizingTimeblockId === tb.id ? 'ring-2 ring-amber-400 shadow-xl opacity-95 z-30' : '',
            ]"
          >
            <!-- Box Header: Time badge + Title + Add Button -->
            <div
              class="flex items-center justify-between gap-2 shrink-0 mb-2 pb-1.5 border-b border-black/10 dark:border-white/10 pointer-events-auto"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="text-xs font-extrabold px-2 py-0.5 rounded-md bg-black/10 dark:bg-black/40 text-theme-text-main tracking-tight shrink-0 shadow-2xs"
                >
                  {{ tb.start_time }} - {{ tb.end_time }}
                </span>
                <span class="text-sm font-bold text-theme-text-main truncate flex items-center gap-1.5" :title="tb.title">
                  {{ tb.title }}
                  <Repeat
                    v-if="tb.recurrence && tb.recurrence !== 'none'"
                    class="w-3 h-3 text-theme-text-muted shrink-0"
                    :title="`${t('timeblock.recurrenceLabel')}: ${tb.recurrence}`"
                  />
                </span>
              </div>
              <!-- Add Selected Tasks Symbol Button (visible only when tasks are selected) -->
              <button
                v-if="selectionStore.hasSelection"
                type="button"
                @click.stop="addSelectedTasksToBox(tb.id, $event)"
                class="p-1 rounded-md bg-theme-primary text-white hover:bg-theme-primary/90 transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-2xs animate-in fade-in zoom-in-90 duration-150"
                :title="t('timeblock.addSelectedTooltip')"
                :aria-label="t('timeblock.addSelectedTasks')"
              >
                <ListPlus class="w-4 h-4" />
              </button>
            </div>

            <!-- Allocated Tasks List Inside Box -->
            <div class="flex-1 overflow-y-auto space-y-1 min-h-0 pr-0.5 pb-2 custom-scrollbar">
              <template v-for="task in getTasksForBlock(tb)" :key="task.id">
                <div
                  @click.stop="openTaskDetail(task)"
                  class="task-item-card task-card flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-theme-card/95 border border-theme-border/70 text-[11px] font-medium text-theme-text-main hover:bg-theme-column/90 transition-all cursor-pointer group/item shadow-2xs"
                  :class="isTaskDone(task) ? 'opacity-50' : ''"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      @click.stop="toggleTaskDone(task, tb.id, $event)"
                      class="shrink-0 p-0.5 hover:text-theme-primary transition-colors cursor-pointer"
                      :title="isTaskDone(task) ? t('tasks.markNotDone') : t('tasks.markDone')"
                    >
                      <CheckCircle2 v-if="isTaskDone(task)" class="w-3.5 h-3.5 text-emerald-400" />
                      <Circle v-else class="w-3.5 h-3.5 text-theme-text-muted" />
                    </button>
                    <span class="truncate" :class="isTaskDone(task) ? 'line-through text-theme-text-muted' : ''">
                      {{ task.title }}
                    </span>
                  </div>
                  <button
                    type="button"
                    @click.stop="unallocateTask(tb.id, task.id, $event)"
                    class="p-0.5 text-theme-text-muted hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    :title="t('timeblock.unallocate')"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
              </template>
            </div>

            <!-- Bottom Resize Handle -->
            <div
              @mousedown.stop="startTimeblockResize($event, tb)"
              class="timeblock-resize-handle absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center z-20 group/resize"
              :title="t('timeblock.resize')"
            >
              <div
                class="w-8 h-1 rounded-full bg-black/20 dark:bg-white/30 group-hover/resize:bg-black/50 dark:group-hover/resize:bg-white/80 transition-colors"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
