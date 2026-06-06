<script setup lang="ts">
import { computed } from 'vue';
import type { Task, Project } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
  projects: Project[];
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'mark-done', task: Task): void;
  (e: 'update-planned-date', payload: { taskId: string; plannedDate: string; projectId: string }): void;
}>();

// Group tasks into categorical planning columns (Aggregated)
const timeColumns = computed(() => {
  const groups: Record<string, Task[]> = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    thisMonth: [],
    thisYear: [],
    sometime: [],
    notPlanned: [],
  };

  props.tasks.forEach((task) => {
    if (task.bucket === 'done' || task.bucket === 'archive') return;

    const key = task.planned_date || 'notPlanned';
    if (groups[key]) {
      groups[key].push(task);
    } else {
      groups.notPlanned.push(task);
    }
  });

  return [
    { id: 'today', title: t('plannedDateOptions.today'), tasks: groups.today, color: 'red' },
    { id: 'tomorrow', title: t('plannedDateOptions.tomorrow'), tasks: groups.tomorrow, color: 'orange' },
    { id: 'thisWeek', title: t('plannedDateOptions.thisWeek'), tasks: groups.thisWeek, color: 'yellow' },
    { id: 'thisMonth', title: t('plannedDateOptions.thisMonth'), tasks: groups.thisMonth, color: 'blue' },
    { id: 'thisYear', title: t('plannedDateOptions.thisYear'), tasks: groups.thisYear, color: 'green' },
    { id: 'sometime', title: t('plannedDateOptions.sometime'), tasks: groups.sometime, color: 'purple' },
    { id: 'notPlanned', title: t('plannedDateOptions.notPlanned'), tasks: groups.notPlanned, color: 'slate' },
  ];
});

const handleCardDropped = (payload: { taskId: string; toId: string }) => {
  const task = props.tasks.find(t => t.id === payload.taskId);
  if (!task) return;
  emit('update-planned-date', { 
    taskId: payload.taskId, 
    plannedDate: payload.toId === 'notPlanned' ? '' : payload.toId,
    projectId: task.project_id
  });
};
</script>

<template>
  <div class="flex flex-col h-full space-y-4">
    <div class="px-1">
      <h2 class="text-lg font-bold text-theme-text-main flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-theme-accent animate-pulse"></span>
        {{ t('views.superTime') || 'Global Planning' }}
        <span class="text-xs font-normal text-theme-text-muted ml-2 uppercase tracking-widest">Across all projects</span>
      </h2>
    </div>

    <div class="flex gap-3.5 items-stretch overflow-x-auto pb-2 flex-grow select-none w-full scroller-thin">
      <GenericColumn
        v-for="col in timeColumns"
        :key="col.id"
        :id="col.id"
        :title="col.title"
        :tasks="col.tasks"
        :color="col.color"
        group-name="super-time-view"
        :compact-cards="true"
        :show-project="true"
        :projects="projects"
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

        <!-- Custom Task Card content to show Project Badge -->
        <!-- Since GenericColumn doesn't support custom card slot yet, I'll need to update TaskCard.vue or GenericColumn.vue -->
      </GenericColumn>
    </div>
  </div>
</template>
