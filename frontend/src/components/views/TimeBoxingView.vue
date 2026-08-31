<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  PanelRight,
  PanelRightClose,
  Search,
  CheckCircle2,
  Circle,
  X,
  Sparkles,
  Edit2,
  Box,
} from '@lucide/vue';
import { useRoute, useRouter } from 'vue-router';
import { useTimeboxStore } from '@/stores/timebox';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { useModalStore } from '@/stores/modal';
import { useI18n } from '@/composables/useI18n';
import type { Task, Timebox } from '@/types';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const timeboxStore = useTimeboxStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const modalStore = useModalStore();

const activeProjectId = computed(() => (route.params.projectId as string) || 'default');

// Week Navigation & Mode
const weekOffset = ref(0);
const weekMode = ref<'workweek' | 'fullweek'>(settingsStore.settings?.timeboxWeekMode || 'workweek');
const isTaskDrawerOpen = ref(true);
const taskSearchQuery = ref('');
const taskFilterTab = ref<'all' | 'today' | 'project'>('project');
const draggingOverBoxId = ref<string | null>(null);

// Hour bounds
const configuredStartHour = computed(() => settingsStore.settings?.timeboxStartHour ?? 8);
const configuredEndHour = computed(() => settingsStore.settings?.timeboxEndHour ?? 18);

// If today is in the active week, dynamically expand visible hours to cover the current time
const startHour = computed(() => {
  const base = configuredStartHour.value;
  const todayInWeek = weekDays.value.some((d) => d.isToday);
  if (todayInWeek) {
    const currentHour = currentTime.value.getHours();
    return Math.min(base, Math.max(0, currentHour));
  }
  return base;
});

const endHour = computed(() => {
  const base = configuredEndHour.value;
  const todayInWeek = weekDays.value.some((d) => d.isToday);
  if (todayInWeek) {
    const currentHour = currentTime.value.getHours();
    return Math.max(base, Math.min(23, currentHour));
  }
  return base;
});

const hoursList = computed(() => {
  const list: number[] = [];
  for (let h = startHour.value; h <= endHour.value; h++) {
    list.push(h);
  }
  return list;
});

// Helper: Format Date to YYYY-MM-DD
const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Calculate start of week (Monday)
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Calculate days in active week view
const weekDays = computed(() => {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + weekOffset.value * 7);

  const monday = getMonday(targetDate);
  const numDays = weekMode.value === 'workweek' ? 5 : 7;
  const days: { date: Date; dateStr: string; dayName: string; dayNumber: number; isToday: boolean }[] = [];

  for (let i = 0; i < numDays; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const dateStr = formatDateStr(current);
    const todayStr = formatDateStr(today);

    days.push({
      date: current,
      dateStr,
      dayName: current.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: current.getDate(),
      isToday: dateStr === todayStr,
    });
  }
  return days;
});

// Title for week range (e.g. "Aug 31 – Sep 4, 2026")
const weekRangeTitle = computed(() => {
  if (weekDays.value.length === 0) return '';
  const first = weekDays.value[0].date;
  const last = weekDays.value[weekDays.value.length - 1].date;

  const firstMonth = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lastMonth = last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${firstMonth} – ${lastMonth}`;
});

// Fetch timeboxes on mount or week change
const loadTimeboxes = async () => {
  if (weekDays.value.length === 0) return;
  const start = weekDays.value[0].dateStr;
  const end = weekDays.value[weekDays.value.length - 1].dateStr;
  await timeboxStore.fetchTimeboxes(start, end);
};

onMounted(() => {
  loadTimeboxes();
});

const prevWeek = () => {
  weekOffset.value--;
  loadTimeboxes();
};

const nextWeek = () => {
  weekOffset.value++;
  loadTimeboxes();
};

const resetToToday = () => {
  weekOffset.value = 0;
  loadTimeboxes();
};

const setWeekMode = (mode: 'workweek' | 'fullweek') => {
  weekMode.value = mode;
  settingsStore.updateSettings({ timeboxWeekMode: mode });
  loadTimeboxes();
};

// Convert "HH:mm" to minutes from startHour
const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Generous hour slot height (in px) for clear task readability and smooth vertical scroll
const HOUR_HEIGHT = 140;

// Calculate box positioning styling
const getTimeboxStyle = (tb: Timebox) => {
  const minMinutes = startHour.value * 60;
  const maxMinutes = (endHour.value + 1) * 60;

  const startMin = Math.max(minMinutes, timeToMinutes(tb.startTime));
  const endMin = Math.min(maxMinutes, timeToMinutes(tb.endTime));
  const durationMin = Math.max(20, endMin - startMin);

  const topPx = ((startMin - minMinutes) / 60) * HOUR_HEIGHT;
  const heightPx = (durationMin / 60) * HOUR_HEIGHT;

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
  };
};

const COLOR_CLASSES: Record<string, { bg: string; border: string; badge: string }> = {
  indigo: { bg: 'bg-indigo-950/40 hover:bg-indigo-950/60', border: 'border-indigo-500/50', badge: 'bg-indigo-500/20 text-indigo-300' },
  blue: { bg: 'bg-blue-950/40 hover:bg-blue-950/60', border: 'border-blue-500/50', badge: 'bg-blue-500/20 text-blue-300' },
  emerald: {
    bg: 'bg-emerald-950/40 hover:bg-emerald-950/60',
    border: 'border-emerald-500/50',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
  amber: { bg: 'bg-amber-950/40 hover:bg-amber-950/60', border: 'border-amber-500/50', badge: 'bg-amber-500/20 text-amber-300' },
  rose: { bg: 'bg-rose-950/40 hover:bg-rose-950/60', border: 'border-rose-500/50', badge: 'bg-rose-500/20 text-rose-300' },
  purple: { bg: 'bg-purple-950/40 hover:bg-purple-950/60', border: 'border-purple-500/50', badge: 'bg-purple-500/20 text-purple-300' },
  teal: { bg: 'bg-teal-950/40 hover:bg-teal-950/60', border: 'border-teal-500/50', badge: 'bg-teal-500/20 text-teal-300' },
  slate: { bg: 'bg-slate-900/40 hover:bg-slate-900/60', border: 'border-slate-500/50', badge: 'bg-slate-500/20 text-slate-300' },
};

const getBoxColorStyle = (color?: string | null) => {
  return COLOR_CLASSES[color || 'indigo'] || COLOR_CLASSES.indigo;
};

// All available tasks for drawer
const allTasks = computed(() => {
  return projectStore.tasks;
});

const drawerTasks = computed(() => {
  const query = taskSearchQuery.value.trim().toLowerCase();
  const todayStr = formatDateStr(new Date());

  return allTasks.value.filter((task) => {
    // Project / Tab filtering
    if (taskFilterTab.value === 'project' && task.project_id !== activeProjectId.value) {
      return false;
    }
    if (taskFilterTab.value === 'today' && task.planned_date !== todayStr) {
      return false;
    }

    // Search query filter
    if (query) {
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchTags = task.tags?.some((t) => t.toLowerCase().includes(query));
      if (!matchTitle && !matchTags) return false;
    }

    return true;
  });
});

// Map task ID to Task object
const taskMap = computed(() => {
  const map = new Map<string, Task>();
  projectStore.tasks.forEach((t) => map.set(t.id, t));
  return map;
});

const getTask = (id: string): Task | undefined => taskMap.value.get(id);

const isTaskDone = (task: Task): boolean => {
  return ['done', 'archive', 'archived', 'completed'].includes(task.bucket.toLowerCase());
};

// Drag and drop handling
const onTaskDragStart = (event: DragEvent, task: Task) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'copyMove';
  }
};

const onBoxDragOver = (event: DragEvent, timeboxId: string) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  draggingOverBoxId.value = timeboxId;
};

const onBoxDragLeave = (_event: DragEvent, timeboxId: string) => {
  if (draggingOverBoxId.value === timeboxId) {
    draggingOverBoxId.value = null;
  }
};

const onBoxDrop = async (event: DragEvent, timeboxId: string) => {
  event.preventDefault();
  draggingOverBoxId.value = null;
  const taskId = event.dataTransfer?.getData('text/plain');
  if (taskId) {
    await timeboxStore.allocateTask(timeboxId, taskId);
  }
};

const unallocateTask = async (timeboxId: string, taskId: string, e: Event) => {
  e.stopPropagation();
  await timeboxStore.unallocateTask(timeboxId, taskId);
};

// Timebox Move and Resize State
const isMovingTimebox = ref(false);
const movingTimeboxId = ref<string | null>(null);
const movingGhost = ref<{ id: string; date: string; startTime: string; endTime: string } | null>(null);

const isResizingTimebox = ref(false);
const resizingTimeboxId = ref<string | null>(null);
const resizingGhost = ref<{ id: string; date: string; startTime: string; endTime: string } | null>(null);

const minutesToTime = (mins: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getDayDateFromClientX = (clientX: number, defaultDate: string): string => {
  const elements = document.querySelectorAll<HTMLElement>('.timebox-day-col');
  for (const el of Array.from(elements)) {
    const rect = el.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) {
      const date = el.getAttribute('data-date');
      if (date) return date;
    }
  }
  return defaultDate;
};

// Start moving a timebox across dates/times
const startTimeboxMove = (event: MouseEvent, tb: Timebox) => {
  if (event.button !== 0) return;

  const target = event.target as HTMLElement;
  if (target.closest('button, .task-card-item, .timebox-resize-handle, input, a')) return;

  const startClientX = event.clientX;
  const startClientY = event.clientY;
  const originalDate = tb.date;
  const origStartMin = timeToMinutes(tb.startTime);
  const origEndMin = timeToMinutes(tb.endTime);
  const durationMin = origEndMin - origStartMin;

  let hasMoved = false;

  const onMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - startClientX;
    const deltaY = e.clientY - startClientY;

    if (!hasMoved && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      hasMoved = true;
      isMovingTimebox.value = true;
      movingTimeboxId.value = tb.id;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
    }

    if (hasMoved) {
      const targetDate = getDayDateFromClientX(e.clientX, originalDate);
      const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
      const rawStartMinutes = origStartMin + deltaMinutes;
      const snappedStartMin = Math.round(rawStartMinutes / 15) * 15;

      const minAllowed = startHour.value * 60;
      const maxAllowed = (endHour.value + 1) * 60 - durationMin;
      const clampedStartMin = Math.max(minAllowed, Math.min(maxAllowed, snappedStartMin));
      const clampedEndMin = clampedStartMin + durationMin;

      movingGhost.value = {
        id: tb.id,
        date: targetDate,
        startTime: minutesToTime(clampedStartMin),
        endTime: minutesToTime(clampedEndMin),
      };
    }
  };

  const onMouseUp = async () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    if (hasMoved && movingGhost.value) {
      const { date: newDate, startTime: newStart, endTime: newEnd } = movingGhost.value;
      if (newDate !== tb.date || newStart !== tb.startTime || newEnd !== tb.endTime) {
        await timeboxStore.updateTimebox(tb.id, {
          date: newDate,
          startTime: newStart,
          endTime: newEnd,
        });
      }
    } else if (!hasMoved) {
      modalStore.openTimeboxEdit(tb);
    }

    isMovingTimebox.value = false;
    movingTimeboxId.value = null;
    movingGhost.value = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

// Start resizing a timebox duration
const startTimeboxResize = (event: MouseEvent, tb: Timebox) => {
  if (event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();

  const startClientY = event.clientY;
  const origStartMin = timeToMinutes(tb.startTime);
  const origEndMin = timeToMinutes(tb.endTime);
  const origDuration = origEndMin - origStartMin;

  let hasResized = false;

  const onMouseMove = (e: MouseEvent) => {
    const deltaY = e.clientY - startClientY;

    if (!hasResized && Math.abs(deltaY) > 3) {
      hasResized = true;
      isResizingTimebox.value = true;
      resizingTimeboxId.value = tb.id;
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
        date: tb.date,
        startTime: tb.startTime,
        endTime: minutesToTime(newEndMin),
      };
    }
  };

  const onMouseUp = async () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    if (hasResized && resizingGhost.value) {
      const { endTime: newEnd } = resizingGhost.value;
      if (newEnd !== tb.endTime) {
        await timeboxStore.updateTimebox(tb.id, { endTime: newEnd });
      }
    }

    isResizingTimebox.value = false;
    resizingTimeboxId.value = null;
    resizingGhost.value = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const getEffectiveTimebox = (tb: Timebox): Timebox => {
  if (movingGhost.value && movingGhost.value.id === tb.id) {
    return {
      ...tb,
      date: movingGhost.value.date,
      startTime: movingGhost.value.startTime,
      endTime: movingGhost.value.endTime,
    };
  }
  if (resizingGhost.value && resizingGhost.value.id === tb.id) {
    return {
      ...tb,
      endTime: resizingGhost.value.endTime,
    };
  }
  return tb;
};

const timeboxesForDay = (dateStr: string) => {
  return timeboxStore.timeboxes
    .map(getEffectiveTimebox)
    .filter((tb) => tb.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
};

const openTimeboxEdit = (tb: Timebox, e: Event) => {
  e.stopPropagation();
  modalStore.openTimeboxEdit(tb);
};

const openTaskDetail = (task: Task) => {
  router.push({
    name: 'board-task',
    params: { projectId: task.project_id || activeProjectId.value, taskId: task.id },
  });
};

// Current time indicator & live tracker
const currentTime = ref(new Date());
let timeInterval: any = null;
const gridScrollContainer = ref<HTMLElement | null>(null);

const hasTodayInWeek = computed(() => weekDays.value.some((d) => d.isToday));

const currentTimeStr = computed(() => {
  const now = currentTime.value;
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
});

const scrollToCurrentTime = () => {
  if (!gridScrollContainer.value) return;
  if (hasTodayInWeek.value && nowIndicatorStyle.value) {
    const topPx = parseFloat(nowIndicatorStyle.value.top);
    gridScrollContainer.value.scrollTop = Math.max(0, topPx - 160);
  }
};

onMounted(() => {
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
  <div class="timeboxing-view flex-1 flex flex-col h-full overflow-hidden bg-theme-base">
    <!-- Top Toolbar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-theme-border/60 bg-theme-card/60 shrink-0 gap-4 flex-wrap">
      <!-- Week Navigation Controls -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="resetToToday"
          class="px-3 py-1 text-xs font-bold rounded-lg border border-theme-border/80 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-all cursor-pointer shadow-xs"
        >
          {{ t('timebox.today') }}
        </button>
        <div class="flex items-center border border-theme-border/80 rounded-lg overflow-hidden bg-theme-column/30">
          <button
            type="button"
            @click="prevWeek"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-colors cursor-pointer"
            :title="t('timebox.prevWeek')"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <button
            type="button"
            @click="nextWeek"
            class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-colors cursor-pointer"
            :title="t('timebox.nextWeek')"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
        <span class="text-sm font-bold text-theme-text-main flex items-center gap-1.5 ml-2">
          <Calendar class="w-4 h-4 text-theme-primary" />
          {{ weekRangeTitle }}
        </span>
      </div>

      <!-- Center & Right Controls -->
      <div class="flex items-center gap-3">
        <!-- 5-day / 7-day Toggle -->
        <div class="flex items-center bg-theme-column/50 border border-theme-border/80 rounded-lg p-0.5 text-xs font-semibold">
          <button
            type="button"
            @click="setWeekMode('workweek')"
            class="px-2.5 py-1 rounded transition-all cursor-pointer"
            :class="weekMode === 'workweek' ? 'bg-theme-primary text-white shadow-xs' : 'text-theme-text-muted hover:text-theme-text-main'"
          >
            {{ t('timebox.workweek') }}
          </button>
          <button
            type="button"
            @click="setWeekMode('fullweek')"
            class="px-2.5 py-1 rounded transition-all cursor-pointer"
            :class="weekMode === 'fullweek' ? 'bg-theme-primary text-white shadow-xs' : 'text-theme-text-muted hover:text-theme-text-main'"
          >
            {{ t('timebox.fullweek') }}
          </button>
        </div>

        <!-- Add Box Button -->
        <button
          type="button"
          @click="modalStore.openTimeboxEdit()"
          class="px-3 py-1.5 text-xs font-bold bg-theme-primary text-white hover:bg-theme-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ t('timebox.addBox') }}</span>
        </button>

        <!-- Toggle Tasks Drawer Button -->
        <button
          type="button"
          @click="isTaskDrawerOpen = !isTaskDrawerOpen"
          class="p-1.5 rounded-lg border border-theme-border/80 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-all cursor-pointer"
          :title="isTaskDrawerOpen ? t('timebox.hideDrawer') : t('timebox.showDrawer')"
        >
          <PanelRightClose v-if="isTaskDrawerOpen" class="w-4 h-4" />
          <PanelRight v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Main Schedule Body -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Calendar Grid Area -->
      <div ref="gridScrollContainer" class="flex-1 flex flex-col h-full overflow-y-auto min-w-0 custom-scrollbar">
        <!-- Week Day Headers -->
        <div class="flex border-b border-theme-border/60 bg-theme-card/40 sticky top-0 z-20 shrink-0">
          <!-- Time label gutter spacer -->
          <div class="w-14 shrink-0 border-r border-theme-border/40"></div>
          <!-- Day Header Columns -->
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            class="flex-1 py-2.5 px-3 text-center border-r border-theme-border/40 last:border-r-0 min-w-[120px]"
            :class="day.isToday ? 'bg-theme-primary/5' : ''"
          >
            <div class="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">
              {{ day.dayName }}
            </div>
            <div
              class="text-base font-extrabold mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors"
              :class="day.isToday ? 'bg-theme-primary text-white shadow-xs' : 'text-theme-text-main'"
            >
              {{ day.dayNumber }}
            </div>
          </div>
        </div>

        <!-- Time Grid & Columns -->
        <div class="flex flex-1 relative" :style="{ minHeight: `${hoursList.length * HOUR_HEIGHT}px` }">
          <!-- Time Labels Column -->
          <div class="w-14 shrink-0 border-r border-theme-border/40 flex flex-col select-none relative">
            <div
              v-for="hour in hoursList"
              :key="hour"
              :style="{ height: `${HOUR_HEIGHT}px` }"
              class="border-b border-theme-border/20 text-[10px] font-semibold text-theme-text-muted/70 flex items-start justify-end pr-2 pt-1.5"
            >
              {{ String(hour).padStart(2, '0') }}:00
            </div>

            <!-- Current Time Gutter Indicator Pill -->
            <div
              v-if="hasTodayInWeek && nowIndicatorStyle"
              :style="nowIndicatorStyle"
              class="absolute right-0 -translate-y-1/2 z-30 pointer-events-none pr-1"
            >
              <span
                class="px-1 py-0.5 rounded bg-rose-500 text-white font-mono font-extrabold text-[9px] shadow-sm flex items-center gap-1"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                {{ currentTimeStr }}
              </span>
            </div>
          </div>

          <!-- Day Columns -->
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            :data-date="day.dateStr"
            class="timebox-day-col flex-1 border-r border-theme-border/40 last:border-r-0 relative flex flex-col min-w-[130px]"
            :class="day.isToday ? 'bg-theme-primary/[0.02]' : ''"
          >
            <!-- Background Hour Slot Rows (Clickable) -->
            <div
              v-for="hour in hoursList"
              :key="hour"
              :style="{ height: `${HOUR_HEIGHT}px` }"
              @click="handleSlotClick(day.dateStr, hour)"
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
              v-if="day.isToday && nowIndicatorStyle"
              :style="nowIndicatorStyle"
              class="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
            >
              <div class="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.25 shadow-md ring-4 ring-rose-500/20"></div>
              <div class="h-0.5 bg-rose-500 flex-1 shadow-md"></div>
            </div>

            <!-- Render Timeboxes for this Day -->
            <div
              v-for="tb in timeboxesForDay(day.dateStr)"
              :key="tb.id"
              :style="getTimeboxStyle(tb)"
              @mousedown="startTimeboxMove($event, tb)"
              @dragover="onBoxDragOver($event, tb.id)"
              @dragleave="onBoxDragLeave($event, tb.id)"
              @drop="onBoxDrop($event, tb.id)"
              class="absolute left-1 right-1 rounded-lg border p-2 shadow-sm transition-all flex flex-col overflow-hidden cursor-move group select-none z-10"
              :class="[
                getBoxColorStyle(tb.color).bg,
                getBoxColorStyle(tb.color).border,
                draggingOverBoxId === tb.id ? 'ring-2 ring-theme-primary bg-theme-primary/20 scale-[1.01]' : '',
                movingTimeboxId === tb.id ? 'ring-2 ring-white/80 shadow-2xl opacity-90 scale-[1.02] z-30' : '',
                resizingTimeboxId === tb.id ? 'ring-2 ring-amber-400 shadow-xl opacity-95 z-30' : '',
              ]"
            >
              <!-- Box Header: Time badge + Title + Edit Button -->
              <div class="flex items-center justify-between gap-1.5 shrink-0 mb-1.5 pb-1 border-b border-white/10 pointer-events-auto">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-[10px] font-extrabold px-1.5 py-0.25 rounded bg-black/25 text-theme-text-main tracking-tight shrink-0">
                    {{ tb.startTime }} - {{ tb.endTime }}
                  </span>
                  <span class="text-xs font-bold text-theme-text-main truncate" :title="tb.title">
                    {{ tb.title }}
                  </span>
                </div>
                <button
                  type="button"
                  @click.stop="openTimeboxEdit(tb, $event)"
                  class="p-0.5 rounded text-theme-text-muted hover:text-theme-text-main opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                  :title="t('buttons.edit')"
                >
                  <Edit2 class="w-3 h-3" />
                </button>
              </div>

              <!-- Allocated Tasks List Inside Box -->
              <div class="flex-1 overflow-y-auto space-y-1 min-h-0 pr-0.5 pb-2 custom-scrollbar">
                <template v-for="taskId in tb.taskIds" :key="taskId">
                  <div
                    v-if="getTask(taskId)"
                    @click.stop="openTaskDetail(getTask(taskId)!)"
                    class="task-card-item flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-theme-card/90 border border-theme-border/60 text-[11px] font-medium text-theme-text-main hover:bg-theme-column/90 transition-all cursor-pointer group/item shadow-2xs"
                    :class="isTaskDone(getTask(taskId)!) ? 'opacity-50 line-through' : ''"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 v-if="isTaskDone(getTask(taskId)!)" class="w-3 h-3 text-emerald-400 shrink-0" />
                      <Circle v-else class="w-3 h-3 text-theme-text-muted shrink-0" />
                      <span class="truncate">{{ getTask(taskId)!.title }}</span>
                    </div>
                    <button
                      type="button"
                      @click.stop="unallocateTask(tb.id, taskId, $event)"
                      class="p-0.5 text-theme-text-muted hover:text-rose-400 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 cursor-pointer"
                      :title="t('timebox.unallocate')"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                </template>
                <div
                  v-if="!tb.taskIds || tb.taskIds.length === 0"
                  class="h-full min-h-[28px] flex items-center justify-center text-[10px] text-theme-text-muted/60 border border-dashed border-theme-border/40 rounded p-1"
                >
                  {{ t('timebox.dropTasksHere') }}
                </div>
              </div>

              <!-- Bottom Resize Handle -->
              <div
                @mousedown.stop="startTimeboxResize($event, tb)"
                class="timebox-resize-handle absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-white/20 transition-colors flex items-center justify-center z-20 group/resize"
                :title="t('timebox.resize')"
              >
                <div class="w-8 h-1 rounded-full bg-white/30 group-hover/resize:bg-white/80 transition-colors"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tasks Drawer / Unallocated Task Sidebar -->
      <div
        v-if="isTaskDrawerOpen"
        class="w-80 border-l border-theme-border/60 bg-theme-card/70 flex flex-col shrink-0 animate-slideLeft z-20"
      >
        <!-- Drawer Header -->
        <div class="p-3.5 border-b border-theme-border/60 space-y-3 shrink-0">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
              <Box class="w-4 h-4 text-theme-primary" />
              {{ t('timebox.tasksDrawerTitle') }}
            </h3>
            <span class="text-[11px] font-semibold text-theme-text-muted bg-theme-column px-2 py-0.5 rounded-full">
              {{ drawerTasks.length }}
            </span>
          </div>

          <!-- Quick Tabs -->
          <div class="flex items-center bg-theme-column/50 border border-theme-border/80 rounded-lg p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              @click="taskFilterTab = 'project'"
              class="flex-1 py-1 text-center rounded transition-all cursor-pointer"
              :class="
                taskFilterTab === 'project' ? 'bg-theme-primary text-white shadow-xs' : 'text-theme-text-muted hover:text-theme-text-main'
              "
            >
              {{ t('timebox.activeProject') }}
            </button>
            <button
              type="button"
              @click="taskFilterTab = 'today'"
              class="flex-1 py-1 text-center rounded transition-all cursor-pointer"
              :class="
                taskFilterTab === 'today' ? 'bg-theme-primary text-white shadow-xs' : 'text-theme-text-muted hover:text-theme-text-main'
              "
            >
              {{ t('timebox.todayPlanned') }}
            </button>
            <button
              type="button"
              @click="taskFilterTab = 'all'"
              class="flex-1 py-1 text-center rounded transition-all cursor-pointer"
              :class="
                taskFilterTab === 'all' ? 'bg-theme-primary text-white shadow-xs' : 'text-theme-text-muted hover:text-theme-text-main'
              "
            >
              {{ t('timebox.allTasks') }}
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-theme-text-muted" />
            <input
              v-model="taskSearchQuery"
              type="text"
              :placeholder="t('timebox.searchTasksPlaceholder')"
              class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-theme-base/80 border border-theme-border text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
            />
          </div>
        </div>

        <!-- Draggable Tasks List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div
            v-for="task in drawerTasks"
            :key="task.id"
            draggable="true"
            @dragstart="onTaskDragStart($event, task)"
            class="task-card p-2.5 rounded-lg bg-theme-base/80 border border-theme-border/80 hover:border-theme-primary/60 shadow-xs transition-all cursor-grab active:cursor-grabbing group select-none"
            :class="timeboxStore.timeboxForTask(task.id) ? 'opacity-60 bg-theme-column/30' : ''"
          >
            <div class="flex items-start justify-between gap-1.5 mb-1">
              <span
                class="text-xs font-semibold text-theme-text-main group-hover:text-theme-primary transition-colors line-clamp-2"
                :class="isTaskDone(task) ? 'line-through text-theme-text-muted' : ''"
              >
                {{ task.title }}
              </span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
              <!-- Bucket Badge -->
              <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-theme-column text-theme-text-muted">
                {{ task.bucket }}
              </span>

              <!-- Priority Badge -->
              <span
                v-if="task.priority && task.priority !== 'none'"
                class="text-[10px] font-bold px-1.5 py-0.5 rounded"
                :class="{
                  'bg-rose-500/20 text-rose-300': task.priority === 'urgent',
                  'bg-amber-500/20 text-amber-300': task.priority === 'high',
                  'bg-blue-500/20 text-blue-300': task.priority === 'medium',
                  'bg-slate-500/20 text-slate-300': task.priority === 'low',
                }"
              >
                !{{ task.priority }}
              </span>

              <!-- Allocated Pill (if already in a box) -->
              <span
                v-if="timeboxStore.timeboxForTask(task.id)"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 flex items-center gap-1"
              >
                <Box class="w-2.5 h-2.5" />
                {{ timeboxStore.timeboxForTask(task.id)!.title }}
              </span>
            </div>
          </div>

          <div
            v-if="drawerTasks.length === 0"
            class="py-8 text-center text-xs text-theme-text-muted/70 flex flex-col items-center justify-center gap-2"
          >
            <Sparkles class="w-5 h-5 text-theme-text-muted/40" />
            {{ t('timebox.noTasksToSchedule') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
