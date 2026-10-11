<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useDebounceFn, useEventListener } from '@vueuse/core';

import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { useVaultStore } from '@/stores/vault';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import ProjectSidebar from '@/components/layout/ProjectSidebar.vue';
import MobileNavBar from '@/components/layout/MobileNavBar.vue';
import ModalRegistry from '@/components/modals/ModalRegistry.vue';
import { useProjects } from '@/composables/useProjects';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useTaskExport } from '@/composables/useTaskExport';
import { crossTabBus } from '@/utils/broadcast';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const modalStore = useModalStore();
const timeblockStore = useTimeblockStore();
const vaultStore = useVaultStore();

const { isSidebarOpen, currentTheme, isTimeblockSidebarOpen } = storeToRefs(settingsStore);
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

// Close sidebar on mobile navigation
watch(
  () => route.fullPath,
  () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && isSidebarOpen.value) {
      settingsStore.isSidebarOpen = false;
    }
  }
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

let unsubscribeCrossTab: (() => void) | null = null;

const handleEnableGit = async () => {
  try {
    await vaultStore.enableGit();
    toast.success(t('toasts.gitEnabled'));
  } catch (err: any) {
    toast.error(t('toasts.gitEnableError', { message: err.message || err }), t('toasts.gitEnableErrorTitle'));
  }
};

useEventListener(window, 'focus', () => {
  projectStore.invalidate();
});
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    projectStore.invalidate();
  }
});

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

  // Listen for mutations from other open tabs
  unsubscribeCrossTab = crossTabBus.subscribe(async (event) => {
    if (event.type === 'tasks-changed') {
      await projectStore.invalidate();
    } else if (event.type === 'buckets-changed') {
      const activePid = (route.params.projectId as string) || '';
      if (activePid) {
        await projectStore.fetchBuckets(activePid);
      }
      await projectStore.invalidate();
    } else if (event.type === 'projects-changed') {
      await projectStore.fetchProjects();
      await projectStore.invalidate();
    } else if (event.type === 'timeblocks-changed') {
      await timeblockStore.fetchTimeblocks().catch(() => {});
    }
  });

  // Revalidate upon returning/focusing tab if it was frozen or inactive, debounced against event bursts
  const debouncedRevalidate = useDebounceFn(() => {
    if (document.visibilityState === 'visible') {
      projectStore.invalidate().catch(() => {});
      timeblockStore.fetchTimeblocks().catch(() => {});
    }
  }, 150);

  const handleWindowFocus = () => {
    debouncedRevalidate();
  };
  window.addEventListener('visibilitychange', handleWindowFocus);
  window.addEventListener('focus', handleWindowFocus);

  const prevCleanup = unsubscribeCrossTab;
  unsubscribeCrossTab = () => {
    if (prevCleanup) prevCleanup();
    window.removeEventListener('visibilitychange', handleWindowFocus);
    window.removeEventListener('focus', handleWindowFocus);
  };
});

onBeforeUnmount(() => {
  if (unsubscribeCrossTab) {
    unsubscribeCrossTab();
    unsubscribeCrossTab = null;
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
      <!-- Mobile Sidebar Backdrop Overlay -->
      <transition name="fade">
        <div
          v-if="isSidebarOpen"
          class="md:hidden fixed inset-0 bg-black/50 backdrop-blur-xs z-30"
          @click="settingsStore.isSidebarOpen = false"
        />
      </transition>

      <transition :name="isMounted ? 'sidebar' : ''">
        <ProjectSidebar
          v-show="isSidebarOpen"
          :projects="projects"
          :active-project-id="activeProjectId"
          :sync-loading="syncLoading"
          :sync-success="syncSuccess"
          @create-project="handleCreateProject"
          @edit-project="modalStore.openProjectEdit"
          @enable-git="handleEnableGit"
          @import-spreadsheet="modalStore.openImportSpreadsheet"
          @move-tasks-to-project="handleMoveTasksToProject"
          @close="settingsStore.isSidebarOpen = false"
        />
      </transition>

      <div class="flex-grow flex flex-col overflow-hidden min-w-0">
        <div class="flex-grow overflow-hidden relative">
          <!-- Main layout content rendering either global views or ProjectLayout -->
          <router-view />
        </div>
      </div>
    </div>

    <!-- MOBILE BOTTOM NAVIGATION BAR -->
    <MobileNavBar />

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
