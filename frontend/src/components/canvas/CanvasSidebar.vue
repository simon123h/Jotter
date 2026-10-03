<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Search, CheckCircle2 } from '@lucide/vue';
import type { Task } from '@/types';
import { useCanvasStore } from '@/stores/canvas';
import { useProjectStore } from '@/stores/project';
import { useI18n } from '@/composables/useI18n';
import TaskCard from '@/components/ui/TaskCard.vue';

const { t } = useI18n();
const canvasStore = useCanvasStore();
const projectStore = useProjectStore();

const searchQuery = ref('');
const activeBucket = ref<string>('all');

const projectTasks = computed(() => {
  return projectStore.tasks;
});

// Tasks that are not yet placed on this canvas
const unplacedTasks = computed(() => {
  return projectTasks.value.filter((task) => !canvasStore.isTaskPlaced(task.id));
});

// Filtered tasks by search & bucket
const filteredUnplacedTasks = computed(() => {
  let list = unplacedTasks.value;
  if (activeBucket.value !== 'all') {
    list = list.filter((t) => t.bucket === activeBucket.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.body && t.body.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  }
  return list;
});

const onDragStart = (event: DragEvent, task: Task) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/jotter-task', JSON.stringify(task));
    event.dataTransfer.effectAllowed = 'move';
  }
};
</script>

<template>
  <aside
    class="w-80 md:w-96 flex-shrink-0 bg-theme-card border-l border-theme-border flex flex-col h-full shadow-lg z-20 transition-all duration-300 select-none"
  >
    <!-- Header -->
    <div class="px-4 py-3 border-b border-theme-border flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-bold text-theme-text-main">
          {{ t('canvas.unplacedTasks') || 'Unplaced Tasks' }}
        </h3>
        <span class="px-1.5 py-0.5 text-[11px] font-semibold bg-theme-column text-theme-text-muted rounded-full">
          {{ unplacedTasks.length }}
        </span>
      </div>
      <button
        @click="canvasStore.isDrawerOpen = false"
        class="p-1 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column transition-colors cursor-pointer"
        title="Close"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="p-3 border-b border-theme-border space-y-2">
      <!-- Search Input -->
      <div class="relative">
        <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('searchPlaceholder') || 'Search tasks...'"
          class="w-full pl-8 pr-3 py-1.5 text-xs bg-theme-column/40 border border-theme-border rounded text-theme-text-main placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-theme-primary"
        />
      </div>

      <!-- Bucket filter chips -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        <button
          @click="activeBucket = 'all'"
          class="px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0"
          :class="
            activeBucket === 'all'
              ? 'bg-theme-primary text-white font-medium'
              : 'bg-theme-column/40 text-theme-text-muted hover:text-theme-text-main'
          "
        >
          All
        </button>
        <button
          v-for="b in projectStore.buckets"
          :key="b.name"
          @click="activeBucket = b.name"
          class="px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0"
          :class="
            activeBucket === b.name
              ? 'bg-theme-primary text-white font-medium'
              : 'bg-theme-column/40 text-theme-text-muted hover:text-theme-text-main'
          "
        >
          {{ b.title }}
        </button>
      </div>
    </div>

    <!-- Task List -->
    <div class="flex-grow overflow-y-auto p-3 space-y-2.5">
      <div v-if="filteredUnplacedTasks.length === 0" class="text-center py-12 text-theme-text-muted text-xs">
        <CheckCircle2 class="w-8 h-8 mx-auto mb-2 text-theme-text-muted/50" />
        <p v-if="unplacedTasks.length === 0">
          {{ t('canvas.allTasksPlaced') || 'All tasks have been placed on this canvas!' }}
        </p>
        <p v-else>
          {{ t('emptyStateTitle') || 'No tasks match your search' }}
        </p>
      </div>

      <div
        v-for="task in filteredUnplacedTasks"
        :key="task.id"
        draggable="true"
        @dragstart="onDragStart($event, task)"
        class="cursor-grab active:cursor-grabbing"
      >
        <TaskCard :task="task" :show-tags="true" :show-done-button="false" :show-footer="false" :allow-expand="false" :compact="true" />
      </div>
    </div>
  </aside>
</template>
