<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'mark-done', task: Task): void;
  (e: 'update-due-date', payload: { taskId: string; columnId: string }): void;
}>();

export type TimeColumnId = 'noDate' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'thisYear';

// Group tasks into relative time columns
const timeColumns = computed(() => {
  const groups: Record<TimeColumnId, Task[]> = {
    noDate: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    thisMonth: [],
    thisYear: [],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  props.tasks.forEach((task) => {
    // Exclude completed tasks
    if (task.bucket === 'done') return;

    if (!task.due_date) {
      groups.noDate.push(task);
      return;
    }

    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      groups.today.push(task);
    } else if (diffDays === 1) {
      groups.tomorrow.push(task);
    } else if (diffDays > 1 && diffDays <= 7) {
      groups.thisWeek.push(task);
    } else if (diffDays > 7 && diffDays <= 30) {
      groups.thisMonth.push(task);
    } else {
      groups.thisYear.push(task);
    }
  });

  return [
    { id: 'noDate' as TimeColumnId, title: t('timeView.noDate'), tasks: groups.noDate, color: 'slate' },
    { id: 'today' as TimeColumnId, title: t('timeView.today'), tasks: groups.today, color: 'red' },
    { id: 'tomorrow' as TimeColumnId, title: t('timeView.tomorrow'), tasks: groups.tomorrow, color: 'orange' },
    { id: 'thisWeek' as TimeColumnId, title: t('timeView.thisWeek'), tasks: groups.thisWeek, color: 'yellow' },
    { id: 'thisMonth' as TimeColumnId, title: t('timeView.thisMonth'), tasks: groups.thisMonth, color: 'blue' },
    { id: 'thisYear' as TimeColumnId, title: t('timeView.thisYear'), tasks: groups.thisYear, color: 'green' },
  ];
});

const handleCardDropped = (payload: { taskId: string; toId: string }) => {
  emit('update-due-date', { taskId: payload.taskId, columnId: payload.toId });
};
</script>

<template>
  <div class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <GenericColumn
      v-for="col in timeColumns"
      :key="col.id"
      :id="col.id"
      :title="col.title"
      :tasks="col.tasks"
      :color="col.color"
      group-name="time-view"
      :compact-cards="true"
      @task-click="(task) => emit('task-click', task)"
      @mark-done="(task) => emit('mark-done', task)"
      @card-dropped="handleCardDropped"
    >
      <template #header>
        <div
          class="px-3.5 py-2.5 flex justify-between items-center border-b border-theme-border rounded-t shrink-0 min-h-[48px] bg-theme-card/10"
        >
          <div class="flex items-center gap-2 min-w-0">
            <h3 class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate">
              {{ col.title }}
            </h3>
            <span
              class="text-xs px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0"
            >
              {{ col.tasks.length }}
            </span>
          </div>
        </div>
      </template>
    </GenericColumn>
  </div>
</template>
