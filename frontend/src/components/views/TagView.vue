<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'mark-done', task: Task): void;
  (e: 'update-task-tags', payload: { taskId: string; tags: string[] }): void;
  (e: 'toggle-select', task: Task): void;
}>();

// Group tasks by their tags
const tagColumns = computed(() => {
  const groups: Record<string, Task[]> = {};
  const untagged: Task[] = [];

  props.tasks.forEach((task) => {
    // Exclude archived tasks
    if (task.bucket === 'archive') return;

    if (!task.tags || task.tags.length === 0) {
      untagged.push(task);
      return;
    }

    task.tags.forEach((tag) => {
      if (!groups[tag]) {
        groups[tag] = [];
      }
      groups[tag].push(task);
    });
  });

  const sortedTags = Object.keys(groups).sort();
  const columns = sortedTags.map((tag) => ({
    id: tag,
    title: tag.toUpperCase(),
    tasks: groups[tag],
  }));

  if (untagged.length > 0) {
    columns.push({
      id: 'untagged',
      title: t('tagView.untagged') || 'Untagged',
      tasks: untagged,
    });
  }

  return columns;
});

const handleCardDropped = (payload: { taskId: string; toId: string }) => {
  const task = props.tasks.find(t => t.id === payload.taskId);
  if (!task) return;

  // If dropped into 'untagged', remove all tags
  if (payload.toId === 'untagged') {
    emit('update-task-tags', { taskId: payload.taskId, tags: [] });
    return;
  }

  // If dropped into a tag column, ensure the task has that tag
  const newTag = payload.toId;
  if (!task.tags.includes(newTag)) {
    const newTags = [...task.tags, newTag];
    emit('update-task-tags', { taskId: payload.taskId, tags: newTags });
  }
};
</script>

<template>
  <div class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <div v-if="tagColumns.length === 0" class="flex-grow flex items-center justify-center text-theme-text-muted italic">
      {{ t('tagView.noTags') || 'No tags found in this project' }}
    </div>
    
    <GenericColumn
      v-for="col in tagColumns"
      :key="col.id"
      :id="col.id"
      :title="col.title"
      :tasks="col.tasks"
      group-name="tag-view"
      :compact-cards="true"
      :is-selected="isSelected"
      @task-click="(task) => emit('task-click', task)"
      @mark-done="(task) => emit('mark-done', task)"
      @card-dropped="handleCardDropped"
      @toggle-select="(task) => emit('toggle-select', task)"
    >
      <template #header>
        <div
          class="px-3.5 py-2.5 flex justify-between items-center border-b border-theme-border rounded-t shrink-0 min-h-[48px] bg-theme-card/10"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-2 h-2 rounded-full bg-theme-accent"></div>
            <h3 class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate">
              {{ col.title }}
            </h3>
            <span class="text-xs px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0">
              {{ col.tasks.length }}
            </span>
          </div>
        </div>
      </template>
    </GenericColumn>
  </div>
</template>
