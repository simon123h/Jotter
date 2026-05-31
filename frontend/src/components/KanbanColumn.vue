<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import Sortable from 'sortablejs';
import type { Task, BucketName } from '../types';
import TaskCard from './TaskCard.vue';
import { useI18n } from '../composables/useI18n';
import { ChevronLeft, ChevronRight, Pencil, Trash2, Plus } from '@lucide/vue';

const { t } = useI18n();

const props = defineProps<{
  bucketName: BucketName;
  title: string;
  tasks: Task[];
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: number; toBucket: BucketName; oldIndex: number; newIndex: number }): void;
  (e: 'rename-column', payload: { bucketName: string; newTitle: string }): void;
  (e: 'delete-column', bucketName: string): void;
  (e: 'move-column', bucketName: string, direction: 'left' | 'right'): void;
}>();

const cardsContainer = ref<HTMLElement | null>(null);
const isEditing = ref(false);
const editTitle = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);

const startEditing = () => {
  editTitle.value = props.title;
  isEditing.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
  });
};

const saveTitle = () => {
  if (editTitle.value.trim() && editTitle.value.trim() !== props.title) {
    emit('rename-column', { bucketName: props.bucketName, newTitle: editTitle.value.trim() });
  }
  isEditing.value = false;
};

const cancelEditing = () => {
  isEditing.value = false;
};

const displayTitle = computed(() => {
  const translated = t('buckets.' + props.bucketName);
  return translated !== 'buckets.' + props.bucketName ? translated : props.title;
});

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
  <div class="flex flex-col bg-theme-column border border-theme-border rounded w-full h-full min-w-[280px] w-72 shrink-0 md:w-80 group/col">
    <!-- Column Header -->
    <div class="px-3 py-2 flex justify-between items-center border-b border-theme-border bg-theme-card/30 rounded-t shrink-0">
      <!-- Title Area (Normal or Edit Mode) -->
      <div class="flex-grow flex items-center gap-1.5 overflow-hidden mr-1">
        <div v-if="!isEditing" class="flex items-center gap-1.5 overflow-hidden">
          <h3
            class="font-bold text-xs uppercase tracking-wider text-theme-text-main truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
            @dblclick="startEditing"
            :title="t('doubleClickToRename')"
          >
            {{ displayTitle }}
          </h3>
          <span
            class="text-[9px] px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0"
          >
            {{ tasks.length }}
          </span>
        </div>
        <div v-else class="flex items-center gap-1.5 w-full">
          <input
            ref="titleInputRef"
            v-model="editTitle"
            type="text"
            class="bg-theme-card border border-theme-primary/60 rounded px-1.5 py-0.5 text-xs font-bold text-theme-text-input focus:outline-none w-full"
            @keyup.enter="saveTitle"
            @keyup.esc="cancelEditing"
            @blur="saveTitle"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-0.5 shrink-0">
        <!-- Move Left -->
        <button
          v-if="!isFirst && !isEditing"
          @click="emit('move-column', bucketName, 'left')"
          class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card rounded transition-colors cursor-pointer animate-fade-in"
          :title="t('moveColumnLeftTooltip')"
        >
          <ChevronLeft class="w-3.5 h-3.5 shrink-0" />
        </button>

        <!-- Move Right -->
        <button
          v-if="!isLast && !isEditing"
          @click="emit('move-column', bucketName, 'right')"
          class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card rounded transition-colors cursor-pointer animate-fade-in"
          :title="t('moveColumnRightTooltip')"
        >
          <ChevronRight class="w-3.5 h-3.5 shrink-0" />
        </button>

        <!-- Rename Column -->
        <button
          v-if="!isEditing"
          @click="startEditing"
          class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card rounded transition-colors cursor-pointer"
          :title="t('renameColumnTooltip')"
        >
          <Pencil class="w-3.5 h-3.5 shrink-0" />
        </button>

        <!-- Delete Column -->
        <button
          v-if="!isEditing"
          @click="emit('delete-column', bucketName)"
          :disabled="tasks.length > 0"
          class="p-1 rounded transition-colors cursor-pointer"
          :class="
            tasks.length > 0
              ? 'text-theme-text-muted/30 cursor-not-allowed opacity-40'
              : 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
          "
          :title="tasks.length > 0 ? t('deleteColumnDisabledTooltip') : t('deleteColumnTooltip')"
        >
          <Trash2 class="w-3.5 h-3.5 shrink-0" />
        </button>

        <!-- Add Task -->
        <button
          v-if="!isEditing"
          @click="emit('add-task-click', bucketName)"
          class="text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card p-1 rounded transition-colors cursor-pointer border border-theme-border/20 shadow-sm"
          :title="t('colAddTooltip')"
        >
          <Plus class="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>

    <!-- Cards Container -->
    <div
      ref="cardsContainer"
      :data-bucket-name="bucketName"
      class="flex-grow p-2.5 overflow-y-auto space-y-2.5 min-h-[150px] scroller-thin"
    >
      <TaskCard v-for="task in tasks" :key="task.id" :task="task" :data-task-id="task.id" @click="emit('task-click', task)" />
    </div>
  </div>
</template>
