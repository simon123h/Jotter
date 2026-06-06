<script setup lang="ts">
import type { Task } from '@/types';
import TimelineLayout from '@/components/layout/TimelineLayout.vue';

defineProps<{
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();
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
