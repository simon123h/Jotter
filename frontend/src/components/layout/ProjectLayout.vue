<script setup lang="ts">
import { ref, onMounted, computed, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import type { BucketName } from '@/types';
import { updateTask, deleteTask, moveTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { X, Folder } from '@lucide/vue';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useTaskSelection } from '@/composables/useTaskSelection';
import { useDragSelect } from '@/composables/useDragSelect';
import BulkActionBar from '@/components/ui/BulkActionBar.vue';

const { t } = useI18n();
const route = useRoute();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const modalStore = useModalStore();

const { hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);
const { projects, buckets, tasks, loading, projectsLoaded, error: projectError } = storeToRefs(projectStore);

const { isSelected, toggleSelection, selectAll, clearSelection, hasSelection, selectionCount, selectedIds } = useTaskSelection();

const {
  active: isDragSelecting,
  dragSelectStyle,
  onMouseDown: handleDragSelectMouseDown,
} = useDragSelect({
  selectedIds,
});

const localError = ref<string | null>(null);

// Get the active projectId directly from the route params
const projectId = computed(() => (route.params.projectId as string) || '');

// Compute isGlobal from route meta
const isGlobalView = computed(() => !!route.meta.isGlobal);

// Filter state & logic
const { filteredTasks, clearFilters } = useTaskFilters(tasks);

const displayedBuckets = computed(() => {
  return buckets.value.filter((b) => {
    if (hideDoneColumn.value && b.name === 'done') return false;
    if (hideArchiveColumn.value && b.name === 'archive') return false;
    return true;
  });
});

// Update document title dynamically based on active project
watchEffect(() => {
  const currentProj = projects.value.find((p) => p.id === projectId.value);
  if (currentProj) {
    document.title = `Jotter / ${currentProj.title}`;
  } else {
    document.title = 'Jotter';
  }
});

const isNoProjects = computed(() => projectsLoaded.value && projects.value.length === 0);

const fetchAllData = async () => {
  localError.value = null;
  if (isNoProjects.value || !projectId.value) return;
  try {
    await projectStore.fetchBuckets(projectId.value);
    await projectStore.invalidate();
  } catch (err: any) {
    localError.value = t('errors.fetchData', { message: err.message || err });
  }
};

onMounted(async () => {
  await fetchAllData();
});

// Sync data loading with route parameters
watch(
  () => [projectId.value, isGlobalView.value],
  async () => {
    clearFilters();
    clearSelection();
    await fetchAllData();
  }
);

const defaultBucketName = computed(() => {
  const defCol = buckets.value.find((b) => b.is_default);
  return defCol?.name || buckets.value[0]?.name || 'todo';
});

const openCreateModal = (bucket: BucketName) => {
  modalStore.openTaskCreate(bucket);
};

useKeyboardShortcuts([
  {
    key: 'q',
    callback: () => {
      if (!modalStore.activeModal && !route.params.taskId) {
        openCreateModal(defaultBucketName.value);
      }
    },
  },
  {
    key: 'a',
    ctrlKey: true,
    callback: (e: KeyboardEvent) => {
      if (!modalStore.activeModal && !route.params.taskId) {
        e.preventDefault();
        selectAll(filteredTasks.value);
      }
    },
  },
  {
    key: 'Escape',
    callback: () => {
      if (hasSelection.value) {
        clearSelection();
      }
    },
  },
]);

const error = computed({
  get() {
    return localError.value || projectError.value;
  },
  set(val) {
    localError.value = val;
    if (!val) {
      projectStore.error = null;
    }
  },
});

const commonTags = computed(() => {
  const selectedTasks = tasks.value.filter((t) => isSelected(t.id));
  const tagCounts: Record<string, number> = {};
  selectedTasks.forEach((t) => {
    t.tags?.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  return Object.keys(tagCounts).sort();
});

// Bulk Action Handlers
const handleBulkDelete = async () => {
  const count = selectionCount.value;
  if (!confirm(t('bulkActions.confirmDelete', { count }))) return;
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await deleteTask(task.project_id, id);
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk delete failed: ${err.message}`;
  }
};

const handleBulkMoveBucket = async (bucket: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await moveTask(task.project_id, id, bucket, 1000.0);
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk move failed: ${err.message}`;
  }
};

const handleBulkEditTag = async (tag: string, remove: boolean) => {
  const selectedTasks = tasks.value.filter((t) => isSelected(t.id));
  try {
    for (const task of selectedTasks) {
      let newTags: string[];
      const currentTags = task.tags ?? [];
      if (remove) {
        newTags = currentTags.filter((t) => t !== tag);
      } else {
        if (currentTags.includes(tag)) continue;
        newTags = [...currentTags, tag];
      }
      await updateTask(task.project_id, task.id, { tags: newTags });
    }
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk tagging failed: ${err.message}`;
  }
};

const handleBulkSetPriority = async (priority: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { priority });
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk priority set failed: ${err.message}`;
  }
};

const handleBulkSetPlanned = async (planned: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { planned_date: planned });
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk planning failed: ${err.message}`;
  }
};

const handleBulkMoveProject = async (projId: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) {
        await updateTask(task.project_id, id, { project_id: projId } as any);
      }
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk project move failed: ${err.message}`;
  }
};

const handleBulkArchive = async () => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { bucket: 'archive' });
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk archive failed: ${err.message}`;
  }
};

const handleBulkMarkDone = async () => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) {
        await updateTask(task.project_id, id, { bucket: 'done', position: 1000000.0 });
      }
    }
    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    localError.value = `Bulk mark done failed: ${err.message}`;
  }
};
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div
      v-if="error"
      class="mt-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex justify-between items-center shrink-0"
    >
      <span>{{ error }}</span>
      <button @click="error = null" class="hover:text-white cursor-pointer">
        <X class="w-4 h-4" />
      </button>
    </div>

    <div @mousedown="handleDragSelectMouseDown" class="flex-grow overflow-hidden relative">
      <div v-if="loading && !tasks.length" class="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div class="w-10 h-10 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
        <span class="text-theme-text-muted text-xs">{{ t('loadingBoard') }}</span>
      </div>

      <div
        v-else-if="isNoProjects"
        class="h-full flex flex-col items-center justify-center text-center bg-theme-column/10 border border-dashed border-theme-border rounded p-6"
      >
        <div class="p-3 bg-theme-card/50 rounded border border-theme-border mb-3 text-theme-accent">
          <Folder class="w-6 h-6" />
        </div>
        <h3 class="font-bold text-theme-text-main text-sm">{{ t('projects.noProjectsTitle') || 'No Projects Yet' }}</h3>
        <p class="text-theme-text-muted text-xs max-w-sm mt-0.5">
          {{ t('projects.noProjectsDesc') || 'Create your first project to start organizing your tasks.' }}
        </p>
      </div>

      <div v-else class="h-full">
        <router-view
          :tasks="filteredTasks"
          :buckets="displayedBuckets"
          :projects="projects"
          :is-selected="isSelected"
          @toggle-select="toggleSelection($event.id)"
          @add-task-click="openCreateModal"
          @refresh="fetchAllData"
        />
      </div>
    </div>

    <!-- Bulk Action Bar -->
    <BulkActionBar
      :selected-count="selectionCount"
      :buckets="buckets"
      :projects="projects"
      :active-project-id="projectId"
      :common-tags="commonTags"
      @clear="clearSelection"
      @select-all="() => selectAll(filteredTasks)"
      @delete="handleBulkDelete"
      @archive="handleBulkArchive"
      @mark-done="handleBulkMarkDone"
      @move-bucket="handleBulkMoveBucket"
      @edit-tag="handleBulkEditTag"
      @set-priority="handleBulkSetPriority"
      @set-planned="handleBulkSetPlanned"
      @move-project="handleBulkMoveProject"
    />

    <!-- MODAL ROUTER VIEW (Task Detail nested in layout) -->
    <router-view name="modal" @refresh="fetchAllData" />

    <!-- Drag Selection Rectangle -->
    <div v-if="isDragSelecting" :style="dragSelectStyle"></div>
  </div>
</template>
