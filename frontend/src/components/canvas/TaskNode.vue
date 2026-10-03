<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { Trash2 } from '@lucide/vue';
import { useRouter, useRoute } from 'vue-router';
import type { Task } from '@/types';
import TaskCard from '@/components/ui/TaskCard.vue';
import { useCanvasStore } from '@/stores/canvas';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';

const props = defineProps<{
  id: string;
  data: {
    task?: Task;
    file?: string;
    color?: string | null;
  };
  selected?: boolean;
}>();

const router = useRouter();
const route = useRoute();
const canvasStore = useCanvasStore();
const projectStore = useProjectStore();
const selectionStore = useSelectionStore();

const isTaskSelected = computed(() => {
  return task.value ? selectionStore.isSelected(task.value.id) : false;
});

const handleToggleSelect = (selectedTask: Task) => {
  selectionStore.toggleSelection(selectedTask.id);
};

const task = computed<Task | undefined>(() => {
  if (props.data.task) return props.data.task;
  if (props.data.file) {
    const taskId = props.data.file.replace(/\.md$/, '');
    return projectStore.tasks.find((t) => t.id === taskId);
  }
  return undefined;
});

const openTaskModal = () => {
  if (task.value) {
    router.push({
      name: 'canvas-task',
      params: {
        projectId: route.params.projectId,
        canvasId: route.params.canvasId || 'main',
        taskId: task.value.id,
      },
    });
  }
};

const removeNode = () => {
  canvasStore.removeNode(props.id);
};
</script>

<template>
  <div
    class="canvas-task-node relative group rounded-lg transition-shadow w-[280px]"
    :class="[selected || isTaskSelected ? 'ring-2 ring-theme-primary ring-offset-2 ring-offset-theme-base shadow-md' : '']"
  >
    <!-- Vue Flow Connection Handles -->
    <Handle id="top" type="source" :position="Position.Top" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />
    <Handle id="right" type="source" :position="Position.Right" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />
    <Handle id="bottom" type="source" :position="Position.Bottom" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />
    <Handle id="left" type="source" :position="Position.Left" class="vue-flow-handle" @mousedown.stop @pointerdown.stop />

    <!-- Node Toolbar Controls (Visible on hover or selected) -->
    <div
      class="absolute -top-3.5 right-2 hidden group-hover:flex items-center gap-1 bg-theme-column/90 border border-theme-border shadow-sm rounded-md px-1.5 py-0.5 z-10 text-xs backdrop-blur"
    >
      <button
        @click.stop="removeNode"
        title="Remove from canvas"
        class="text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer p-0.5"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Inner Task Card Rendering -->
    <template v-if="task">
      <TaskCard
        :task="task"
        :show-tags="true"
        :show-done-button="false"
        :show-footer="true"
        :allow-expand="false"
        :compact="false"
        :style="data.color ? { borderColor: data.color } : {}"
        @click="openTaskModal"
        @toggle-select="handleToggleSelect"
      />
    </template>
    <div
      v-else
      class="p-4 rounded-lg border border-theme-border bg-theme-card text-xs text-theme-text-muted italic flex items-center justify-between"
    >
      <span>File: {{ data.file || 'Unknown' }}</span>
      <button @click.stop="removeNode" class="text-rose-500 hover:underline">Remove</button>
    </div>
  </div>
</template>

<style scoped>
.canvas-task-node {
  min-width: 280px;
}
.vue-flow-handle {
  width: 12px;
  height: 12px;
  background-color: var(--color-theme-primary, #6366f1);
  border: 2px solid white;
  border-radius: 50%;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  z-index: 10;
}
/* Generous hitbox for easy hover and arrow creation */
.vue-flow-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.canvas-task-node:hover .vue-flow-handle,
.canvas-task-node.selected .vue-flow-handle {
  opacity: 1;
}
</style>
