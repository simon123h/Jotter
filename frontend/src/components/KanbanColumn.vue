<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import Sortable from 'sortablejs';
import type { Task, BucketName } from '../types';
import TaskCard from './TaskCard.vue';
import { useI18n } from '../composables/useI18n';
import { Pencil, Trash2, Plus } from '@lucide/vue';

const { t } = useI18n();

const props = defineProps<{
  bucketName: BucketName;
  title: string;
  subtitle: string;
  tasks: Task[];
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: number; toBucket: BucketName; oldIndex: number; newIndex: number }): void;
  (e: 'rename-column', payload: { bucketName: string; newTitle: string; newSubtitle: string }): void;
  (e: 'delete-column', bucketName: string): void;
  (e: 'mark-done', task: Task): void;
}>();

const cardsContainer = ref<HTMLElement | null>(null);
const isEditing = ref(false);
const editTitle = ref('');
const editSubtitle = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);

const startEditing = () => {
  editTitle.value = props.title;
  editSubtitle.value = props.subtitle || '';
  isEditing.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
  });
};

const saveTitle = () => {
  const cleanTitle = editTitle.value.trim();
  const cleanSubtitle = editSubtitle.value.trim();
  if (cleanTitle && (cleanTitle !== props.title || cleanSubtitle !== props.subtitle)) {
    emit('rename-column', {
      bucketName: props.bucketName,
      newTitle: cleanTitle,
      newSubtitle: cleanSubtitle,
    });
  }
  isEditing.value = false;
};

const cancelEditing = () => {
  isEditing.value = false;
};

const handleFocusOut = (event: FocusEvent) => {
  const container = event.currentTarget as HTMLElement;
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  if (!relatedTarget || !container.contains(relatedTarget)) {
    saveTitle();
  }
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
      draggable: '.task-card',
      filter: '.add-task-btn',
      preventOnFilter: true,
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
    <div
      class="px-3 py-2 flex justify-between items-center border-b border-theme-border bg-theme-card/30 rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
    >
      <!-- Title Area (Normal or Edit Mode) -->
      <div class="flex-grow flex flex-col justify-center overflow-hidden mr-1">
        <div v-if="!isEditing" class="flex flex-col gap-0.5 overflow-hidden">
          <div class="flex items-center gap-1.5 overflow-hidden">
            <h3
              class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
              @dblclick="startEditing"
              :title="t('doubleClickToRename')"
            >
              {{ displayTitle }}
            </h3>
            <span
              class="text-xs px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0"
            >
              {{ tasks.length }}
            </span>
          </div>
          <!-- Subtitle / Description -->
          <span
            v-if="subtitle"
            class="text-xs text-theme-text-muted truncate cursor-pointer font-sans italic hover:text-theme-accent leading-normal"
            @dblclick="startEditing"
            :title="t('doubleClickToRename')"
          >
            {{ subtitle }}
          </span>
        </div>
        <div v-else class="flex flex-col gap-1 w-full pr-1 py-0.5" @focusout="handleFocusOut">
          <input
            ref="titleInputRef"
            v-model="editTitle"
            type="text"
            placeholder="Column Title"
            class="bg-theme-card border border-theme-primary/60 rounded px-1.5 py-0.5 text-sm font-bold text-theme-text-input focus:outline-none w-full"
            @keyup.enter="saveTitle"
            @keyup.esc="cancelEditing"
          />
          <input
            v-model="editSubtitle"
            type="text"
            placeholder="Add description..."
            class="bg-theme-card border border-theme-border rounded px-1.5 py-0.5 text-xs text-theme-text-input focus:outline-none w-full font-sans italic"
            @keyup.enter="saveTitle"
            @keyup.esc="cancelEditing"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-0.5 shrink-0">
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
      <TaskCard
        class="task-card"
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :data-task-id="task.id"
        @click="emit('task-click', task)"
        @mark-done="emit('mark-done', $event)"
      />

      <!-- Add Task Button inside scroll area, below the last card -->
      <button
        @click="emit('add-task-click', bucketName)"
        class="add-task-btn w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-theme-border hover:border-theme-accent hover:bg-theme-card text-theme-text-muted hover:text-theme-accent rounded text-sm font-semibold transition-all cursor-pointer shadow-sm group/btn mt-2.5"
      >
        <Plus class="w-4 h-4 shrink-0 transition-transform group-hover/btn:scale-110" />
        {{ t('addTaskButton') }}
      </button>
    </div>
  </div>
</template>
