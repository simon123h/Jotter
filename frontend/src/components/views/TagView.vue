<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { Task } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useBuckets } from '@/composables/useBuckets';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const { activeProjectId, hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

const props = defineProps<{
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

const { fetchBuckets } = useBuckets(activeProjectId, hideDoneColumn, hideArchiveColumn);
const { handleMarkTaskDone, handleTagUpdate } = useTaskMutations(ref(props.tasks), activeProjectId, fetchBuckets, async () => { emit('refresh'); });

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

const handleCardDropped = async (payload: { taskId: string; toId: string }) => {
  const task = props.tasks.find((t) => t.id === payload.taskId);
  if (!task) return;

  if (payload.toId === 'untagged') {
    await handleTagUpdate({ taskId: payload.taskId, tags: [] });
    emit('refresh');
    return;
  }

  const newTag = payload.toId;
  const currentTags = task.tags ?? [];
  if (!currentTags.includes(newTag)) {
    const newTags = [...currentTags, newTag];
    await handleTagUpdate({ taskId: payload.taskId, tags: newTags });
    emit('refresh');
  }
};

const onMarkDone = async (task: Task) => {
    await handleMarkTaskDone(task);
    emit('refresh');
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
      @mark-done="onMarkDone"
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
