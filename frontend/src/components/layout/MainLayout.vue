<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import NavigationBar from '@/components/layout/NavigationBar.vue';
import ProjectSidebar from '@/components/layout/ProjectSidebar.vue';
import ModalRegistry from '@/components/modals/ModalRegistry.vue';
import { useProjects } from '@/composables/useProjects';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { X } from '@lucide/vue';

const route = useRoute();
const router = useRouter();

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const modalStore = useModalStore();

const { isSidebarOpen, currentTheme } = storeToRefs(settingsStore);
const { projects, syncLoading, syncSuccess, error: projectError } = storeToRefs(projectStore);

const localError = ref<string | null>(null);

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

// Watch projects list and redirect if route project does not exist
watch(
  [projects, activeProjectId],
  ([newProjects, newRouteId]) => {
    if (newProjects.length > 0) {
      // If route has a projectId, and it is not in the projects list,
      // redirect the user to the first available project's board view.
      if (newRouteId && newRouteId !== 'settings' && newRouteId !== 'all') {
        const routeProjectExists = newProjects.some((p) => p.id === newRouteId);
        if (!routeProjectExists) {
          selectProject(newProjects[0].id);
        }
      }
    }
  },
  { immediate: true }
);

const selectProject = (projectId: string) => {
  router.push({
    name: 'project',
    params: { projectId },
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

// Hook into task filters to bind the search query and filter modal to NavigationBar
const { searchQuery, taskFilters, hasActiveFilters, applyFilters } = useTaskFilters(ref([]));

const openFilterModal = () => {
  modalStore.openModal('filter', {
    currentFilters: taskFilters.value,
    onApply: applyFilters,
  });
};

const openCreateModal = (bucket: string) => {
  modalStore.openTaskCreate(bucket);
};

// Project creation handling using standard projects composable
const { handleCreateProject: runCreateProject } = useProjects(selectProject);

const handleCreateProject = async (title: string) => {
  await runCreateProject(title);
  await projectStore.fetchProjects(); // sync global project store list
};

const triggerSync = async () => {
  try {
    await projectStore.triggerSync();
  } catch {
    // Error is stored in projectStore.error and displayed automatically
  }
};

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

const handleMoveTasksToProject = ({ taskIds, projectId: targetProjectId }: { taskIds: string[]; projectId: string }) => {
  modalStore.openMoveTasksConfirm(taskIds, targetProjectId);
};

onMounted(async () => {
  await projectStore.fetchProjects();
  setTheme(currentTheme.value);
});
</script>

<template>
  <div class="h-dvh w-full flex flex-col overflow-hidden bg-theme-base">
    <NavigationBar
      ref="navBarRef"
      v-model="searchQuery"
      :is-sidebar-open="isSidebarOpen"
      :projects="projects"
      :active-project-id="activeProjectId"
      :has-active-filters="hasActiveFilters"
      default-bucket-name="todo"
      @toggle-sidebar="toggleSidebar"
      @open-filter="openFilterModal"
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
          @create-project="handleCreateProject"
          @edit-project="modalStore.openProjectEdit"
          @sync="triggerSync"
          @import-planner="modalStore.openImportPlanner"
          @move-tasks-to-project="handleMoveTasksToProject"
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
          <!-- Main layout content rendering either global views or ProjectLayout -->
          <router-view />
        </div>
      </div>
    </div>

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
