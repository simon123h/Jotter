<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settings';
import { computed } from 'vue';
import { Calendar, Clock, AlertCircle, ArrowRight, UserCheck, Trash } from '@lucide/vue';
import type { Task } from '../types';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
}>();

const settingsStore = useSettingsStore();
const { thresholdDays } = storeToRefs(settingsStore);

const updateThreshold = (val: number) => {
  if (val < 1) val = 1;
  settingsStore.setThresholdDays(val);
};

// Check if task is urgent
const isUrgent = (task: Task): boolean => {
  if (!task.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= thresholdDays.value;
};

// Check if task is prioritized (Important)
const isPrioritized = (task: Task): boolean => {
  return task.priority === 'high' || task.priority === 'urgent';
};

// Quadrants definition
const quadrants = computed(() => {
  const q1: Task[] = [];
  const q2: Task[] = [];
  const q3: Task[] = [];
  const q4: Task[] = [];

  props.tasks.forEach((task) => {
    // Exclude completed tasks
    if (task.bucket === 'done') return;

    const urg = isUrgent(task);
    const prio = isPrioritized(task);

    if (urg && prio) q1.push(task);
    else if (!urg && prio) q2.push(task);
    else if (urg && !prio) q3.push(task);
    else q4.push(task);
  });

  return { q1, q2, q3, q4 };
});

const getPriorityClasses = (prio: string) => {
  switch (prio) {
    case 'low':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'urgent':
      return 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden select-none w-full gap-3.5">
    <!-- Adjust Threshold Controls -->
    <div class="flex items-center justify-between bg-theme-card/35 border border-theme-border/60 rounded px-4 py-2.5 shrink-0">
      <div class="flex items-center gap-2 text-sm font-semibold text-theme-text-card">
        <Clock class="w-4 h-4 text-theme-accent" />
        <span>{{ t('matrix.thresholdLabel', { days: thresholdDays }) }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          @click="updateThreshold(thresholdDays - 1)"
          class="w-6 h-6 flex items-center justify-center bg-theme-card border border-theme-border rounded hover:bg-theme-column/80 text-theme-text-card text-xs font-bold cursor-pointer transition-colors"
          :disabled="thresholdDays <= 1"
        >
          -
        </button>
        <input
          type="number"
          :value="thresholdDays"
          @change="(e) => updateThreshold(Number((e.target as HTMLInputElement).value))"
          min="1"
          class="w-12 text-center bg-theme-base/60 border border-theme-border rounded py-0.5 text-xs font-bold text-theme-text-input focus:outline-none focus:border-theme-primary"
        />
        <button
          @click="updateThreshold(thresholdDays + 1)"
          class="w-6 h-6 flex items-center justify-center bg-theme-card border border-theme-border rounded hover:bg-theme-column/80 text-theme-text-card text-xs font-bold cursor-pointer transition-colors"
        >
          +
        </button>
      </div>
    </div>

    <!-- 2x2 Matrix Grid -->
    <div class="flex-grow grid grid-cols-1 md:grid-cols-2 gap-3.5 min-h-0 overflow-y-auto md:overflow-hidden p-0.5">
      <!-- Q1: Urgent & Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden md:h-full">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-red-500/5 flex items-center gap-2 shrink-0">
          <AlertCircle class="w-4.5 h-4.5 text-red-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-red-400 truncate">{{ t('matrix.q1Title') }}</h4>
            <p class="text-xs text-theme-text-muted leading-tight truncate">{{ t('matrix.q1Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded">
            {{ quadrants.q1.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2 scroller-thin">
          <div v-if="!quadrants.q1.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <div
            v-else
            v-for="task in quadrants.q1"
            :key="task.id"
            @click="emit('task-click', task)"
            class="bg-theme-card border border-theme-border/60 hover:border-red-500/40 p-2.5 rounded shadow-sm hover:shadow-theme-ring transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
          >
            <div class="flex justify-between items-start gap-2">
              <span class="text-sm text-theme-text-card line-clamp-2 leading-tight">{{ task.title }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-xs">
              <span v-if="task.due_date" class="flex items-center gap-1 text-red-400 font-medium">
                <Calendar class="w-3 h-3" />
                <span>{{ formatDate(task.due_date) }}</span>
              </span>
              <span
                v-if="task.priority"
                class="px-1.5 py-0.25 rounded border text-[10px] font-extrabold uppercase"
                :class="getPriorityClasses(task.priority)"
              >
                {{ task.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Q2: Important & Not Urgent -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden md:h-full">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-blue-500/5 flex items-center gap-2 shrink-0">
          <ArrowRight class="w-4.5 h-4.5 text-blue-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-blue-400 truncate">{{ t('matrix.q2Title') }}</h4>
            <p class="text-xs text-theme-text-muted leading-tight truncate">{{ t('matrix.q2Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold rounded">
            {{ quadrants.q2.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2 scroller-thin">
          <div v-if="!quadrants.q2.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <div
            v-else
            v-for="task in quadrants.q2"
            :key="task.id"
            @click="emit('task-click', task)"
            class="bg-theme-card border border-theme-border/60 hover:border-blue-500/40 p-2.5 rounded shadow-sm hover:shadow-theme-ring transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
          >
            <div class="flex justify-between items-start gap-2">
              <span class="text-sm text-theme-text-card line-clamp-2 leading-tight">{{ task.title }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-xs">
              <span v-if="task.due_date" class="flex items-center gap-1 text-theme-text-muted">
                <Calendar class="w-3 h-3" />
                <span>{{ formatDate(task.due_date) }}</span>
              </span>
              <span
                v-if="task.priority"
                class="px-1.5 py-0.25 rounded border text-[10px] font-extrabold uppercase"
                :class="getPriorityClasses(task.priority)"
              >
                {{ task.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Q3: Urgent & Not Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden md:h-full">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-orange-500/5 flex items-center gap-2 shrink-0">
          <UserCheck class="w-4.5 h-4.5 text-orange-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-orange-400 truncate">{{ t('matrix.q3Title') }}</h4>
            <p class="text-xs text-theme-text-muted leading-tight truncate">{{ t('matrix.q3Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold rounded">
            {{ quadrants.q3.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2 scroller-thin">
          <div v-if="!quadrants.q3.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <div
            v-else
            v-for="task in quadrants.q3"
            :key="task.id"
            @click="emit('task-click', task)"
            class="bg-theme-card border border-theme-border/60 hover:border-orange-500/40 p-2.5 rounded shadow-sm hover:shadow-theme-ring transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
          >
            <div class="flex justify-between items-start gap-2">
              <span class="text-sm text-theme-text-card line-clamp-2 leading-tight">{{ task.title }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-xs">
              <span v-if="task.due_date" class="flex items-center gap-1 text-red-400 font-medium">
                <Calendar class="w-3 h-3" />
                <span>{{ formatDate(task.due_date) }}</span>
              </span>
              <span
                v-if="task.priority"
                class="px-1.5 py-0.25 rounded border text-[10px] font-extrabold uppercase"
                :class="getPriorityClasses(task.priority)"
              >
                {{ task.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Q4: Not Urgent & Not Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden md:h-full">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-slate-500/5 flex items-center gap-2 shrink-0">
          <Trash class="w-4.5 h-4.5 text-slate-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-slate-400 truncate">{{ t('matrix.q4Title') }}</h4>
            <p class="text-xs text-theme-text-muted leading-tight truncate">{{ t('matrix.q4Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-bold rounded">
            {{ quadrants.q4.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2 scroller-thin">
          <div v-if="!quadrants.q4.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <div
            v-else
            v-for="task in quadrants.q4"
            :key="task.id"
            @click="emit('task-click', task)"
            class="bg-theme-card border border-theme-border/60 hover:border-slate-500/40 p-2.5 rounded shadow-sm hover:shadow-theme-ring transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
          >
            <div class="flex justify-between items-start gap-2">
              <span class="text-sm text-theme-text-card line-clamp-2 leading-tight">{{ task.title }}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-xs">
              <span v-if="task.due_date" class="flex items-center gap-1 text-theme-text-muted">
                <Calendar class="w-3 h-3" />
                <span>{{ formatDate(task.due_date) }}</span>
              </span>
              <span
                v-if="task.priority"
                class="px-1.5 py-0.25 rounded border text-[10px] font-extrabold uppercase"
                :class="getPriorityClasses(task.priority)"
              >
                {{ task.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
