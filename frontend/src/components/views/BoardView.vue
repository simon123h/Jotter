<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, MoreHorizontal, ChevronLeft } from '@lucide/vue';
import Sortable from 'sortablejs';
import type { Task, Bucket, BucketName } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import ColumnEditModal from '@/components/modals/ColumnEditModal.vue';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useBuckets } from '@/composables/useBuckets';
import { useUiStore } from '@/stores/ui';
import { storeToRefs } from 'pinia';

const { t } = useI18n();
const route = useRoute();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const uiStore = useUiStore();
const activeProjectId = computed(() => (route.params.projectId as string) || '');
const { hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

const isCollapsed = (bucketName: string) => {
  return (
    uiStore.isColumnCollapsed(activeProjectId.value, bucketName) ||
    (uiStore.collapseEmptyColumns && (tasksByBucket.value[bucketName] || []).length === 0)
  );
};

const props = defineProps<{
  buckets: Bucket[];
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

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

const tasksByBucket = computed(() => {
  const groups: Record<string, Task[]> = {};
  props.buckets.forEach((b) => {
    groups[b.name] = [];
  });

  props.tasks.forEach((task) => {
    const b = task.bucket;
    if (groups[b] === undefined) {
      groups[b] = [];
    }
    groups[b].push(task);
  });

  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => a.position - b.position);
  });

  return groups;
});

const { fetchBuckets, handleCreateColumn, handleRenameColumn, handleDeleteColumn, handleColumnReordered } = useBuckets(
  activeProjectId,
  hideDoneColumn,
  hideArchiveColumn
);

const { tasks: storeTasks } = storeToRefs(projectStore);
const { handleCardDropped, handleMarkTaskDone } = useTaskMutations(storeTasks, activeProjectId, fetchBuckets, async () => {
  emit('refresh');
});

// Need a way to keep useTaskMutations in sync with props.tasks
// Actually, useTaskMutations expects a Ref<Task[]>.
// Since props are reactive, we can wrap it or just use the logic directly.
// For now, let's just use the functions from the composable but pass the right data.

const currentEditingBucket = ref<Bucket | null>(null);
const isEditModalOpen = ref(false);

const openEditColumn = (bucket: Bucket) => {
  currentEditingBucket.value = bucket;
  isEditModalOpen.value = true;
};

const onSaveColumn = async (payload: any) => {
  if (!currentEditingBucket.value) return;
  await handleRenameColumn({
    bucketName: currentEditingBucket.value.name,
    newTitle: payload.title,
    newSubtitle: payload.subtitle,
    newColor: payload.color,
    newLayout: payload.layout,
    newMaxTasks: payload.max_tasks,
    newIsDefault: payload.is_default,
  });
  emit('refresh');
};

const onColumnDeleted = async (name: string) => {
  await handleDeleteColumn(name);
  emit('refresh');
};

const onColumnReordered = async (payload: any) => {
  await handleColumnReordered(payload);
  emit('refresh');
};

const onCardDropped = async (payload: any) => {
  // We need to pass the real tasks ref here
  // But handleCardDropped uses the ref we passed to useTaskMutations.
  // Let's refactor BoardView to be more self-contained.
  await handleCardDropped({
    taskId: payload.taskId,
    toBucket: payload.toId as BucketName,
    prevTaskId: payload.prevTaskId,
    nextTaskId: payload.nextTaskId,
  });
  emit('refresh');
};

const onMarkDone = async (task: Task) => {
  await handleMarkTaskDone(task);
  emit('refresh');
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
        onColumnReordered({ oldIndex, newIndex });
      },
    });
  }
});

const onAddColumn = async () => {
  const title = newColumnTitle.value.trim();
  const subtitle = newColumnSubtitle.value.trim();
  if (!title) return;
  await handleCreateColumn(title, subtitle);
  emit('refresh');
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
      :is-selected="isSelected"
      :is-collapsed="isCollapsed(b.name)"
      @add-task-click="(id) => emit('add-task-click', id as BucketName)"
      @card-dropped="onCardDropped"
      @mark-done="onMarkDone"
      @toggle-select="(task) => emit('toggle-select', task)"
      @toggle-collapse="uiStore.toggleColumnCollapse(activeProjectId, b.name)"
    >
      <!-- Header Slot -->
      <template #header="{ classes }">
        <div
          class="px-3 py-2 flex justify-between items-center border-b rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
          :class="[classes.bg, classes.border]"
        >
          <div class="flex-grow flex flex-col justify-center overflow-hidden mr-1">
            <div class="flex items-center gap-1.5 overflow-hidden">
              <h3
                class="font-bold text-sm uppercase tracking-wider truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
                :class="[classes.text]"
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
                    : classes.badge,
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
              @click.stop="uiStore.toggleColumnCollapse(activeProjectId, b.name)"
              class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer animate-fade-in"
              :title="t('collapseColumnTooltip')"
            >
              <ChevronLeft class="w-4 h-4 shrink-0" />
            </button>
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

    <div class="flex flex-col gap-3 shrink-0 w-72">
      <!-- Add Column Card -->
      <button
        v-if="!isAddingColumn"
        @click="isAddingColumn = true"
        class="flex items-center justify-center gap-2 bg-theme-column/20 hover:bg-theme-column/40 border border-dashed border-theme-border/60 hover:border-theme-accent text-theme-text-muted hover:text-theme-text-main font-semibold text-sm cursor-pointer w-full shrink-0 h-[48px] rounded transition-all shadow-sm"
      >
        <Plus class="w-4 h-4 shrink-0" />
        {{ t('buttons.addColumn') }}
      </button>
      <div
        v-else
        class="flex flex-col bg-theme-column/20 border border-dashed border-theme-border/60 rounded w-full shrink-0 p-3 h-fit space-y-2.5"
      >
        <h4 class="font-bold text-xs uppercase tracking-wider text-theme-text-muted">{{ t('newColumnTitle') }}</h4>
        <input
          v-model="newColumnTitle"
          type="text"
          :placeholder="t('columnTitlePlaceholder')"
          class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-sm text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary"
          @keyup.enter="onAddColumn"
          @keyup.esc="handleCancelAddColumn"
          autofocus
        />
        <input
          v-model="newColumnSubtitle"
          type="text"
          placeholder="Column description/subtitle (optional)"
          class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-sm text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary font-sans italic"
          @keyup.enter="onAddColumn"
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
            @click="onAddColumn"
            class="text-xs font-semibold px-2 py-1 bg-theme-primary hover:bg-theme-primary-hover text-white rounded cursor-pointer"
          >
            {{ t('buttons.add') }}
          </button>
        </div>
      </div>

      <!-- board display options container -->
      <div
        class="flex flex-col bg-theme-column/10 border border-theme-border/40 rounded text-xs text-theme-text-muted overflow-hidden divide-y divide-theme-border/30"
      >
        <!-- auto-collapse empty columns check -->
        <label
          class="flex items-center gap-2 px-3 py-2.5 select-none cursor-pointer hover:bg-theme-column/20 hover:text-theme-text-main transition-all"
        >
          <input
            type="checkbox"
            :checked="uiStore.collapseEmptyColumns"
            @change="uiStore.setCollapseEmptyColumns(($event.target as HTMLInputElement).checked)"
            class="rounded text-theme-primary focus:ring-theme-ring cursor-pointer"
          />
          <span class="font-semibold">{{ t('autoCollapseEmptyColumns') }}</span>
        </label>

        <!-- hide done column check -->
        <label
          class="flex items-center gap-2 px-3 py-2.5 select-none cursor-pointer hover:bg-theme-column/20 hover:text-theme-text-main transition-all"
        >
          <input
            type="checkbox"
            :checked="settingsStore.hideDoneColumn"
            @change="settingsStore.hideDoneColumn = ($event.target as HTMLInputElement).checked"
            class="rounded text-theme-primary focus:ring-theme-ring cursor-pointer"
          />
          <span class="font-semibold">{{ t('doneBucket.hide') }}</span>
        </label>

        <!-- hide archive column check -->
        <label
          class="flex items-center gap-2 px-3 py-2.5 select-none cursor-pointer hover:bg-theme-column/20 hover:text-theme-text-main transition-all"
        >
          <input
            type="checkbox"
            :checked="settingsStore.hideArchiveColumn"
            @change="settingsStore.hideArchiveColumn = ($event.target as HTMLInputElement).checked"
            class="rounded text-theme-primary focus:ring-theme-ring cursor-pointer"
          />
          <span class="font-semibold">{{ t('archiveBucket.hide') }}</span>
        </label>
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
      @delete-column="onColumnDeleted(currentEditingBucket.name)"
    />
  </div>
</template>
