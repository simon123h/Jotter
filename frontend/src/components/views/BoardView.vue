<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Plus, MoreHorizontal } from '@lucide/vue';
import Sortable from 'sortablejs';
import type { Task, Bucket, BucketName } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import ColumnEditModal from '@/components/modals/ColumnEditModal.vue';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settingsStore = useSettingsStore();

defineProps<{
  buckets: Bucket[];
  tasksByBucket: Record<string, Task[]>;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: string; toBucket: BucketName; prevTaskId: string | null; nextTaskId: string | null }): void;
  (
    e: 'rename-column',
    payload: {
      bucketName: string;
      newTitle: string;
      newSubtitle: string;
      newColor?: string | null;
      newLayout?: 'list' | 'grid-2' | 'grid-3';
      newMaxTasks?: number | null;
      newIsDefault?: boolean;
    }
  ): void;
  (e: 'delete-column', bucketName: string): void;
  (e: 'create-column', title: string, subtitle: string): void;
  (e: 'mark-done', task: Task): void;
  (e: 'column-reordered', payload: { oldIndex: number; newIndex: number }): void;
}>();

const currentEditingBucket = ref<Bucket | null>(null);
const isEditModalOpen = ref(false);

const openEditColumn = (bucket: Bucket) => {
  currentEditingBucket.value = bucket;
  isEditModalOpen.value = true;
};

const onSaveColumn = (payload: any) => {
  if (!currentEditingBucket.value) return;
  emit('rename-column', {
    bucketName: currentEditingBucket.value.name,
    newTitle: payload.title,
    newSubtitle: payload.subtitle,
    newColor: payload.color,
    newLayout: payload.layout,
    newMaxTasks: payload.max_tasks,
    newIsDefault: payload.is_default,
  });
};

const handleCardDropped = (payload: any) => {
  emit('card-dropped', {
    taskId: payload.taskId,
    toBucket: payload.toId as BucketName,
    prevTaskId: payload.prevTaskId,
    nextTaskId: payload.nextTaskId,
  });
};

// Column create state
const isAddingColumn = ref(false);
const newColumnTitle = ref('');
const newColumnSubtitle = ref('');

const columnsContainer = ref<HTMLElement | null>(null);

onMounted(() => {
  if (columnsContainer.value) {
    Sortable.create(columnsContainer.value, {
      animation: 180,
      draggable: '.group\\/col',
      handle: '.column-drag-handle',
      filter: 'button, input, select, textarea',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        emit('column-reordered', { oldIndex, newIndex });
      },
    });
  }
});

const handleAddColumn = () => {
  const title = newColumnTitle.value.trim();
  const subtitle = newColumnSubtitle.value.trim();
  if (!title) return;
  emit('create-column', title, subtitle);
  newColumnTitle.value = '';
  newColumnSubtitle.value = '';
  isAddingColumn.value = false;
};

const handleCancelAddColumn = () => {
  newColumnTitle.value = '';
  newColumnSubtitle.value = '';
  isAddingColumn.value = false;
};
</script>

<template>
  <div ref="columnsContainer" class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <GenericColumn
      v-for="b in buckets"
      :key="b.name"
      :id="b.name"
      :title="t('buckets.' + b.name) !== 'buckets.' + b.name ? t('buckets.' + b.name) : b.title"
      :subtitle="b.subtitle"
      :tasks="tasksByBucket[b.name] || []"
      :layout="b.layout"
      :color="b.color"
      :max-tasks="b.max_tasks"
      :is-limit-exceeded="!!b.max_tasks && (tasksByBucket[b.name] || []).length > b.max_tasks"
      :show-add-task="true"
      group-name="kanban-board"
      @task-click="(task) => emit('task-click', task)"
      @add-task-click="(id) => emit('add-task-click', id as BucketName)"
      @card-dropped="handleCardDropped"
      @mark-done="(task) => emit('mark-done', task)"
    >
      <!-- Header Slot -->
      <template #header>
        <div
          class="px-3 py-2 flex justify-between items-center border-b border-theme-border bg-theme-card/30 rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
        >
          <div class="flex-grow flex flex-col justify-center overflow-hidden mr-1">
            <div class="flex items-center gap-1.5 overflow-hidden">
              <h3
                class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
                @dblclick="openEditColumn(b)"
                :title="t('doubleClickToRename')"
              >
                {{ t('buckets.' + b.name) !== 'buckets.' + b.name ? t('buckets.' + b.name) : b.title }}
              </h3>
              <span
                class="text-xs px-1.5 py-0.25 font-bold rounded shrink-0 transition-all duration-300"
                :class="[
                  b.max_tasks && (tasksByBucket[b.name] || []).length > b.max_tasks
                    ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 animate-pulse'
                    : 'bg-theme-card border border-theme-border/60 text-theme-text-muted',
                ]"
              >
                {{ b.max_tasks ? `${(tasksByBucket[b.name] || []).length}/${b.max_tasks}` : (tasksByBucket[b.name] || []).length }}
              </span>
            </div>
            <span
              v-if="b.subtitle"
              class="text-xs text-theme-text-muted truncate cursor-pointer font-sans italic hover:text-theme-accent leading-normal"
              @dblclick="openEditColumn(b)"
            >
              {{ b.subtitle }}
            </span>
          </div>
          <div class="flex items-center shrink-0 gap-1">
            <button
              v-if="settingsStore.hideAddTaskButton"
              @click="emit('add-task-click', b.name)"
              class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
            >
              <Plus class="w-4 h-4 shrink-0" />
            </button>
            <button
              @click="openEditColumn(b)"
              class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
              :title="t('renameColumnTooltip')"
            >
              <MoreHorizontal class="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </template>

      <!-- Custom Add Button -->
      <template #add-button>
        <button
          v-if="!settingsStore.hideAddTaskButton"
          @click="emit('add-task-click', b.name)"
          class="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 mb-2.5 bg-theme-card/35 hover:bg-theme-accent/10 text-theme-text-muted hover:text-theme-accent border border-transparent rounded transition-all cursor-pointer group/btn shrink-0"
        >
          <Plus class="w-3.5 h-3.5 shrink-0 transition-transform group-hover/btn:scale-110" />
          <span class="text-sm font-semibold">{{ t('addTaskButton') }}</span>
        </button>
      </template>
    </GenericColumn>

    <!-- Add Column Card -->
    <button
      v-if="!isAddingColumn"
      @click="isAddingColumn = true"
      class="flex items-center justify-center gap-2 bg-theme-column/20 hover:bg-theme-column/40 border border-dashed border-theme-border/60 hover:border-theme-accent text-theme-text-muted hover:text-theme-text-main font-semibold text-sm cursor-pointer w-72 shrink-0 h-[48px] rounded transition-all shadow-sm"
    >
      <Plus class="w-4 h-4 shrink-0" />
      {{ t('buttons.addColumn') }}
    </button>
    <div
      v-else
      class="flex flex-col bg-theme-column/20 border border-dashed border-theme-border/60 rounded w-72 shrink-0 p-3 h-fit space-y-2.5"
    >
      <h4 class="font-bold text-xs uppercase tracking-wider text-theme-text-muted">{{ t('newColumnTitle') }}</h4>
      <input
        v-model="newColumnTitle"
        type="text"
        :placeholder="t('columnTitlePlaceholder')"
        class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-sm text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary"
        @keyup.enter="handleAddColumn"
        @keyup.esc="handleCancelAddColumn"
        autofocus
      />
      <input
        v-model="newColumnSubtitle"
        type="text"
        placeholder="Column description/subtitle (optional)"
        class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-sm text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary font-sans italic"
        @keyup.enter="handleAddColumn"
        @keyup.esc="handleCancelAddColumn"
      />
      <div class="flex gap-1.5 justify-end">
        <button
          @click="handleCancelAddColumn"
          class="text-xs font-semibold px-2 py-1 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded cursor-pointer"
        >
          {{ t('buttons.cancel') }}
        </button>
        <button
          @click="handleAddColumn"
          class="text-xs font-semibold px-2 py-1 bg-theme-primary hover:bg-theme-primary-hover text-white rounded cursor-pointer"
        >
          {{ t('buttons.add') }}
        </button>
      </div>
    </div>

    <!-- Edit Modal -->
    <ColumnEditModal
      v-if="currentEditingBucket"
      :is-open="isEditModalOpen"
      :bucket-name="currentEditingBucket.name"
      :initial-title="currentEditingBucket.title"
      :initial-subtitle="currentEditingBucket.subtitle"
      :initial-color="currentEditingBucket.color"
      :initial-layout="currentEditingBucket.layout"
      :initial-max-tasks="currentEditingBucket.max_tasks"
      :initial-is-default="currentEditingBucket.is_default"
      :tasks-count="(tasksByBucket[currentEditingBucket.name] || []).length"
      @close="
        isEditModalOpen = false;
        currentEditingBucket = null;
      "
      @save="onSaveColumn"
      @delete-column="emit('delete-column', currentEditingBucket.name)"
    />
  </div>
</template>
