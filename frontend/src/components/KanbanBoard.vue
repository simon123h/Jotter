<script setup lang="ts">
import { ref, onMounted, computed, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore, type ViewMode } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import type { Task, BucketName } from '@/types';
import { updateTask, deleteTask, moveTask } from '@/api';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import ProjectSidebar from '@/components/layout/ProjectSidebar.vue';
import ModalRegistry from '@/components/modals/ModalRegistry.vue';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { X, ClipboardList, Folder } from '@lucide/vue';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useProjects } from '@/composables/useProjects';
import { useTaskSelection } from '@/composables/useTaskSelection';
import BulkActionBar from '@/components/ui/BulkActionBar.vue';

const { t } = useI18n();
const { showDialog, isOpen: dialogIsOpen } = useDialog();

const route = useRoute();
const router = useRouter();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const modalStore = useModalStore();

const { hideDoneColumn, hideArchiveColumn, isSidebarOpen, currentTheme, viewMode, activeProjectId } = storeToRefs(settingsStore);
const { projects, buckets, tasks, loading, syncLoading, syncSuccess, error: projectError } = storeToRefs(projectStore);

const { selectedIds, isSelected, toggleSelection, selectAll, clearSelection, hasSelection, selectionCount } = useTaskSelection();

const localError = ref<string | null>(null);

// Routing & View Mode
const selectProject = (projectId: string) => {
  const currentViewMode = (route.name?.toString() || viewMode.value).split('-')[0];
  const targetMode = currentViewMode === 'settings' ? 'board' : currentViewMode;
  router.push({
    name: targetMode,
    params: { projectId },
  });
};

const setViewMode = (mode: ViewMode) => {
  settingsStore.setViewMode(mode);
  router.push({
    name: mode,
    params: { projectId: activeProjectId.value },
    query: route.query,
  });
};

const toggleSidebar = () => {
  settingsStore.toggleSidebar();
};

const setTheme = (theme: string) => {
  settingsStore.setTheme(theme);
  const docClasses = document.documentElement.classList;
  docClasses.forEach((c) => {
    if (c.startsWith('theme-')) {
      docClasses.remove(c);
    }
  });
  if (theme !== 'nordic-light') {
    docClasses.add('theme-' + theme);
  }
};

// Composable: Projects Management
const {
  editingProject,
  error: projectsError,
  handleCreateProject,
  handleEditProject,
  handleSaveProject,
  handleDeleteProject,
} = useProjects(activeProjectId, selectProject);

// Filter state & logic
const { searchQuery, taskFilters, hasActiveFilters, filteredTasks, applyFilters, clearFilters } = useTaskFilters(tasks);

const displayedBuckets = computed(() => {
  return buckets.value.filter((b) => {
    if (hideDoneColumn.value && b.name === 'done') return false;
    if (hideArchiveColumn.value && b.name === 'archive') return false;
    return true;
  });
});

// Update document title dynamically based on active project
watchEffect(() => {
  const currentProj = projects.value.find((p) => p.id === activeProjectId.value);
  if (currentProj) {
    document.title = `Jotter / ${currentProj.title}`;
  } else {
    document.title = 'Jotter';
  }
});

// Empty Board state (No projects or no tasks)
const isNoProjects = computed(() => projects.value.length === 0);

const fetchAllData = async () => {
  if (isNoProjects.value || activeProjectId.value === '') return;
  localError.value = null;
  try {
    await projectStore.fetchBuckets(activeProjectId.value);
    await projectStore.fetchTasks(activeProjectId.value, viewMode.value, hideDoneColumn.value, hideArchiveColumn.value);
  } catch (err: any) {
    localError.value = t('errors.fetchData', { message: err.message || err });
  }
};

onMounted(async () => {
  await projectStore.fetchProjects();
  if (route.params.projectId) {
    activeProjectId.value = route.params.projectId as string;
  }
  const currentMode = (route.name?.toString() || '').split('-')[0] as ViewMode;
  if (['board', 'list', 'matrix', 'time', 'tag', 'super-time', 'settings'].includes(currentMode)) {
      viewMode.value = currentMode;
  }
  await fetchAllData();
  setTheme(currentTheme.value);
});

// Sync route parameters with component state dynamically
watch(
  () => [route.params.projectId, route.name, route.params.taskId],
  async ([newProjectId, newRouteName]) => {
    if (newProjectId && newProjectId !== activeProjectId.value) {
      activeProjectId.value = newProjectId as string;
      localError.value = null;
      clearFilters();
      clearSelection();
      await fetchAllData();
    }

    const newViewMode = (newRouteName?.toString() || '').split('-')[0] as ViewMode;
    if (newViewMode && newViewMode !== viewMode.value && ['board', 'list', 'matrix', 'time', 'tag', 'super-time', 'settings'].includes(newViewMode)) {
      viewMode.value = newViewMode;
      clearSelection();
      await projectStore.fetchTasks(activeProjectId.value, viewMode.value, hideDoneColumn.value, hideArchiveColumn.value);
    }
  }
);

watch([hideDoneColumn, hideArchiveColumn], () => {
    projectStore.fetchTasks(activeProjectId.value, viewMode.value, hideDoneColumn.value, hideArchiveColumn.value);
});

const defaultBucketName = computed(() => {
  const defCol = buckets.value.find((b) => b.is_default);
  return defCol?.name || buckets.value[0]?.name || 'todo';
});

const openCreateModal = (bucket: BucketName) => {
  modalStore.openTaskCreate(bucket);
};

const openFilterModal = () => {
  modalStore.openModal('filter', { 
    currentFilters: taskFilters.value,
    onApply: applyFilters
  });
};

useKeyboardShortcuts([
  {
    key: 'q',
    callback: () => {
      if (!modalStore.activeModal && !route.params.taskId && !dialogIsOpen.value) {
        openCreateModal(defaultBucketName.value);
      }
    },
  },
  {
    key: 'f',
    callback: () => {
      if (!modalStore.activeModal && !route.params.taskId && !dialogIsOpen.value) {
        openFilterModal();
      }
    },
  },
  {
    key: 'a',
    ctrlKey: true,
    callback: (e: KeyboardEvent) => {
      if (!modalStore.activeModal && !route.params.taskId && !dialogIsOpen.value) {
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

const openDetailModal = (task: Task) => {
  router.push({
    name: `${viewMode.value}-task`,
    params: { projectId: activeProjectId.value, taskId: String(task.id) },
    query: route.query,
  });
};

const triggerSync = async () => {
  try {
    await projectStore.triggerSync();
    await fetchAllData();
  } catch (err: any) {
    const msg = err.message || err;
    await showDialog({
      title: t('sync.button'),
      message: t('sync.error', { message: msg }),
      type: 'error',
    });
  }
};

const error = computed({
  get() {
    return localError.value || projectsError.value || projectError.value;
  },
  set(val) {
    localError.value = val;
    if (!val) {
      projectsError.value = null;
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

const handleBulkMoveProject = async (projectId: string) => {
  const ids = Array.from(selectedIds.value);
  try {
    for (const id of ids) {
      const task = tasks.value.find((t) => t.id === id);
      if (task) {
        await updateTask(task.project_id, id, { project_id: projectId } as any);
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
  <div class="h-screen w-full flex flex-col overflow-hidden bg-theme-base">
    <NavigationBar
      v-model="searchQuery"
      :is-sidebar-open="isSidebarOpen"
      :projects="projects"
      :active-project-id="activeProjectId"
      :has-active-filters="hasActiveFilters"
      :view-mode="viewMode"
      :default-bucket-name="defaultBucketName"
      @toggle-sidebar="toggleSidebar"
      @open-filter="openFilterModal"
      @set-view-mode="setViewMode"
      @create-task="openCreateModal"
    />

    <div class="flex-grow flex overflow-hidden w-full relative">
      <transition name="sidebar">
        <ProjectSidebar
          v-show="isSidebarOpen"
          :projects="projects"
          :active-project-id="activeProjectId"
          :sync-loading="syncLoading"
          :sync-success="syncSuccess"
          :view-mode="viewMode"
          @select-project="selectProject"
          @create-project="handleCreateProject"
          @edit-project="modalStore.openProjectEdit"
          @sync="triggerSync"
          @select-view="setViewMode"
        />
      </transition>

      <div class="flex-grow flex flex-col p-3 overflow-hidden">
        <div
          v-if="error"
          class="mt-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex justify-between items-center shrink-0"
        >
          <span>{{ error }}</span>
          <button @click="error = null" class="hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-grow overflow-hidden mt-2.5 relative">
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

          <!-- Empty Board state (Tasks) -->
          <div
            v-else-if="!tasks.length"
            class="h-full flex flex-col items-center justify-center text-center bg-theme-column/10 border border-dashed border-theme-border rounded p-6"
          >
            <div class="p-3 bg-theme-card/50 rounded border border-theme-border mb-3 text-theme-accent">
              <ClipboardList class="w-6 h-6" />
            </div>
            <h3 class="font-bold text-theme-text-main text-sm">{{ t('emptyStateTitle') }}</h3>
            <p class="text-theme-text-muted text-xs max-w-sm mt-0.5">
              {{ t('emptyStateText') }}
            </p>
            <button
              @click="openCreateModal(defaultBucketName)"
              class="mt-4 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow transition-all cursor-pointer"
            >
              {{ t('createFirstTaskButton') }}
            </button>
          </div>

          <!-- ROUTER VIEW -->
          <router-view
            v-else
            :tasks="filteredTasks"
            :buckets="displayedBuckets"
            :projects="projects"
            :is-selected="isSelected"
            @task-click="openDetailModal"
            @toggle-select="toggleSelection($event.id)"
            @add-task-click="openCreateModal"
            @refresh="fetchAllData"
          />
        </div>

        <BulkActionBar
          :selected-count="selectionCount"
          :buckets="buckets"
          :projects="projects"
          :active-project-id="activeProjectId"
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
      </div>
    </div>

    <!-- MODAL ROUTER VIEW (Task Detail) -->
    <router-view name="modal" />

    <!-- MODAL REGISTRY (Utility Modals) -->
    <ModalRegistry />
  </div>
</template>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition:
    margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.15s ease;
}
.sidebar-enter-from,
.sidebar-leave-to {
  margin-left: -16rem;
  opacity: 0;
}
</style>
