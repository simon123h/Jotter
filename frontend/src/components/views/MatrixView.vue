<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { computed } from 'vue';
import { Clock, AlertCircle, ArrowRight, UserCheck, Trash } from '@lucide/vue';
import type { Task } from '@/types';
import TaskCard from '@/components/ui/TaskCard.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'toggle-select', task: Task): void;
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
    // Exclude completed or archived tasks
    if (task.bucket === 'done' || task.bucket === 'archive') return;

    const urgent = isUrgent(task);
    const important = isPrioritized(task);

    if (urgent && important) q1.push(task);
    else if (!urgent && important) q2.push(task);
    else if (urgent && !important) q3.push(task);
    else q4.push(task);
  });

  return { q1, q2, q3, q4 };
});
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <!-- Header with Threshold Slider -->
    <div class="flex items-center justify-between px-1">
      <div class="flex flex-col">
        <h2 class="text-lg font-bold text-theme-text-main flex items-center gap-2">
          <Clock class="w-5 h-5 text-theme-accent" />
          {{ t('views.matrix') }}
        </h2>
        <span class="text-xs text-theme-text-muted uppercase tracking-widest font-semibold">Eisenhower Matrix</span>
      </div>

      <div class="flex flex-col items-end gap-1">
        <label class="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
          {{ t('matrix.thresholdLabel', { days: thresholdDays }) }}
        </label>
        <div class="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="30"
            :value="thresholdDays"
            @input="updateThreshold(parseInt(($event.target as HTMLInputElement).value))"
            class="w-48 h-1.5 bg-theme-column/40 rounded-lg appearance-none cursor-pointer accent-theme-primary"
          />
        </div>
      </div>
    </div>

    <!-- 2x2 Grid -->
    <div class="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
      <!-- Q1: Urgent & Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-rose-500/5 flex items-center gap-2 shrink-0">
          <AlertCircle class="w-4.5 h-4.5 text-rose-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-rose-400 truncate">{{ t('matrix.q1Title') }}</h4>
            <p class="text-[10px] text-theme-text-muted leading-tight truncate uppercase tracking-tighter opacity-70">{{ t('matrix.q1Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded">
            {{ quadrants.q1.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2.5 scroller-thin">
          <div v-if="!quadrants.q1.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <TaskCard
            v-for="task in quadrants.q1"
            :key="task.id"
            :task="task"
            :compact="true"
            :is-selected="isSelected(task.id)"
            @click="emit('task-click', task)"
            @toggle-select="emit('toggle-select', task)"
          />
        </div>
      </div>

      <!-- Q2: Not Urgent & Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-emerald-500/5 flex items-center gap-2 shrink-0">
          <ArrowRight class="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-emerald-400 truncate">{{ t('matrix.q2Title') }}</h4>
            <p class="text-[10px] text-theme-text-muted leading-tight truncate uppercase tracking-tighter opacity-70">{{ t('matrix.q2Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded">
            {{ quadrants.q2.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2.5 scroller-thin">
          <div v-if="!quadrants.q2.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <TaskCard
            v-for="task in quadrants.q2"
            :key="task.id"
            :task="task"
            :compact="true"
            :is-selected="isSelected(task.id)"
            @click="emit('task-click', task)"
            @toggle-select="emit('toggle-select', task)"
          />
        </div>
      </div>

      <!-- Q3: Urgent & Not Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-orange-500/5 flex items-center gap-2 shrink-0">
          <UserCheck class="w-4.5 h-4.5 text-orange-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-orange-400 truncate">{{ t('matrix.q3Title') }}</h4>
            <p class="text-[10px] text-theme-text-muted leading-tight truncate uppercase tracking-tighter opacity-70">{{ t('matrix.q3Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold rounded">
            {{ quadrants.q3.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2.5 scroller-thin">
          <div v-if="!quadrants.q3.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <TaskCard
            v-for="task in quadrants.q3"
            :key="task.id"
            :task="task"
            :compact="true"
            :is-selected="isSelected(task.id)"
            @click="emit('task-click', task)"
            @toggle-select="emit('toggle-select', task)"
          />
        </div>
      </div>

      <!-- Q4: Not Urgent & Not Important -->
      <div class="flex flex-col bg-theme-column/40 border border-theme-border rounded h-full min-h-[220px] overflow-hidden">
        <div class="px-3.5 py-2.5 border-b border-theme-border bg-slate-500/5 flex items-center gap-2 shrink-0">
          <Trash class="w-4.5 h-4.5 text-slate-400 shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-sm uppercase tracking-wider text-slate-400 truncate">{{ t('matrix.q4Title') }}</h4>
            <p class="text-[10px] text-theme-text-muted leading-tight truncate uppercase tracking-tighter opacity-70">{{ t('matrix.q4Desc') }}</p>
          </div>
          <span class="ml-auto px-2 py-0.25 bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-bold rounded">
            {{ quadrants.q4.length }}
          </span>
        </div>
        <div class="flex-grow p-3 overflow-y-auto space-y-2.5 scroller-thin">
          <div v-if="!quadrants.q4.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-xs">
            {{ t('matrix.emptyQuadrant') }}
          </div>
          <TaskCard
            v-for="task in quadrants.q4"
            :key="task.id"
            :task="task"
            :compact="true"
            :is-selected="isSelected(task.id)"
            @click="emit('task-click', task)"
            @toggle-select="emit('toggle-select', task)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
