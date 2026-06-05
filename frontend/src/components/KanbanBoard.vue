<script setup lang="ts">
import { ref, onMounted, computed, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore, type ViewMode } from '@/stores/settings';
import type { Task, BucketName } from '@/types';
import { getTasks, syncSystem } from '@/api';
import TaskDetailModal from '@/components/modals/TaskDetailModal.vue';
import TaskCreateModal from '@/components/modals/TaskCreateModal.vue';
import ProjectEditModal from '@/components/modals/ProjectEditModal.vue';
import FilterModal from '@/components/modals/FilterModal.vue';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import BoardView from '@/components/views/BoardView.vue';
import ListView from '@/components/views/ListView.vue';
import MatrixView from '@/components/views/MatrixView.vue';
import TimeView from '@/components/views/TimeView.vue';
import SettingsView from '@/components/views/SettingsView.vue';
import ProjectSidebar from '@/components/layout/ProjectSidebar.vue';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { X, ClipboardList } from '@lucide/vue';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useProjects } from '@/composables/useProjects';
import { useBuckets } from '@/composables/useBuckets';
import { useTaskMutations } from '@/composables/useTaskMutations';

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
const loading = ref(false);
const syncLoading = ref(false);
const syncSuccess = ref(false);
const localError = ref<string | null>(null);

// Routing & View Mode
const selectProject = (projectId: string) => {
  const targetMode = viewMode.value === 'settings' ? 'board' : viewMode.value;
  router.push({
    name: 'project-view',
    params: { projectId, viewMode: targetMode },
  });
};

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

// Composable: Projects Management
const {
  projects,
  editingProject,
  isProjectEditModalOpen,
  error: projectsError,
  fetchProjects,
  handleCreateProject,
  handleEditProject,
  handleSaveProject,
  handleDeleteProject,
} = useProjects(activeProjectId, selectProject);

// Composable: Buckets/Columns Management
const {
  buckets,
  displayedBuckets,
  error: bucketsError,
  fetchBuckets,
  handleCreateColumn,
  handleRenameColumn,
  handleDeleteColumn,
  handleColumnReordered,
} = useBuckets(activeProjectId, hideDoneColumn);

// Filter state & logic
const isFilterModalOpen = ref(false);
const { searchQuery, taskFilters, hasActiveFilters, filteredTasks, applyFilters, clearFilters } = useTaskFilters(tasks);

// Fetch all tasks using getTasks
const fetchAllTasks = async () => {
  try {
    tasks.value = await getTasks(activeProjectId.value, { exclude_bucket: hideDoneColumn.value ? 'done' : undefined });
  } catch (err: any) {
    localError.value = t('errors.fetchTasks', { message: err.message || err });
  }
};

// Composable: Tasks Mutations
const {
  error: taskMutationError,
  handleCardDropped,
  handleMarkTaskDone,
  handleTimeViewDueDateUpdate,
} = useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks);

// Synchronized computed error across all composables and local errors
const error = computed({
  get() {
    return localError.value || projectsError.value || bucketsError.value || taskMutationError.value;
  },
  set(val) {
    localError.value = val;
    if (!val) {
      projectsError.value = null;
      bucketsError.value = null;
      taskMutationError.value = null;
    }
  },
});

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

// Modal state
const selectedTaskId = ref<string | null>(route.params.taskId ? String(route.params.taskId) : null);
const isDetailOpen = ref(!!route.params.taskId);
const isCreateOpen = ref(false);
const createDefaultBucket = ref<BucketName>('todo');

// Update document title dynamically based on active project
watchEffect(() => {
  const currentProj = projects.value.find((p) => p.id === activeProjectId.value);
  if (currentProj) {
    document.title = `Jotter / ${currentProj.title}`;
  } else {
    document.title = 'Jotter';
  }
});

const fetchAllData = async () => {
  loading.value = true;
  localError.value = null;
  try {
    await fetchBuckets();
    await fetchAllTasks();
  } catch (err: any) {
    localError.value = t('errors.fetchData', { message: err.message || err });
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
      localError.value = null;
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

const handleDetailMarkTaskDone = async (task: Task) => {
  await handleMarkTaskDone(task);
  closeDetailModal();
};

const triggerSync = async () => {
  syncLoading.value = true;
  syncSuccess.value = false;
  localError.value = null;
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
    localError.value = t('sync.error', { message: msg });
    await showDialog({
      title: t('sync.button'),
      message: t('sync.error', { message: msg }),
      type: 'error',
    });
  } finally {
    syncLoading.value = false;
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
