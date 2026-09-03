<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import { useTimeblockStore } from '@/stores/timeblock';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import ProjectSidebar from '@/components/layout/ProjectSidebar.vue';
import PomodoroBar from '@/components/ui/PomodoroBar.vue';
import ModalRegistry from '@/components/modals/ModalRegistry.vue';
import { useProjects } from '@/composables/useProjects';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useTaskExport } from '@/composables/useTaskExport';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const modalStore = useModalStore();
const timeblockStore = useTimeblockStore();

const { isSidebarOpen, currentTheme, isTimeblockSidebarOpen } = storeToRefs(settingsStore);
const autoSyncInterval = computed(() => settingsStore.autoSyncInterval ?? 0);
const { projects, syncLoading, syncSuccess, error: projectError } = storeToRefs(projectStore);

// Watch for global project errors and notify non-intrusively via toast
watch(projectError, (newErr) => {
  if (newErr) {
    toast.error(newErr);
  }
});

// Derive active project ID strictly from the current route params
const activeProjectId = computed(() => (route.params.projectId as string) || '');

const navBarRef = ref<any>(null);

useKeyboardShortcuts([
  {
    key: 'k',
    ctrlKey: true,
    allowInInputs: true,
    callback: () => {
      if (activeProjectId.value) {
        navBarRef.value?.focusSearch();
      }
    },
  },
]);

const selectProject = (projectId: string) => {
  projectStore.error = null;
  router.push({
    name: 'project',
    params: { projectId },
    query: route.query,
  });
};

// Watch projects list and redirect if route project does not exist
watch(
  [projects, activeProjectId],
  ([newProjects, newRouteId]) => {
    if (newProjects.length > 0) {
      if (newRouteId && newRouteId !== 'settings' && newRouteId !== 'all') {
        const routeProjectExists = newProjects.some((p) => p.id === newRouteId);
        if (!routeProjectExists) {
          projectStore.error = null;
          selectProject(newProjects[0].id);
        }
      }
    }
  },
  { immediate: true }
);

const toggleSidebar = () => {
  settingsStore.toggleSidebar();
};

const toggleTimeblockSidebar = () => {
  settingsStore.toggleTimeblockSidebar();
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

// Hook into task filters to bind the search query and filter modal to NavigationBar
const { searchQuery, taskFilters, hasActiveFilters, applyFilters, filteredTasks } = useTaskFilters(computed(() => projectStore.tasks));

const openFilterModal = () => {
  modalStore.openModal('filter', {
    currentFilters: taskFilters.value,
    onApply: applyFilters,
  });
};

const openCreateModal = (bucketName?: string) => {
  modalStore.openTaskCreate(bucketName || 'todo');
};

const { exportTasks } = useTaskExport(filteredTasks, activeProjectId);

// Project creation handling using standard projects composable
const { handleCreateProject: runCreateProject } = useProjects(selectProject);

const handleCreateProject = async (title: string) => {
  try {
    await runCreateProject(title);
    await projectStore.fetchProjects(); // sync global project store list
  } catch (err: any) {
    toast.error(t('toasts.projectCreateError', { message: err.message || err }));
  }
};

let autoSyncCheckInterval: any = null;

const triggerSync = async (isManual = false) => {
  try {
    await projectStore.triggerSync();
    localStorage.setItem('jotter-last-sync-time', String(Date.now()));
  } catch (err: any) {
    if (isManual) {
      toast.error(t('toasts.syncError', { message: err.message || err }), t('toasts.syncErrorTitle'));
    }
  }
};

const checkAutoSync = () => {
  const interval = autoSyncInterval?.value;
  if (!interval || interval <= 0) return;

  const lastSyncTimeStr = localStorage.getItem('jotter-last-sync-time');
  const lastSyncTime = lastSyncTimeStr ? Number(lastSyncTimeStr) : 0;
  const now = Date.now();

  if (!lastSyncTime || now - lastSyncTime >= interval * 60 * 1000) {
    triggerSync(false);
  }
};

watch(
  () => autoSyncInterval?.value,
  (newVal) => {
    if (newVal && newVal > 0) {
      checkAutoSync();
    }
  }
);

const handleMoveTasksToProject = ({ taskIds, projectId: targetProjectId }: { taskIds: string[]; projectId: string }) => {
  modalStore.openMoveTasksConfirm(taskIds, targetProjectId);
};

const isMounted = ref(false);

onMounted(async () => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
  await Promise.all([projectStore.fetchProjects(), timeblockStore.fetchTimeblocks()]);
  setTheme(currentTheme.value);

  // Set up auto-sync periodic check
  checkAutoSync(); // run once on startup
  autoSyncCheckInterval = setInterval(checkAutoSync, 15000); // check every 15 seconds
});

onBeforeUnmount(() => {
  if (autoSyncCheckInterval) {
    clearInterval(autoSyncCheckInterval);
  }
});
</script>

<template>
  <div class="h-dvh w-full flex flex-col overflow-hidden bg-theme-base">
    <NavigationBar
      ref="navBarRef"
      v-model="searchQuery"
      :is-sidebar-open="isSidebarOpen"
      :is-timeblock-sidebar-open="Boolean(isTimeblockSidebarOpen)"
      :projects="projects"
      :active-project-id="activeProjectId"
      :has-active-filters="hasActiveFilters"
      default-bucket-name="todo"
      @toggle-sidebar="toggleSidebar"
      @toggle-timeblock-sidebar="toggleTimeblockSidebar"
      @open-filter="openFilterModal"
      @create-task="openCreateModal"
      @export-tasks="exportTasks"
    />

    <div class="flex-grow flex overflow-hidden w-full relative">
      <transition :name="isMounted ? 'sidebar' : ''">
        <ProjectSidebar
          v-show="isSidebarOpen"
          :projects="projects"
          :active-project-id="activeProjectId"
          :sync-loading="syncLoading"
          :sync-success="syncSuccess"
          @create-project="handleCreateProject"
          @edit-project="modalStore.openProjectEdit"
          @sync="() => triggerSync(true)"
          @import-spreadsheet="modalStore.openImportSpreadsheet"
          @move-tasks-to-project="handleMoveTasksToProject"
        />
      </transition>

      <div class="flex-grow flex flex-col overflow-hidden min-w-0">
        <div class="flex-grow overflow-hidden relative">
          <!-- Main layout content rendering either global views or ProjectLayout -->
          <router-view />
        </div>
      </div>
    </div>

    <!-- POMODORO FLOATING DOCK -->
    <PomodoroBar />

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
