<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Sortable from 'sortablejs';
import type { Task, BucketName } from '../types';
import TaskCard from './TaskCard.vue';

const props = defineProps<{
  bucketName: BucketName;
  title: string;
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: number; toBucket: BucketName; oldIndex: number; newIndex: number }): void;
}>();

const cardsContainer = ref<HTMLElement | null>(null);

onMounted(() => {
  if (cardsContainer.value) {
    Sortable.create(cardsContainer.value, {
      group: 'kanban-board',
      animation: 180,
      delay: 0,
      ghostClass: 'opacity-40',
      chosenClass: 'scale-[1.02]',
      dragClass: 'rotate-1',
      // Triggered when dragging finishes
      onEnd: (evt) => {
        const { item, to, oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined) return;
        
        const taskId = Number(item.getAttribute('data-task-id'));
        const toBucket = to.getAttribute('data-bucket-name') as BucketName;
        
        emit('card-dropped', {
          taskId,
          toBucket,
          oldIndex,
          newIndex,
        });
      },
    });
  }
});
</script>

<template>
  <div class="flex flex-col bg-slate-850/50 border border-slate-800/80 rounded-2xl w-full max-h-[80vh] min-w-[280px]">
    <!-- Column Header -->
    <div class="px-5 py-4 flex justify-between items-center border-b border-slate-800 bg-slate-850/30 rounded-t-2xl shrink-0">
      <div class="flex items-center gap-2.5">
        <h3 class="font-bold text-sm uppercase tracking-wider text-slate-300">{{ title }}</h3>
        <span class="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700/60 text-slate-400 font-bold rounded-full">
          {{ tasks.length }}
        </span>
      </div>
      <button
        @click="emit('add-task-click', bucketName)"
        class="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-lg transition-colors"
        title="Add task to this column"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Cards Container -->
    <div
      ref="cardsContainer"
      :data-bucket-name="bucketName"
      class="flex-grow p-4 overflow-y-auto space-y-3 min-h-[150px] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
    >
      <TaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :data-task-id="task.id"
        @click="emit('task-click', task)"
      />
    </div>
  </div>
</template>

<style scoped>
/* Scoped scrollbar styling for board lists */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 20px;
}
</style>
