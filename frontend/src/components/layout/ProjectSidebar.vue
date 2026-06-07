<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted, onUnmounted } from 'vue';
import { Folder, Hash, MoreHorizontal, Plus, Pin, RefreshCw, Settings, Check, GitBranch } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import Sortable from 'sortablejs';
import { useSettingsStore } from '@/stores/settings';
import type { Project } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { isServerOnline, checkServerStatus } from '@/api';

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
  (e: 'sync'): void;
}>();

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

// Server Status Checking
let pingInterval: any = null;

const handleFocusOrVisible = () => {
  if (document.visibilityState === 'visible') {
    checkServerStatus();
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

onMounted(() => {
  initSortable();
  checkServerStatus();
  pingInterval = setInterval(checkServerStatus, 30000);
  window.addEventListener('focus', checkServerStatus);
  document.addEventListener('visibilitychange', handleFocusOrVisible);
});

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  if (pingInterval) clearInterval(pingInterval);
  window.removeEventListener('focus', checkServerStatus);
  document.removeEventListener('visibilitychange', handleFocusOrVisible);
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
</script>

<template>
  <aside class="w-64 border-r border-theme-border flex flex-col shrink-0 bg-theme-card">
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

    <!-- Sidebar Header -->
    <div class="p-4 border-b border-theme-border flex items-center justify-between shrink-0">
      <h2 class="text-sm font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
        <Folder class="w-4 h-4 text-theme-accent shrink-0" /> {{ t('projects.sidebarTitle') }}
      </h2>

      <!-- Sort Order Toggle Badge Button -->
      <button
        @click="toggleSortOrder"
        class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-theme-border/50 bg-theme-column/30 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main transition-colors cursor-pointer"
        :title="sortBy === 'alpha' ? t('projects.sortTooltipAlpha') : t('projects.sortTooltipManual')"
      >
        {{ sortBy === 'alpha' ? 'A-Z' : t('projects.sortManualAbbr') }}
      </button>
    </div>

    <!-- Projects List -->
    <div ref="projectsListEl" class="flex-grow overflow-y-auto p-2 space-y-1 scroller-thin">
      <router-link
        v-for="project in sortedProjects"
        :key="project.id"
        :to="{
          name: 'project',
          params: { projectId: project.id },
          query: $route.query,
        }"
        class="project-item group relative flex items-center justify-between px-3 py-1.5 rounded text-sm transition-all font-medium animate-fade-in"
        :class="[
          project.id === activeProjectId
            ? 'bg-theme-primary/10 text-theme-accent border border-theme-primary/15'
            : 'text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main border border-transparent',
          sortBy === 'manual' ? 'cursor-grab' : 'cursor-pointer',
        ]"
      >
        <!-- Project Title -->
        <div class="flex items-center gap-2 overflow-hidden flex-grow mr-2">
          <Hash class="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
          <span class="truncate font-sans flex items-center gap-1.5" :title="t('projects.gitConnectedTooltip')">
            {{ project.title }}
            <GitBranch v-if="project.git_remote" class="w-3 h-3 text-theme-accent shrink-0" />
          </span>
        </div>

        <!-- Project Actions -->
        <div class="flex items-center gap-1 shrink-0">
          <!-- Pin Toggle Button -->
          <button
            @click.stop.prevent="togglePin(project.id)"
            class="p-0.5 rounded transition-all cursor-pointer"
            :class="
              pinnedProjectIds.includes(project.id)
                ? 'text-theme-accent opacity-100'
                : 'text-theme-text-muted hover:text-theme-text-main opacity-0 group-hover:opacity-100'
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
      <!-- Sync Index Button -->
      <button
        @click="emit('sync')"
        class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded border transition-all duration-300 cursor-pointer"
        :class="
          syncSuccess
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
            : syncLoading
              ? 'bg-theme-column/20 border-transparent text-theme-text-main'
              : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
        "
        :disabled="syncLoading"
      >
        <Check v-if="syncSuccess" class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-bounce" />
        <RefreshCw v-else class="w-3.5 h-3.5" :class="{ 'animate-spin': syncLoading }" />
        <span>
          {{ syncSuccess ? t('sync.synced') : syncLoading ? t('sync.syncing') : t('sync.button') }}
        </span>
      </button>

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
