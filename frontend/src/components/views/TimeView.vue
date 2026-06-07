<script setup lang="ts">
import { onMounted, watch } from 'vue';
import type { Task } from '@/types';
import TimelineLayout from '@/components/layout/TimelineLayout.vue';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { storeToRefs } from 'pinia';

defineProps<{
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const { activeProjectId, hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

const fetchViewTasks = async () => {
  if (!activeProjectId.value) return;
  await projectStore.fetchTasks({
    projectId: activeProjectId.value,
  });
};

onMounted(async () => {
  await fetchViewTasks();
});

watch([activeProjectId, hideDoneColumn, hideArchiveColumn], async () => {
  await fetchViewTasks();
});
</script>

<template>
  <TimelineLayout
    :tasks="tasks"
    group-name="time-view"
    :is-selected="isSelected"
    @toggle-select="emit('toggle-select', $event)"
    @refresh="emit('refresh')"
  />
</template>
