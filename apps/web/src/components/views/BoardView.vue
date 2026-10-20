<script setup lang="ts">
import { HORIZONS, isBeyond, today } from '@jotter/task-filter';
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { Plus } from '@lucide/vue';
import Sortable from 'sortablejs';
import type { Task, Bucket, BucketName } from '@/types';
import BoardColumn from '@/components/views/BoardColumn.vue';
import SnapScroller from '@/components/ui/SnapScroller.vue';
import ColumnEditModal from '@/components/modals/ColumnEditModal.vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useBuckets } from '@/composables/useBuckets';
import { useUiStore } from '@/stores/ui';
import { useBoardNavigation } from '@/composables/useBoardNavigation';
import { storeToRefs } from 'pinia';

const { t } = useI18n();
const route = useRoute();
const settingsStore = useSettingsStore();
const toast = useToast();
const projectStore = useProjectStore();
const uiStore = useUiStore();
const activeProjectId = computed(() => (route.params.projectId as string) || '');
const { hideDoneColumn, hideArchiveColumn, planningHorizon } = storeToRefs(settingsStore);

const isCollapsed = (bucketName: string) => {
  return (
    uiStore.isColumnCollapsed(activeProjectId.value, bucketName) ||
    (uiStore.collapseEmptyColumns && (tasksByBucket.value[bucketName] || []).length === 0)
  );
};

const props = defineProps<{
  buckets: Bucket[];
  tasks: Task[];
}>();

import { useSelectionStore } from '@/stores/selection';
const selectionStore = useSelectionStore();

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

  // A task planned beyond the horizon stays in its own column; it is only left out while the horizon is short
  const day = today();
  props.tasks.forEach((task) => {
    if (isBeyond(task.planned_date, planningHorizon.value, day)) return;
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

const bucketsRef = computed(() => props.buckets);
const {
  error: bucketError,
  fetchBuckets,
  handleCreateColumn,
  handleRenameColumn,
  handleDeleteColumn,
  handleColumnReordered,
} = useBuckets(activeProjectId, hideDoneColumn, hideArchiveColumn, bucketsRef);

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
  if (activeProjectId.value === 'all') return;
  currentEditingBucket.value = bucket;
  isEditModalOpen.value = true;
};

const onSaveColumn = async (payload: any) => {
  if (!currentEditingBucket.value) return;
  const name = currentEditingBucket.value.name; // the dialog closes, and clears the column, while this runs
  await handleRenameColumn({
    bucketName: name,
    newTitle: payload.title,
    newSubtitle: payload.subtitle,
    newColor: payload.color,
    newLayout: payload.layout,
    newMaxTasks: payload.max_tasks,
    newIsDefault: payload.is_default,
  });
  // The lower pane is a browser setting, not part of the column in the vault
  if (payload.docked !== uiStore.isColumnDocked(activeProjectId.value, name)) {
    uiStore.toggleColumnDock(activeProjectId.value, name);
  }
  emit('refresh');
};

/** The tasks that keep a column from being deleted: the ones in it, hidden ones included. */
const tasksInColumn = (name: string) => props.tasks.filter((task) => task.bucket === name).length;

const beyondCount = computed(() => props.tasks.filter((task) => isBeyond(task.planned_date, planningHorizon.value, today())).length);

const onColumnDeleted = async (name: string) => {
  bucketError.value = null;
  await handleDeleteColumn(name);
  if (bucketError.value) toast.error(bucketError.value);
  emit('refresh');
};

const onColumnReordered = async (payload: any) => {
  await handleColumnReordered(payload);
  emit('refresh');
};

const onCardDropped = async (payload: any) => {
  // Pass selectedIds if the dropped task is part of selection
  const selectedIds = selectionStore.selectedIds;
  await handleCardDropped({
    taskId: payload.taskId,
    toBucket: payload.toId as BucketName,
    prevTaskId: payload.prevTaskId,
    nextTaskId: payload.nextTaskId,
    selectedIds,
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
const dockContainer = ref<HTMLElement | null>(null);

// The columns can be dragged into another order, in the board and in the lower pane. The order is the one of the
// whole board, so the places in a pane are looked up among all the columns.
const makeColumnSortable = (el: HTMLElement, pane: () => Bucket[]) =>
  Sortable.create(el, {
    animation: 180,
    draggable: '.group\\/col',
    handle: '.column-drag-handle',
    filter: 'button, input, select, textarea',
    preventOnFilter: false,
    delay: 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    onEnd: (evt) => {
      const { oldDraggableIndex, newDraggableIndex } = evt;
      if (oldDraggableIndex === undefined || newDraggableIndex === undefined || oldDraggableIndex === newDraggableIndex) return;
      const moved = pane()[oldDraggableIndex];
      const target = pane()[newDraggableIndex];
      if (!moved || !target) return;
      onColumnReordered({ oldIndex: props.buckets.indexOf(moved), newIndex: props.buckets.indexOf(target) });
    },
  });

let boardSortable: Sortable | null = null;
let dockSortable: Sortable | null = null;

onMounted(() => {
  if (columnsContainer.value) boardSortable = makeColumnSortable(columnsContainer.value, () => boardBuckets.value);
});

// The lower pane comes and goes with its columns
watch(
  dockContainer,
  (el) => {
    dockSortable?.destroy();
    dockSortable = el ? makeColumnSortable(el, () => dockedBuckets.value) : null;
  },
  { flush: 'post' }
);

onBeforeUnmount(() => {
  boardSortable?.destroy();
  dockSortable?.destroy();
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

// The lower pane (desktop, one project): the columns that are docked there, and the divider that sizes it
const isDesktop = useMediaQuery('(min-width: 768px)');
const canDock = computed(() => isDesktop.value && activeProjectId.value !== 'all');
const isDocked = (bucketName: string) => canDock.value && uiStore.isColumnDocked(activeProjectId.value, bucketName);
const boardBuckets = computed(() => props.buckets.filter((b) => !isDocked(b.name)));
const dockedBuckets = computed(() => props.buckets.filter((b) => isDocked(b.name)));

const boardEl = ref<HTMLElement | null>(null);
const resizeLowerPane = (event: PointerEvent) => {
  event.preventDefault();
  const move = (e: PointerEvent) => {
    const rect = boardEl.value?.getBoundingClientRect();
    if (rect && rect.height > 0) uiStore.setDockHeight(((rect.bottom - e.clientY) / rect.height) * 100);
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    document.body.classList.remove('select-none');
  };
  document.body.classList.add('select-none');
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
};
const nudgeLowerPane = (percent: number) => uiStore.setDockHeight(uiStore.dockHeight + percent);

const visibleBuckets = computed(() => [...boardBuckets.value, ...dockedBuckets.value].filter((b) => !isCollapsed(b.name)));
const tasksRef = computed(() => props.tasks);

useBoardNavigation({
  visibleBuckets,
  tasksByBucket,
  tasks: tasksRef,
});
</script>

<template>
  <div ref="boardEl" class="flex flex-col h-full min-h-0 w-full">
    <div class="flex-1 min-h-0">
      <SnapScroller>
        <div ref="columnsContainer" class="flex gap-0 md:gap-3.5 items-stretch h-full">
          <BoardColumn
            v-for="b in boardBuckets"
            :key="b.name"
            :bucket="b"
            :tasks="tasksByBucket[b.name] || []"
            :project-id="activeProjectId"
            :is-collapsed="isCollapsed(b.name)"
            :is-docked="false"
            @add-task-click="(name) => emit('add-task-click', name)"
            @card-dropped="onCardDropped"
            @mark-done="onMarkDone"
            @toggle-select="(task) => emit('toggle-select', task)"
            @toggle-collapse="uiStore.toggleColumnCollapse(activeProjectId, b.name)"
            @edit="openEditColumn"
          />
        </div>

        <div
          class="flex flex-col gap-3 shrink-0 w-[100vw] min-w-[100vw] max-w-[100vw] px-3 md:px-0 md:w-72 md:min-w-0 md:max-w-none snap-page"
        >
          <!-- Add Column Card -->
          <button
            v-if="!isAddingColumn && activeProjectId !== 'all'"
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
              :placeholder="t('columnEdit.subtitlePlaceholder')"
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

            <!-- how far ahead planned tasks are shown -->
            <label
              class="flex items-center gap-2 px-3 py-2.5 select-none hover:bg-theme-column/20 hover:text-theme-text-main transition-all"
            >
              <span class="font-semibold">{{ t('planningHorizon.label') }}</span>
              <select
                v-model="settingsStore.planningHorizon"
                class="rounded bg-transparent text-theme-text-main focus:ring-theme-ring cursor-pointer"
                data-testid="planning-horizon"
              >
                <option v-for="horizon in HORIZONS" :key="horizon" :value="horizon">{{ t('planningHorizon.' + horizon) }}</option>
              </select>
              <span v-if="beyondCount" class="text-theme-text-muted" data-testid="beyond-count">{{ beyondCount }}</span>
            </label>
          </div>
        </div>
      </SnapScroller>
    </div>

    <!-- The lower pane: the docked columns, across the whole width, under a divider that sizes it -->
    <template v-if="dockedBuckets.length">
      <div
        role="separator"
        aria-orientation="horizontal"
        tabindex="0"
        :aria-label="t('resizeLowerPane')"
        :aria-valuenow="uiStore.dockHeight"
        class="group/divider shrink-0 h-3 -my-0.5 flex items-center justify-center cursor-row-resize touch-none z-10 focus:outline-none"
        data-testid="lower-pane-divider"
        @pointerdown="resizeLowerPane"
        @keydown.up.prevent.stop="nudgeLowerPane(5)"
        @keydown.down.prevent.stop="nudgeLowerPane(-5)"
      >
        <div
          class="w-16 h-1 rounded-full bg-theme-border group-hover/divider:bg-theme-accent group-focus-visible/divider:bg-theme-accent transition-colors"
        ></div>
      </div>
      <div class="min-h-0 pb-2" :style="{ flex: `0 0 ${uiStore.dockHeight}%` }" data-testid="lower-pane">
        <div ref="dockContainer" class="flex gap-3.5 items-stretch h-full">
          <BoardColumn
            v-for="b in dockedBuckets"
            :key="b.name"
            :bucket="b"
            :tasks="tasksByBucket[b.name] || []"
            :project-id="activeProjectId"
            :is-collapsed="isCollapsed(b.name)"
            :is-docked="true"
            @add-task-click="(name) => emit('add-task-click', name)"
            @card-dropped="onCardDropped"
            @mark-done="onMarkDone"
            @toggle-select="(task) => emit('toggle-select', task)"
            @toggle-collapse="uiStore.toggleColumnCollapse(activeProjectId, b.name)"
            @edit="openEditColumn"
          />
        </div>
      </div>
    </template>

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
      :can-dock="canDock"
      :initial-docked="uiStore.isColumnDocked(activeProjectId, currentEditingBucket.name)"
      :tasks-count="tasksInColumn(currentEditingBucket.name)"
      @close="
        isEditModalOpen = false;
        currentEditingBucket = null;
      "
      @save="onSaveColumn"
      @delete-column="onColumnDeleted(currentEditingBucket.name)"
    />
  </div>
</template>
