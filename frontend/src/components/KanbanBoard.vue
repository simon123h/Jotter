<script setup lang="ts">
import { ref, onMounted, computed, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore, type ViewMode } from '../stores/settings';
import type { Task, Bucket, BucketName, Project, TaskFilterParams } from '../types';
import {
  getTasks,
  moveTask,
  updateTask,
  syncSystem,
  getBuckets,
  createBucket,
  updateBucket,
  deleteBucket,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../api';
import TaskDetailModal from './TaskDetailModal.vue';
import TaskCreateModal from './TaskCreateModal.vue';
import ProjectEditModal from './ProjectEditModal.vue';
import FilterModal from './FilterModal.vue';
import NavigationBar from './NavigationBar.vue';
import { useTaskFilters } from '../composables/useTaskFilters';
import BoardView from './BoardView.vue';
import ListView from './ListView.vue';
import MatrixView from './MatrixView.vue';
import TimeView from './TimeView.vue';
import SettingsView from './SettingsView.vue';
import ProjectSidebar from './ProjectSidebar.vue';
import { useI18n } from '../composables/useI18n';
import { useDialog } from '../composables/useDialog';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts';
import { X, ClipboardList } from '@lucide/vue';

const { t } = useI18n();
const { showDialog, isOpen: dialogIsOpen } = useDialog();

const route = useRoute();
const router = useRouter();

const settingsStore = useSettingsStore();

// Sync initial route params to store if present
if (route.params.projectId) {
  settingsStore.setActiveProjectId(route.params.projectId as string);
}
if (route.params.viewMode) {
  settingsStore.setViewMode(route.params.viewMode as ViewMode);
}

const { hideDoneColumn, isSidebarOpen, currentTheme, viewMode, activeProjectId } = storeToRefs(settingsStore);

const tasks = ref<Task[]>([]);
const buckets = ref<Bucket[]>([]);

const displayedBuckets = computed(() => {
  if (hideDoneColumn.value) {
    return buckets.value.filter((b) => b.name !== 'done');
  }
  return buckets.value;
});
const projects = ref<Project[]>([]);

const loading = ref(false);
const syncLoading = ref(false);
const syncSuccess = ref(false);
const error = ref<string | null>(null);

// Filter state & logic
const isFilterModalOpen = ref(false);
const { searchQuery, taskFilters, hasActiveFilters, filteredTasks, applyFilters, clearFilters } = useTaskFilters(tasks);

// Sync taskFilters.show_done and hideDoneColumn
watch(
  () => taskFilters.value.show_done,
  (newVal) => {
    const shouldHide = !newVal;
    if (hideDoneColumn.value !== shouldHide) {
      hideDoneColumn.value = shouldHide;
    }
  },
  { immediate: true }
);

watch(hideDoneColumn, (newVal) => {
  const showDoneTarget = newVal ? undefined : true;
  if (taskFilters.value.show_done !== showDoneTarget) {
    taskFilters.value.show_done = showDoneTarget;
  }
  fetchAllTasks();
});

const setViewMode = (mode: ViewMode) => {
  settingsStore.setViewMode(mode);
  router.push({
    name: 'project-view',
    params: { projectId: activeProjectId.value, viewMode: mode },
    query: route.query,
  });
};

const toggleSidebar = () => {
  settingsStore.toggleSidebar();
};

// Modal state
const selectedTaskId = ref<string | null>(route.params.taskId ? String(route.params.taskId) : null);
const isDetailOpen = ref(!!route.params.taskId);
const isCreateOpen = ref(false);
const createDefaultBucket = ref<BucketName>('todo');
const isProjectEditModalOpen = ref(false);
const editingProject = ref<Project | null>(null);

const setTheme = (theme: string) => {
  settingsStore.setTheme(theme);
  const docClasses = document.documentElement.classList;
  // Remove existing themes
  docClasses.forEach((c) => {
    if (c.startsWith('theme-')) {
      docClasses.remove(c);
    }
  });
  if (theme !== 'nordic-light') {
    docClasses.add('theme-' + theme);
  }
};

// Update document title dynamically based on active project
watchEffect(() => {
  const currentProj = projects.value.find((p) => p.id === activeProjectId.value);
  if (currentProj) {
    document.title = `Jotter / ${currentProj.title}`;
  } else {
    document.title = 'Jotter';
  }
});

// Projects management
const fetchProjects = async () => {
  try {
    projects.value = await getProjects();
    // Fallback if active project no longer exists
    if (!projects.value.find((p) => p.id === activeProjectId.value)) {
      if (projects.value.length > 0) {
        selectProject(projects.value[0].id);
      } else {
        selectProject('default');
      }
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch projects';
  }
};

const selectProject = (projectId: string) => {
  const targetMode = viewMode.value === 'settings' ? 'board' : viewMode.value;
  router.push({
    name: 'project-view',
    params: { projectId, viewMode: targetMode },
  });
};

const handleCreateProject = async (title: string) => {
  try {
    const created = await createProject(title);
    await fetchProjects();
    selectProject(created.id);
  } catch (err: any) {
    error.value = err.message || 'Failed to create project';
  }
};

const handleEditProject = (project: Project) => {
  editingProject.value = project;
  isProjectEditModalOpen.value = true;
};

const handleSaveProject = async ({ id, title, done_clean_period }: { id: string; title: string; done_clean_period: number | null }) => {
  try {
    await updateProject(id, { title, done_clean_period });
    await fetchProjects();
  } catch (err: any) {
    error.value = err.message || 'Failed to update project';
  }
};

const handleDeleteProject = async (project: Project | null) => {
  if (!project) return;
  const confirmed = await showDialog({
    title: t('buttons.delete'),
    message: t('projects.deleteProjectConfirm', { title: project.title }),
    type: 'warning',
    showCancel: true,
    confirmText: t('buttons.delete'),
    cancelText: t('buttons.cancel'),
  });
  if (!confirmed) return;

  try {
    await deleteProject(project.id);
    isProjectEditModalOpen.value = false;
    await fetchProjects();
  } catch (err: any) {
    error.value = err.message || 'Failed to delete project';
  }
};

const fetchBuckets = async () => {
  try {
    buckets.value = await getBuckets(activeProjectId.value);
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch columns';
  }
};

const fetchAllTasks = async () => {
  try {
    tasks.value = await getTasks(activeProjectId.value, { exclude_bucket: hideDoneColumn.value ? 'done' : undefined });
  } catch (err: any) {
    error.value = t('errors.fetchTasks', { message: err.message || err });
  }
};

const fetchAllData = async () => {
  loading.value = true;
  error.value = null;
  try {
    await fetchBuckets();
    await fetchAllTasks();
  } catch (err: any) {
    error.value = t('errors.fetchData', { message: err.message || err });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await fetchProjects();
  await fetchAllData();
  setTheme(currentTheme.value);
});

// Compute unique list of tags across all tasks (case-insensitively grouped as lowercase)
const allTags = computed(() => {
  const tagsSet = new Set<string>();
  tasks.value.forEach((t) => {
    if (t.tags) {
      t.tags.forEach((tag) => tagsSet.add(tag.toLowerCase()));
    }
  });
  return Array.from(tagsSet).sort();
});

// Group tasks by bucket name
const tasksByBucket = computed(() => {
  const groups: Record<string, Task[]> = {};
  buckets.value.forEach((b) => {
    groups[b.name] = [];
  });

  filteredTasks.value.forEach((task) => {
    const b = task.bucket;
    if (groups[b] === undefined) {
      groups[b] = [];
    }
    groups[b].push(task);
  });

  // Sort each bucket by position ascending
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => a.position - b.position);
  });

  return groups;
});

const openDetailModal = (task: Task) => {
  router.push({
    name: 'task-detail',
    params: { projectId: activeProjectId.value, viewMode: viewMode.value, taskId: String(task.id) },
    query: route.query,
  });
};

const closeDetailModal = () => {
  router.push({
    name: 'project-view',
    params: { projectId: activeProjectId.value, viewMode: viewMode.value },
    query: route.query,
  });
};

// Sync route parameters with component state dynamically
watch(
  () => [route.params.projectId, route.params.viewMode, route.params.taskId],
  async ([newProjectId, newViewMode, newTaskId]) => {
    // 1. Project ID Sync
    if (newProjectId && newProjectId !== activeProjectId.value) {
      activeProjectId.value = newProjectId as string;
      error.value = null;
      clearFilters();
      await fetchAllData();
    }

    // 2. View Mode Sync
    if (newViewMode && newViewMode !== viewMode.value) {
      viewMode.value = newViewMode as ViewMode;
    }

    // 3. Task ID Sync
    if (newTaskId) {
      selectedTaskId.value = String(newTaskId);
      isDetailOpen.value = true;
    } else {
      isDetailOpen.value = false;
      selectedTaskId.value = null;
    }
  }
);

const defaultBucketName = computed(() => {
  const defCol = buckets.value.find((b) => b.is_default);
  return defCol?.name || buckets.value[0]?.name || 'todo';
});

const openCreateModal = (bucket: BucketName) => {
  createDefaultBucket.value = bucket;
  isCreateOpen.value = true;
};

useKeyboardShortcuts([
  {
    key: 'q',
    callback: () => {
      if (!isCreateOpen.value && !isDetailOpen.value && !dialogIsOpen.value) {
        openCreateModal(defaultBucketName.value);
      }
    },
  },
]);

const handleCardDropped = async ({
  taskId,
  toBucket,
  prevTaskId,
  nextTaskId,
}: {
  taskId: string;
  toBucket: BucketName;
  prevTaskId: string | null;
  nextTaskId: string | null;
}) => {
  // Calculate new position using sibling tasks
  let newPosition: number;

  if (prevTaskId === null && nextTaskId === null) {
    const targetBucketTasks = tasks.value.filter((t) => t.bucket === toBucket).sort((a, b) => a.position - b.position);
    const otherTasks = targetBucketTasks.filter((t) => t.id !== taskId);
    if (otherTasks.length === 0) {
      newPosition = 1000.0;
    } else {
      newPosition = otherTasks[otherTasks.length - 1].position + 1000.0;
    }
  } else if (prevTaskId === null) {
    const nextTask = tasks.value.find((t) => t.id === nextTaskId);
    newPosition = nextTask ? nextTask.position - 1000.0 : 1000.0;
  } else if (nextTaskId === null) {
    const prevTask = tasks.value.find((t) => t.id === prevTaskId);
    newPosition = prevTask ? prevTask.position + 1000.0 : 1000.0;
  } else {
    const prevTask = tasks.value.find((t) => t.id === prevTaskId);
    const nextTask = tasks.value.find((t) => t.id === nextTaskId);
    if (prevTask && nextTask) {
      newPosition = (prevTask.position + nextTask.position) / 2.0;
    } else if (prevTask) {
      newPosition = prevTask.position + 1000.0;
    } else if (nextTask) {
      newPosition = nextTask.position - 1000.0;
    } else {
      newPosition = 1000.0;
    }
  }

  // Optimistic UI updates: update local state immediately
  const movedTask = tasks.value.find((t) => t.id === taskId);
  if (movedTask) {
    const originalBucket = movedTask.bucket;
    const originalPosition = movedTask.position;

    movedTask.bucket = toBucket;
    movedTask.position = newPosition;

    try {
      await moveTask(activeProjectId.value, taskId, toBucket, newPosition);
    } catch {
      // Revert if API call fails
      movedTask.bucket = originalBucket;
      movedTask.position = originalPosition;
      error.value = t('errors.moveTask');
    }
  }
};

const handleCreateColumn = async (title: string, subtitle: string) => {
  try {
    await createBucket(activeProjectId.value, title, subtitle);
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to create column';
  }
};

const handleRenameColumn = async ({
  bucketName,
  newTitle,
  newSubtitle,
  newColor,
  newLayout,
  newMaxTasks,
  newIsDefault,
}: {
  bucketName: string;
  newTitle: string;
  newSubtitle: string;
  newColor?: string | null;
  newLayout?: 'list' | 'grid-2' | 'grid-3';
  newMaxTasks?: number | null;
  newIsDefault?: boolean;
}) => {
  if (!newTitle.trim()) return;
  try {
    await updateBucket(activeProjectId.value, bucketName, {
      title: newTitle.trim(),
      subtitle: newSubtitle,
      color: newColor,
      layout: newLayout,
      max_tasks: newMaxTasks,
      is_default: newIsDefault,
    });
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to rename column';
  }
};

const handleMarkTaskDone = async (task: Task) => {
  try {
    const targetBucketTasks = tasks.value.filter((t) => t.bucket === 'done').sort((a, b) => a.position - b.position);
    const newPosition = targetBucketTasks.length > 0 ? targetBucketTasks[targetBucketTasks.length - 1].position + 1000.0 : 1000.0;

    await moveTask(activeProjectId.value, task.id, 'done', newPosition);
    await fetchBuckets();
    await fetchAllTasks();
  } catch (err: any) {
    error.value = err.message || 'Failed to mark task as done';
  }
};

const handleDetailMarkTaskDone = async (task: Task) => {
  await handleMarkTaskDone(task);
  closeDetailModal();
};

const handleDeleteColumn = async (bucketName: string) => {
  try {
    await deleteBucket(activeProjectId.value, bucketName);
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to delete column';
  }
};

const handleColumnReordered = async ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
  const visibleCols = [...displayedBuckets.value];
  if (oldIndex < 0 || oldIndex >= visibleCols.length || newIndex < 0 || newIndex >= visibleCols.length) return;
  if (oldIndex === newIndex) return;

  const [draggedCol] = visibleCols.splice(oldIndex, 1);
  visibleCols.splice(newIndex, 0, draggedCol);

  let newPosition: number;
  if (newIndex === 0) {
    newPosition = visibleCols[1].position - 1000.0;
  } else if (newIndex === visibleCols.length - 1) {
    newPosition = visibleCols[visibleCols.length - 2].position + 1000.0;
  } else {
    const prevCol = visibleCols[newIndex - 1];
    const nextCol = visibleCols[newIndex + 1];
    newPosition = (prevCol.position + nextCol.position) / 2.0;
  }

  // Optimistic local update
  const originalPosition = draggedCol.position;
  draggedCol.position = newPosition;
  buckets.value.sort((a, b) => a.position - b.position);

  try {
    await updateBucket(activeProjectId.value, draggedCol.name, { position: newPosition });
  } catch {
    error.value = 'Failed to reorder columns. Reverting changes.';
    draggedCol.position = originalPosition;
    buckets.value.sort((a, b) => a.position - b.position);
    await fetchBuckets();
  }
};

const triggerSync = async () => {
  syncLoading.value = true;
  syncSuccess.value = false;
  error.value = null;
  try {
    await syncSystem();
    syncSuccess.value = true;
    setTimeout(() => {
      syncSuccess.value = false;
    }, 2000);
    await fetchProjects();
    await fetchAllData();
  } catch (err: any) {
    const msg = err.message || err;
    error.value = t('sync.error', { message: msg });
    await showDialog({
      title: t('sync.button'),
      message: t('sync.error', { message: msg }),
      type: 'error',
    });
  } finally {
    syncLoading.value = false;
  }
};

/** Compute a due-date string for a time-view column and persist it. */
const handleTimeViewDueDateUpdate = async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let newDueDate: string | null;

  switch (columnId) {
    case 'today':
      newDueDate = formatDateISO(today);
      break;
    case 'tomorrow': {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      newDueDate = formatDateISO(d);
      break;
    }
    case 'thisWeek': {
      // End of current ISO week (Sunday)
      const d = new Date(today);
      const dayOfWeek = d.getDay(); // 0=Sun
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      d.setDate(d.getDate() + daysUntilSunday);
      newDueDate = formatDateISO(d);
      break;
    }
    case 'thisMonth': {
      const d = new Date(today);
      d.setDate(d.getDate() + 30);
      newDueDate = formatDateISO(d);
      break;
    }
    case 'thisYear': {
      const d = new Date(today.getFullYear(), 11, 31); // Dec 31
      newDueDate = formatDateISO(d);
      break;
    }
    case 'noDate':
    default:
      newDueDate = null;
      break;
  }

  // Optimistic local update
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return;

  const originalDueDate = task.due_date;
  task.due_date = newDueDate ?? undefined;

  try {
    await updateTask(activeProjectId.value, taskId, { due_date: newDueDate as any });
  } catch (err: any) {
    // Revert on failure
    task.due_date = originalDueDate;
    error.value = err.message || 'Failed to update due date';
  }
};

const formatDateISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      @open-filter="isFilterModalOpen = true"
      @set-view-mode="setViewMode"
      @create-task="openCreateModal"
    />

    <!-- Main Layout Area (Below Header) -->
    <div class="flex-grow flex overflow-hidden w-full relative">
      <!-- Left Projects Sidebar (with sliding transition) -->
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
          @edit-project="handleEditProject"
          @sync="triggerSync"
          @select-view="setViewMode"
        />
      </transition>

      <!-- Main Content Area -->
      <div class="flex-grow flex flex-col p-3 overflow-hidden">
        <!-- Error Banner -->
        <div
          v-if="error"
          class="mt-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex justify-between items-center shrink-0"
        >
          <span>{{ error }}</span>
          <button @click="error = null" class="hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Main Content Panel (Responsive Layout Flex) -->
        <div class="flex-grow overflow-hidden mt-2.5 relative">
          <!-- Loading Board state -->
          <div v-if="loading && !tasks.length" class="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
            <span class="text-theme-text-muted text-xs">{{ t('loadingBoard') }}</span>
          </div>

          <!-- Empty Board state -->
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

          <!-- Board View Columns (Horizontal Scrolling Flex) -->
          <BoardView
            v-if="viewMode === 'board'"
            :buckets="displayedBuckets"
            :tasks-by-bucket="tasksByBucket"
            @task-click="openDetailModal"
            @add-task-click="openCreateModal"
            @card-dropped="handleCardDropped"
            @rename-column="handleRenameColumn"
            @delete-column="handleDeleteColumn"
            @create-column="handleCreateColumn"
            @mark-done="handleMarkTaskDone"
            @column-reordered="handleColumnReordered"
          />

          <!-- List View Mode (Data dense Table View) -->
          <ListView
            v-else-if="viewMode === 'list'"
            :buckets="displayedBuckets"
            :tasks-by-bucket="tasksByBucket"
            @task-click="openDetailModal"
          />

          <!-- Matrix View Mode (Eisenhower 2x2 Matrix) -->
          <MatrixView v-else-if="viewMode === 'matrix'" :tasks="filteredTasks" @task-click="openDetailModal" />

          <!-- Time View Mode (Deadline-based columns) -->
          <TimeView
            v-else-if="viewMode === 'time'"
            :tasks="filteredTasks"
            @task-click="openDetailModal"
            @mark-done="handleMarkTaskDone"
            @update-due-date="handleTimeViewDueDateUpdate"
          />

          <!-- Settings View Mode -->
          <SettingsView v-else-if="viewMode === 'settings'" />
        </div>

        <!-- Task Detail Modal -->
        <TaskDetailModal
          :is-open="isDetailOpen"
          :project-id="activeProjectId"
          :task-id="selectedTaskId"
          :buckets="buckets"
          :existing-tags="allTags"
          @close="closeDetailModal"
          @updated="fetchAllTasks"
          @deleted="fetchAllTasks"
          @mark-done="handleDetailMarkTaskDone"
        />

        <!-- Task Create Modal -->
        <TaskCreateModal
          :is-open="isCreateOpen"
          :project-id="activeProjectId"
          :default-bucket="createDefaultBucket"
          :buckets="buckets"
          :existing-tags="allTags"
          @close="isCreateOpen = false"
          @created="fetchAllTasks"
        />

        <!-- Project Edit Modal -->
        <ProjectEditModal
          :is-open="isProjectEditModalOpen"
          :project="editingProject"
          @close="isProjectEditModalOpen = false"
          @save="handleSaveProject"
          @delete-project="handleDeleteProject(editingProject)"
        />

        <!-- Filter Modal -->
        <FilterModal
          :is-open="isFilterModalOpen"
          :buckets="buckets"
          :all-tags="allTags"
          :current-filters="taskFilters"
          @close="isFilterModalOpen = false"
          @apply="applyFilters"
        />
      </div>
    </div>
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
  margin-left: -16rem; /* matches w-64 width */
  opacity: 0;
}
</style>
