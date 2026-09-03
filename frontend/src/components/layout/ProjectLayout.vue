<script setup lang="ts">
import { ref, onMounted, computed, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import type { BucketName } from '@/types';
import { updateTask, deleteTask, moveTask, createTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { Folder } from '@lucide/vue';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useDragSelect } from '@/composables/useDragSelect';
import { useSelectionStore } from '@/stores/selection';
import { useToast } from '@/composables/useToast';
import { consolidateTasksIntoChecklist } from '@/utils/markdown';
import BulkActionBar from '@/components/ui/BulkActionBar.vue';
import TimeblockSidebar from '@/components/layout/TimeblockSidebar.vue';

const { t } = useI18n();
const { showDialog } = useDialog();
const toast = useToast();
const route = useRoute();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const modalStore = useModalStore();

const isMounted = ref(false);
const isTimeblockOpen = computed<boolean>(() => Boolean(settingsStore.isTimeblockSidebarOpen));
const toggleTimeblockSidebar = () => {
  settingsStore.toggleTimeblockSidebar();
};

const { hideDoneColumn, hideArchiveColumn, hidePostponedColumn } = storeToRefs(settingsStore);
const { projects, buckets, tasks, projectsLoaded } = storeToRefs(projectStore);

const selectionStore = useSelectionStore();
const { isSelected, toggleSelection, selectAll, clearSelection } = selectionStore;
const { hasSelection, selectionCount, selectedIds } = storeToRefs(selectionStore);

const {
  active: isDragSelecting,
  dragSelectStyle,
  onMouseDown: handleDragSelectMouseDown,
} = useDragSelect({
  selectedIds,
});

// Get the active projectId directly from the route params
const projectId = computed(() => (route.params.projectId as string) || '');

// Compute isGlobal from route meta
const isGlobalView = computed(() => !!route.meta.isGlobal);

// Filter state & logic
const { filteredTasks, clearFilters } = useTaskFilters(tasks);

const displayedBuckets = computed(() => {
  const list = [...buckets.value];
  const hasPostponed = list.some((b) => b.name === 'postponed');
  if (!hasPostponed && !hidePostponedColumn.value) {
    const doneBucket = list.find((b) => b.name === 'done');
    const pos = doneBucket ? doneBucket.position - 50 : 2500;
    list.push({
      name: 'postponed',
      title: 'Postponed',
      subtitle: 'Postponed tasks',
      position: pos,
    });
    list.sort((a, b) => a.position - b.position);
  }

  return list.filter((b) => {
    if (hideDoneColumn.value && b.name === 'done') return false;
    if (hideArchiveColumn.value && b.name === 'archive') return false;
    if (hidePostponedColumn.value && b.name === 'postponed') return false;
    return true;
  });
});

// Update document title dynamically based on active project (handling PWA standalone mode)
watchEffect(() => {
  const isPwa =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

  let pageTitle = '';
  if (projectId.value === 'all') {
    pageTitle = t('projects.allProjects') || 'All Projects';
  } else {
    const currentProj = projects.value.find((p) => p.id === projectId.value);
    if (currentProj) {
      pageTitle = currentProj.title;
    }
  }

  // In PWA standalone mode, Chrome/OS already prefixes the window title with the app name ("Jotter - ")
  // In a standard browser tab, we append " | Jotter" for clear tab identification
  if (isPwa) {
    document.title = pageTitle || 'Jotter';
  } else {
    document.title = pageTitle ? `${pageTitle} | Jotter` : 'Jotter';
  }
});

const isNoProjects = computed(() => projectsLoaded.value && projects.value.length === 0);
const isProjectLoading = ref(true);

const fetchAllData = async () => {
  if (isNoProjects.value || !projectId.value) {
    isProjectLoading.value = false;
    return;
  }
  if (
    projectsLoaded.value &&
    projectId.value !== 'all' &&
    projects.value.length > 0 &&
    !projects.value.some((p) => p.id === projectId.value)
  ) {
    isProjectLoading.value = false;
    return;
  }
  isProjectLoading.value = true;
  try {
    await Promise.all([
      projectStore.fetchBuckets(projectId.value),
      projectStore.fetchTasks(
        {
          projectId: projectId.value,
          isGlobal: isGlobalView.value,
        },
        true
      ),
    ]);
  } catch (err: any) {
    toast.error(t('errors.fetchData', { message: err.message || err }));
  } finally {
    isProjectLoading.value = false;
  }
};

onMounted(async () => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
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
    key: 'q',
    shiftKey: true,
    callback: () => {
      const defCol = buckets.value.find((b) => b.is_default);
      openCreateModal(defCol?.name || 'todo');
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
    allowInInputs: false,
    callback: () => {
      if (hasSelection.value) {
        clearSelection();
      }
    },
  },
]);

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
    toast.error(t('toasts.bulkDeleteError', { message: err.message || err }));
  }
};

const handleBulkMoveBucket = async (bucket: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await moveTask(task.project_id, id, bucket, 1000.0);
    }
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkMoveError', { message: err.message || err }));
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
    toast.error(t('toasts.bulkTagError', { message: err.message || err }));
  }
};

const handleBulkSetPriority = async (priority: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { priority });
    }
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkPriorityError', { message: err.message || err }));
  }
};

const handleBulkSetColor = async (color: string | null) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { color });
    }
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkColorError', { message: err.message || err }));
  }
};

const handleBulkSetPlanned = async (planned: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { planned_date: planned });
    }
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkPlanError', { message: err.message || err }));
  }
};

const handleBulkSetDueDate = async (date: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { due_date: date });
    }
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkDueDateError', { message: err.message || err }));
  }
};

const handleBulkSetPostponedDate = async (date: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) await updateTask(task.project_id, id, { postponed_until: date });
    }
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkPostponeError', { message: err.message || err }));
  }
};

const handleBulkMoveProject = (projId: string) => {
  const ids = Array.from(selectedIds.value);
  if (ids.length > 0) {
    modalStore.openMoveTasksConfirm(ids, projId);
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
    toast.error(t('toasts.bulkArchiveError', { message: err.message || err }));
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
    toast.error(t('toasts.bulkMarkDoneError', { message: err.message || err }));
  }
};

const handleBulkConsolidate = async () => {
  const ids = Array.from(selectedIds.value);
  if (ids.length < 2) return;

  const selectedTasks = tasks.value.filter((t) => selectedIds.value.has(t.id));
  if (selectedTasks.length === 0) return;

  const confirmed = await showDialog({
    title: t('bulkActions.consolidate'),
    message: t('bulkActions.confirmConsolidate', { count: selectedTasks.length }),
    type: 'info',
    showCancel: true,
    confirmText: t('bulkActions.consolidate'),
    cancelText: t('buttons.cancel'),
  });
  if (!confirmed) return;

  try {
    const primaryTask = selectedTasks[0];
    const targetProject = primaryTask.project_id || (projectId.value !== 'all' ? projectId.value : 'default');
    const targetBucket = primaryTask.bucket || 'todo';

    // Merge unique tags from all selected tasks
    const mergedTags = Array.from(new Set(selectedTasks.flatMap((t) => t.tags || [])));

    // Pick highest priority if present
    const prioWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    let highestPrio: string | undefined = undefined;
    let maxWeight = 0;
    for (const t of selectedTasks) {
      if (t.priority && prioWeight[t.priority] && prioWeight[t.priority] > maxWeight) {
        maxWeight = prioWeight[t.priority];
        highestPrio = t.priority;
      }
    }

    const consolidatedBody = consolidateTasksIntoChecklist(selectedTasks);

    // 1. Create consolidated parent task
    await createTask(targetProject, {
      title: primaryTask.title,
      bucket: targetBucket,
      tags: mergedTags,
      priority: highestPrio,
      body: consolidatedBody,
    });

    // 2. Delete original individual tasks
    for (const t of selectedTasks) {
      await deleteTask(t.project_id, t.id);
    }

    clearSelection();
    await fetchAllData();
  } catch (err: any) {
    toast.error(t('toasts.bulkConsolidateError', { message: err.message || err }));
  }
};
</script>

<template>
  <div class="h-full flex overflow-hidden w-full relative">
    <div class="flex-grow flex flex-col p-3 overflow-hidden min-w-0">
      <div @mousedown="handleDragSelectMouseDown" class="flex-grow overflow-hidden relative">
        <transition name="view-fade" mode="out-in">
          <div v-if="isProjectLoading" key="loading" class="h-full flex flex-col items-center justify-center gap-2">
            <div class="w-8 h-8 border-3 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
            <span class="text-theme-text-muted text-xs font-semibold">{{ t('loadingBoard') || 'Loading...' }}</span>
          </div>

          <div
            v-else-if="isNoProjects"
            key="no-projects"
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

          <div v-else :key="projectId" class="h-full">
            <router-view
              :tasks="filteredTasks"
              :buckets="displayedBuckets"
              :is-selected="isSelected"
              @toggle-select="toggleSelection($event.id)"
              @add-task-click="openCreateModal"
              @refresh="fetchAllData"
            />
          </div>
        </transition>
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
        @consolidate="handleBulkConsolidate"
        @move-bucket="handleBulkMoveBucket"
        @edit-tag="handleBulkEditTag"
        @set-priority="handleBulkSetPriority"
        @set-planned="handleBulkSetPlanned"
        @set-due-date="handleBulkSetDueDate"
        @move-project="handleBulkMoveProject"
        @set-color="handleBulkSetColor"
        @set-postponed-date="handleBulkSetPostponedDate"
      />

      <!-- MODAL ROUTER VIEW (Task Detail nested in layout) -->
      <router-view name="modal" @refresh="fetchAllData" />

      <!-- Drag Selection Rectangle -->
      <div v-if="isDragSelecting" :style="dragSelectStyle"></div>
    </div>

    <!-- Right Timeblock Sidebar Scoped to Project -->
    <transition :name="isMounted ? 'timeblock-sidebar' : ''">
      <TimeblockSidebar v-if="isTimeblockOpen" @close="toggleTimeblockSidebar" />
    </transition>
  </div>
</template>

<style scoped>
.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 0.12s ease;
}
.view-fade-enter-from,
.view-fade-leave-to {
  opacity: 0;
}
.timeblock-sidebar-enter-active,
.timeblock-sidebar-leave-active {
  transition:
    margin-right 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.15s ease;
}
.timeblock-sidebar-enter-from,
.timeblock-sidebar-leave-to {
  margin-right: -24rem;
  opacity: 0;
}
</style>
