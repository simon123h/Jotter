<script setup lang="ts">
import { onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import type { Task } from '@/types';
import TimelineLayout from '@/components/layout/TimelineLayout.vue';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { storeToRefs } from 'pinia';

defineProps<{
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

const route = useRoute();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const activeProjectId = computed(() => (route.params.projectId as string) || '');
const { hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

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
  <TimelineLayout :tasks="tasks" group-name="time-view" @toggle-select="emit('toggle-select', $event)" @refresh="emit('refresh')" />
</template>
