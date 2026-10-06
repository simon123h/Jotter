<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted, onUnmounted } from 'vue';
import { useEventListener } from '@vueuse/core';
import {
  Folder,
  Hash,
  MoreHorizontal,
  Plus,
  Pin,
  GitBranch,
  Settings,
  BookOpen,
  FileSpreadsheet,
  History,
  Layers,
  Database,
  Settings2,
  ChevronDown,
  X,
} from '@lucide/vue';
import { storeToRefs } from 'pinia';
import Sortable from 'sortablejs';
import { useSettingsStore } from '@/stores/settings';
import { useModalStore } from '@/stores/modal';
import { useProjectStore } from '@/stores/project';
import { useVaultStore } from '@/stores/vault';
import { isNativeMobile } from '@/platform';
import type { Project } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { isServerOnline, checkServerStatus } from '@/api';
import { useSelectionStore } from '@/stores/selection';

const { t } = useI18n();

const props = defineProps<{
  projects: Project[];
  activeProjectId: string;
  syncLoading?: boolean;
  syncSuccess?: boolean;
}>();

const emit = defineEmits<{
  (e: 'create-project', title: string): void;
  (e: 'edit-project', project: Project): void;
  (e: 'enable-git'): void;
  (e: 'import-spreadsheet', projectId: string): void;
  (e: 'move-tasks-to-project', payload: { taskIds: string[]; projectId: string }): void;
  (e: 'close'): void;
}>();

const selectionStore = useSelectionStore();
const draggingOverProjectId = ref<string | null>(null);

const onDragOver = (event: DragEvent, projectId: string) => {
  if (selectionStore.draggingTaskIds.length > 0 && projectId !== props.activeProjectId) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }
};

const onDragEnter = (projectId: string) => {
  if (selectionStore.draggingTaskIds.length > 0 && projectId !== props.activeProjectId) {
    draggingOverProjectId.value = projectId;
  }
};

const onDragLeave = () => {
  draggingOverProjectId.value = null;
};

const onDrop = (projectId: string) => {
  draggingOverProjectId.value = null;
  const taskIds = selectionStore.draggingTaskIds;
  if (taskIds.length > 0 && projectId !== props.activeProjectId) {
    emit('move-tasks-to-project', { taskIds, projectId });
  }
};

const settingsStore = useSettingsStore();
const { pinnedProjectIds, sortBy } = storeToRefs(settingsStore);

const togglePin = (projectId: string) => {
  if (pinnedProjectIds.value.includes(projectId)) {
    settingsStore.unpinProject(projectId);
  } else {
    settingsStore.pinProject(projectId);
  }
};

const toggleSortOrder = () => {
  settingsStore.setSortBy(sortBy.value === 'alpha' ? 'manual' : 'alpha');
};

// Server Status Checking & Automatic Revalidation
let pingInterval: any = null;
const projectStore = useProjectStore();

const revalidateAndCheckStatus = () => {
  checkServerStatus();
  projectStore.invalidate();
};

const handleFocusOrVisible = () => {
  if (document.visibilityState === 'visible') {
    revalidateAndCheckStatus();
  }
};

const projectsListEl = ref<HTMLElement | null>(null);
let sortableInstance: Sortable | null = null;

const initSortable = () => {
  if (!projectsListEl.value) return;

  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }

  sortableInstance = Sortable.create(projectsListEl.value, {
    animation: 150,
    draggable: '.project-item',
    disabled: sortBy.value !== 'manual',
    filter: 'button, input, select, textarea',
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;

      const reordered = [...sortedProjects.value];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      settingsStore.setProjectOrder(reordered.map((p) => p.id));
    },
  });
};

watch(sortBy, (newSortBy) => {
  if (sortableInstance) {
    sortableInstance.option('disabled', newSortBy !== 'manual');
  }
});

useEventListener(window, 'focus', revalidateAndCheckStatus);
useEventListener(document, 'visibilitychange', handleFocusOrVisible);

onMounted(() => {
  initSortable();
  revalidateAndCheckStatus();

  pingInterval = setInterval(checkServerStatus, 30000);
});

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  if (pingInterval) clearInterval(pingInterval);
});

// Computed sorted and pinned projects list
const sortedProjects = computed(() => {
  return [...props.projects].sort((a, b) => {
    const aPinned = pinnedProjectIds.value.includes(a.id);
    const bPinned = pinnedProjectIds.value.includes(b.id);

    // 1. Pinned projects are always displayed first at the top
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // 2. Sort by the user's selected sorting order
    if (sortBy.value === 'manual') {
      const aIndex = settingsStore.projectOrder.indexOf(a.id);
      const bIndex = settingsStore.projectOrder.indexOf(b.id);
      const aHasOrder = aIndex !== -1;
      const bHasOrder = bIndex !== -1;
      if (aHasOrder && bHasOrder) {
        if (aIndex !== bIndex) return aIndex - bIndex;
      } else if (aHasOrder) {
        return -1;
      } else if (bHasOrder) {
        return 1;
      }
    }

    // Fallback/Default: Alphabetical sorting
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
});

// Add project input states
const showAddProjectInput = ref(false);
const newProjectTitle = ref('');
const addProjectInput = ref<HTMLInputElement | null>(null);

const triggerAddProject = () => {
  showAddProjectInput.value = true;
  nextTick(() => {
    addProjectInput.value?.focus();
  });
};

const handleCreateProject = () => {
  const title = newProjectTitle.value.trim();
  if (!title) {
    showAddProjectInput.value = false;
    return;
  }
  emit('create-project', title);
  newProjectTitle.value = '';
  showAddProjectInput.value = false;
};

const modalStore = useModalStore();

const openTimeMachineModal = () => {
  modalStore.openTimeMachine(props.activeProjectId || undefined);
};

// Vault management
const vaultStore = useVaultStore();
const { vaults, activeVault, gitInstalled, switching } = storeToRefs(vaultStore);

onMounted(() => {
  vaultStore.fetchVaults();
});

const onVaultSelected = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  if (target.value && target.value !== activeVault.value?.id) {
    await vaultStore.selectVault(target.value);
  }
};
</script>

<template>
  <aside
    class="w-64 border-r border-theme-border flex flex-col shrink-0 bg-theme-card fixed inset-y-0 left-0 z-40 shadow-2xl pt-safe pb-safe md:static md:z-auto md:shadow-none md:pt-0 md:pb-0"
  >
    <!-- Server Status Indicator (Only visible when offline) -->
    <div
      v-if="!isServerOnline"
      class="px-4 py-2.5 border-b border-red-500/20 flex items-center justify-between shrink-0 bg-red-500/10 text-red-400"
    >
      <span class="text-[10px] uppercase font-bold tracking-wider text-red-400/80">{{ t('projects.serverStatus') }}</span>
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        <span class="text-[11px] font-semibold font-mono text-red-400"> {{ t('projects.offline') }} </span>
      </div>
    </div>

    <!-- Vault Switcher Header -->
    <div class="px-3 py-2 border-b border-theme-border/60 bg-theme-base/40 flex items-center justify-between gap-1.5">
      <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <Database class="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <div class="relative flex-1 min-w-0">
          <select
            :value="activeVault?.id"
            @change="onVaultSelected"
            class="w-full text-xs font-semibold bg-transparent text-theme-text-main appearance-none pr-5 truncate cursor-pointer hover:text-theme-accent focus:outline-none"
            :title="activeVault?.path"
          >
            <option v-for="v in vaults" :key="v.id" :value="v.id" class="bg-theme-card text-theme-text-main">
              {{ v.name }}
            </option>
          </select>
          <ChevronDown class="w-3 h-3 text-theme-text-muted absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      <button
        @click="modalStore.openVaultManage()"
        class="p-1 rounded text-theme-text-muted hover:text-theme-accent hover:bg-theme-column transition-colors cursor-pointer shrink-0"
        :title="t('vaults.manage')"
        data-testid="manage-vaults-btn"
      >
        <Settings2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Sidebar Header -->
    <div class="p-4 border-b border-theme-border flex items-center justify-between shrink-0">
      <h2 class="text-sm font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
        <Folder class="w-4 h-4 text-theme-accent shrink-0" /> {{ t('projects.sidebarTitle') }}
      </h2>

      <div class="flex items-center gap-1.5">
        <!-- Sort Order Toggle Badge Button -->
        <button
          @click="toggleSortOrder"
          class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-theme-border/50 bg-theme-column/30 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main transition-colors cursor-pointer"
          :title="sortBy === 'alpha' ? t('projects.sortTooltipAlpha') : t('projects.sortTooltipManual')"
        >
          {{ sortBy === 'alpha' ? 'A-Z' : t('projects.sortManualAbbr') }}
        </button>

        <!-- Close Button (Mobile Only) -->
        <button
          @click="emit('close')"
          class="md:hidden p-1 rounded text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40"
          :title="t('buttons.close') || 'Close'"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Projects List -->
    <div ref="projectsListEl" class="flex-grow overflow-y-auto p-2 space-y-1 scroller-thin">
      <div v-if="switching" class="flex items-center justify-center gap-2 py-6 text-xs text-theme-text-muted" data-testid="vault-switching">
        <span class="w-3.5 h-3.5 border-2 border-theme-accent border-t-transparent rounded-full animate-spin"></span>
        {{ t('vaults.loading') }}
      </div>

      <!-- Virtual "All Projects" Item -->
      <router-link
        v-if="!switching"
        :to="{
          name: 'project',
          params: { projectId: 'all' },
          query: $route.query,
        }"
        class="project-item group relative flex items-center justify-between px-3 py-1.5 rounded text-sm transition-all duration-200 font-medium animate-fade-in border"
        :class="[
          activeProjectId === 'all'
            ? 'bg-theme-primary/10 text-theme-accent border-theme-primary/15'
            : 'text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main border-transparent',
        ]"
      >
        <div class="flex items-center gap-2 overflow-hidden flex-grow mr-2">
          <Layers class="w-3.5 h-3.5 text-theme-text-muted shrink-0" :class="{ 'text-theme-accent': activeProjectId === 'all' }" />
          <span class="truncate font-sans font-semibold">
            {{ t('projects.allProjects') || 'All Projects' }}
          </span>
        </div>
      </router-link>

      <router-link
        v-for="project in switching ? [] : sortedProjects"
        :key="project.id"
        :to="{
          name: 'project',
          params: { projectId: project.id },
          query: $route.query,
        }"
        class="project-item group relative flex items-center justify-between px-3 py-1.5 rounded text-sm transition-all duration-200 font-medium animate-fade-in"
        :class="[
          project.id === activeProjectId
            ? 'bg-theme-primary/10 text-theme-accent border border-theme-primary/15'
            : 'text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main border border-transparent',
          sortBy === 'manual' ? 'cursor-grab' : 'cursor-pointer',
          project.id === draggingOverProjectId
            ? '!border-theme-primary !bg-theme-primary/15 scale-[1.03] shadow-lg shadow-theme-primary/10 ring-2 ring-theme-primary/30 z-10 text-theme-accent'
            : '',
          selectionStore.draggingTaskIds.length > 0 ? 'dragging-active' : '',
        ]"
        @dragover="onDragOver($event, project.id)"
        @dragenter.prevent="onDragEnter(project.id)"
        @dragleave="onDragLeave"
        @drop="onDrop(project.id)"
      >
        <!-- Project Title -->
        <div class="flex items-center gap-2 overflow-hidden flex-grow mr-2">
          <Hash class="w-3.5 h-3.5 text-theme-text-muted shrink-0" :class="{ 'text-theme-accent': project.id === draggingOverProjectId }" />
          <span class="truncate font-sans">
            {{ project.title }}
          </span>
        </div>

        <!-- Project Actions -->
        <div class="flex items-center gap-1 shrink-0">
          <span
            v-if="project.id === draggingOverProjectId && selectionStore.draggingTaskIds.length > 0"
            class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-primary text-white animate-pulse shadow-md shadow-theme-primary/50"
          >
            +{{ selectionStore.draggingTaskIds.length }}
          </span>
          <template v-else>
            <!-- Pin Toggle Button -->
            <button
              @click.stop.prevent="togglePin(project.id)"
              class="p-0.5 rounded transition-all cursor-pointer"
              :class="
                pinnedProjectIds.includes(project.id)
                  ? 'text-theme-accent opacity-100'
                  : 'text-theme-text-muted hover:text-theme-text-main opacity-70 md:opacity-0 md:group-hover:opacity-100'
              "
              :title="pinnedProjectIds.includes(project.id) ? t('projects.unpinProject') : t('projects.pinProject')"
            >
              <Pin class="w-3 h-3" :class="{ 'fill-theme-accent': pinnedProjectIds.includes(project.id) }" />
            </button>

            <!-- Edit Icon -->
            <div class="flex items-center gap-1 shrink-0 transition-opacity">
              <!-- Edit Project Button -->
              <button
                @click.stop.prevent="emit('edit-project', project)"
                class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded transition-colors cursor-pointer"
                :title="t('projects.editProject')"
              >
                <MoreHorizontal class="w-3.5 h-3.5" />
              </button>
            </div>
          </template>
        </div>
      </router-link>
    </div>

    <!-- Add Project Action at Bottom of Sidebar -->
    <div class="p-3 shrink-0">
      <div v-if="showAddProjectInput" class="flex flex-col gap-2">
        <input
          v-model="newProjectTitle"
          ref="addProjectInput"
          type="text"
          :placeholder="t('projects.newProjectPlaceholder')"
          class="w-full bg-theme-base border border-theme-border rounded px-2.5 py-1 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary"
          @keydown.enter="handleCreateProject"
          @blur="handleCreateProject"
        />
      </div>
      <button
        v-else
        @click="triggerAddProject"
        class="w-full flex items-center justify-center gap-1.5 py-1.5 text-sm font-semibold border border-dashed border-theme-border text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary hover:bg-theme-column/30 rounded transition-all cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5 shrink-0" /> {{ t('projects.newProject') }}
      </button>
    </div>

    <!-- Sidebar Footer Actions -->
    <div class="p-3 border-t border-theme-border flex flex-col gap-1.5 shrink-0 bg-transparent">
      <!-- Time Machine (Git vaults only); tints while a restore runs / succeeds -->
      <button
        v-if="activeVault?.is_git"
        @click="openTimeMachineModal"
        class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded transition-all duration-300 cursor-pointer"
        :class="
          syncSuccess
            ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
            : syncLoading
              ? 'bg-theme-column/20 text-theme-text-main animate-pulse'
              : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30'
        "
        :title="t('sidebar.timeMachineTooltip')"
      >
        <History class="w-3.5 h-3.5" />
        <span>{{ t('timeMachineModal.title') }}</span>
      </button>

      <!-- Enable Git versioning for non-Git vaults -->
      <button
        v-else-if="activeVault && !isNativeMobile"
        @click="emit('enable-git')"
        :disabled="!gitInstalled || syncLoading"
        :title="gitInstalled ? t('commit.enableTooltip') : t('commit.gitMissing')"
        class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded text-theme-text-muted transition-all cursor-pointer hover:text-theme-text-main hover:bg-theme-column/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <GitBranch class="w-3.5 h-3.5" />
        <span>{{ t('commit.enable') }}</span>
      </button>

      <!-- Import Spreadsheet Button -->
      <button
        v-if="activeProjectId"
        @click="emit('import-spreadsheet', activeProjectId)"
        class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded border border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main transition-all cursor-pointer"
      >
        <FileSpreadsheet class="w-3.5 h-3.5" />
        <span>{{ t('sidebar.importSpreadsheet') }}</span>
      </button>

      <!-- Documentation Link -->
      <a
        href="https://simon123h.github.io/Jotter/"
        target="_blank"
        rel="noopener noreferrer"
        class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded border border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main transition-all cursor-pointer"
      >
        <BookOpen class="w-3.5 h-3.5" />
        <span>{{ t('views.documentation') }}</span>
      </a>

      <!-- Settings Button -->
      <router-link
        :to="{ name: 'settings', query: $route.query }"
        class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded border transition-all cursor-pointer"
        :class="
          $route.name === 'settings'
            ? 'bg-theme-primary/10 border-theme-primary/15 text-theme-accent'
            : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
        "
      >
        <Settings class="w-3.5 h-3.5" />
        <span>{{ t('views.settings') }}</span>
      </router-link>
    </div>
  </aside>
</template>

<style scoped>
.project-item.dragging-active * {
  pointer-events: none;
}

/* Fade/Slide transition for premium micro-animations */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
