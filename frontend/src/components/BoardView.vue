<script setup lang="ts">
import { ref } from 'vue';
import { Plus } from '@lucide/vue';
import type { Task, Bucket, BucketName } from '../types';
import KanbanColumn from './KanbanColumn.vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

defineProps<{
  buckets: Bucket[];
  tasksByBucket: Record<string, Task[]>;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: number; toBucket: BucketName; oldIndex: number; newIndex: number }): void;
  (e: 'rename-column', payload: { bucketName: string; newTitle: string }): void;
  (e: 'delete-column', bucketName: string): void;
  (e: 'move-column', bucketName: string, direction: 'left' | 'right'): void;
  (e: 'create-column', title: string): void;
}>();

// Column create state (moved locally here as it belongs strictly to board view layout)
const isAddingColumn = ref(false);
const newColumnTitle = ref('');

const handleAddColumn = () => {
  const title = newColumnTitle.value.trim();
  if (!title) return;
  emit('create-column', title);
  newColumnTitle.value = '';
  isAddingColumn.value = false;
};
</script>

<template>
  <div class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <KanbanColumn
      v-for="(b, idx) in buckets"
      :key="b.name"
      :bucket-name="b.name"
      :title="b.title"
      :tasks="tasksByBucket[b.name] || []"
      :is-first="idx === 0"
      :is-last="idx === buckets.length - 1"
      @task-click="(task) => emit('task-click', task)"
      @add-task-click="(bucket) => emit('add-task-click', bucket)"
      @card-dropped="(payload) => emit('card-dropped', payload)"
      @rename-column="(payload) => emit('rename-column', payload)"
      @delete-column="(bucket) => emit('delete-column', bucket)"
      @move-column="(bucket, direction) => emit('move-column', bucket, direction)"
    />

    <!-- Add Column Card -->
    <div
      class="flex flex-col bg-theme-column/20 border border-dashed border-theme-border/60 rounded w-72 shrink-0 p-3 h-full justify-between"
    >
      <div v-if="!isAddingColumn" class="flex items-center justify-center h-20 flex-grow">
        <button
          @click="isAddingColumn = true"
          class="flex flex-col items-center gap-1.5 text-theme-text-muted hover:text-theme-text-main font-semibold text-xs cursor-pointer w-full py-4 rounded hover:bg-theme-card/30 transition-all"
        >
          <Plus class="w-5 h-5 shrink-0" />
          {{ t('buttons.addColumn') }}
        </button>
      </div>
      <div v-else class="space-y-2.5 flex-grow">
        <h4 class="font-bold text-[10px] uppercase tracking-wider text-theme-text-muted">{{ t('newColumnTitle') }}</h4>
        <input
          v-model="newColumnTitle"
          type="text"
          :placeholder="t('columnTitlePlaceholder')"
          class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-xs text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
          @keyup.enter="handleAddColumn"
          @keyup.esc="isAddingColumn = false"
          autofocus
        />
        <div class="flex gap-1.5 justify-end">
          <button
            @click="isAddingColumn = false"
            class="text-[10px] font-semibold px-2 py-1 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded cursor-pointer"
          >
            {{ t('buttons.cancel') }}
          </button>
          <button
            @click="handleAddColumn"
            class="text-[10px] font-semibold px-2 py-1 bg-theme-primary hover:bg-theme-primary-hover text-white rounded cursor-pointer"
          >
            {{ t('buttons.add') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
