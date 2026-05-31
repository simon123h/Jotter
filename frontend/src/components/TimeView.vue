<script setup lang="ts">
import { computed } from 'vue';

import type { Task } from '../types';
import TaskCard from './TaskCard.vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'mark-done', task: Task): void;
}>();

// Group tasks into relative time columns
const timeColumns = computed(() => {
  const todayCols: Task[] = [];
  const tomorrowCols: Task[] = [];
  const thisWeekCols: Task[] = [];
  const thisMonthCols: Task[] = [];
  const thisYearCols: Task[] = [];
  const noDateCols: Task[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  props.tasks.forEach((task) => {
    // Exclude completed tasks
    if (task.bucket === 'done') return;

    if (!task.due_date) {
      noDateCols.push(task);
      return;
    }

    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      todayCols.push(task);
    } else if (diffDays === 1) {
      tomorrowCols.push(task);
    } else if (diffDays > 1 && diffDays <= 7) {
      thisWeekCols.push(task);
    } else if (diffDays > 7 && diffDays <= 30) {
      thisMonthCols.push(task);
    } else {
      thisYearCols.push(task);
    }
  });

  return [
    { id: 'today', title: t('timeView.today'), tasks: todayCols, bgClass: 'bg-red-500/5', borderClass: 'border-red-500/20' },
    { id: 'tomorrow', title: t('timeView.tomorrow'), tasks: tomorrowCols, bgClass: 'bg-orange-500/5', borderClass: 'border-orange-500/20' },
    { id: 'thisWeek', title: t('timeView.thisWeek'), tasks: thisWeekCols, bgClass: 'bg-yellow-500/5', borderClass: 'border-yellow-500/20' },
    { id: 'thisMonth', title: t('timeView.thisMonth'), tasks: thisMonthCols, bgClass: 'bg-blue-500/5', borderClass: 'border-blue-500/20' },
    { id: 'thisYear', title: t('timeView.thisYear'), tasks: thisYearCols, bgClass: 'bg-emerald-500/5', borderClass: 'border-emerald-500/20' },
    { id: 'noDate', title: t('timeView.noDate'), tasks: noDateCols, bgClass: 'bg-slate-500/5', borderClass: 'border-slate-500/20' },
  ];
});
</script>

<template>
  <div class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <div
      v-for="col in timeColumns"
      :key="col.id"
      class="flex flex-col bg-theme-column border border-theme-border rounded w-72 shrink-0 md:w-80 group/col"
    >
      <!-- Column Header -->
      <div
        class="px-3.5 py-2.5 flex justify-between items-center border-b border-theme-border rounded-t shrink-0 min-h-[48px]"
        :class="col.bgClass"
      >
        <div class="flex items-center gap-2 min-w-0">
          <h3 class="font-bold text-xs uppercase tracking-wider text-theme-text-main truncate">
            {{ col.title }}
          </h3>
          <span class="text-[10px] px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0">
            {{ col.tasks.length }}
          </span>
        </div>
      </div>

      <!-- Cards Container -->
      <div class="flex-grow p-2.5 overflow-y-auto space-y-2.5 min-h-[150px] scroller-thin">
        <div v-if="!col.tasks.length" class="h-full flex items-center justify-center text-theme-text-muted italic text-[11px] py-12">
          {{ t('timeView.emptyColumn') }}
        </div>
        <TaskCard
          v-else
          v-for="task in col.tasks"
          :key="task.id"
          :task="task"
          @click="emit('task-click', task)"
          @mark-done="emit('mark-done', task)"
        />
      </div>
    </div>
  </div>
</template>
