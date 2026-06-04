<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted, onUnmounted } from 'vue';
import { Folder, Hash, Pencil, Trash2, Plus, Pin } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settings';
import type { Project } from '../types';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  projects: Project[];
  activeProjectId: string;
}>();

const emit = defineEmits<{
  (e: 'select-project', id: string): void;
  (e: 'create-project', title: string): void;
  (e: 'rename-project', payload: { id: string; title: string }): void;
  (e: 'delete-project', project: Project): void;
}>();

const settingsStore = useSettingsStore();
const { pinnedProjectIds, sortBy } = storeToRefs(settingsStore);

const togglePin = (projectId: string, event: Event) => {
  event.stopPropagation();
  if (pinnedProjectIds.value.includes(projectId)) {
    settingsStore.unpinProject(projectId);
  } else {
    settingsStore.pinProject(projectId);
  }
};

const toggleSortOrder = () => {
  settingsStore.setSortBy(sortBy.value === 'alpha' ? 'mru' : 'alpha');
};

const updateMru = (id: string) => {
  if (id) {
    settingsStore.updateProjectMru(id);
  }
};

watch(
  () => props.activeProjectId,
  (newId) => {
    updateMru(newId);
  }
);

// Server Status Checking
const isServerOnline = ref(true);
let pingInterval: any = null;

const checkServerStatus = async () => {
  try {
    const apiBase = import.meta.env.DEV ? 'http://localhost:8000' : '';
    const response = await fetch(`${apiBase}/projects`, { method: 'GET' });
    isServerOnline.value = response.ok;
  } catch {
    isServerOnline.value = false;
  }
};

onMounted(() => {
  updateMru(props.activeProjectId);
  checkServerStatus();
  pingInterval = setInterval(checkServerStatus, 5000);
});

onUnmounted(() => {
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
    if (sortBy.value === 'mru') {
      const aMru = settingsStore.getProjectMru(a.id);
      const bMru = settingsStore.getProjectMru(b.id);
      if (aMru !== bMru) {
        return bMru - aMru; // descending: recently active project first
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

// Rename project input states
const editingProjectId = ref<string | null>(null);
const editingProjectTitle = ref('');

const startRenameProject = (project: Project) => {
  editingProjectId.value = project.id;
  editingProjectTitle.value = project.title;
  nextTick(() => {
    const input = document.getElementById(`rename-${project.id}`) as HTMLInputElement;
    input?.focus();
  });
};

const saveRenameProject = () => {
  const projId = editingProjectId.value;
  const newTitle = editingProjectTitle.value.trim();
  if (!projId) return;
  if (!newTitle) {
    editingProjectId.value = null;
    return;
  }
  emit('rename-project', { id: projId, title: newTitle });
  editingProjectId.value = null;
};
</script>

<template>
  <aside class="w-64 border-r border-theme-border flex flex-col shrink-0 bg-theme-card">
    <!-- Sidebar Header -->
    <div class="p-4 border-b border-theme-border flex items-center justify-between shrink-0">
      <h2 class="text-sm font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
        <Folder class="w-4 h-4 text-theme-accent shrink-0" /> {{ t('projects.sidebarTitle') }}
      </h2>

      <!-- Sort Order Toggle Badge Button -->
      <button
        @click="toggleSortOrder"
        class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-theme-border/50 bg-theme-column/30 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main transition-colors cursor-pointer"
        :title="sortBy === 'alpha' ? t('projects.sortTooltipAlpha') : t('projects.sortTooltipMru')"
      >
        {{ sortBy === 'alpha' ? 'A-Z' : 'MRU' }}
      </button>
    </div>

    <!-- Projects List -->
    <div class="flex-grow overflow-y-auto p-2 space-y-1 scroller-thin">
      <div
        v-for="project in sortedProjects"
        :key="project.id"
        class="group relative flex items-center justify-between px-3 py-1.5 rounded text-sm transition-all cursor-pointer font-medium"
        :class="
          project.id === activeProjectId
            ? 'bg-theme-primary/10 text-theme-accent border border-theme-primary/15'
            : 'text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main border border-transparent'
        "
        @click="emit('select-project', project.id)"
      >
        <!-- Project Title / Inline Rename Input -->
        <div class="flex items-center gap-2 overflow-hidden flex-grow mr-2">
          <Hash class="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
          <input
            v-if="editingProjectId === project.id"
            :id="`rename-${project.id}`"
            v-model="editingProjectTitle"
            type="text"
            class="w-full bg-theme-base border border-theme-border rounded px-1.5 py-0.5 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary"
            @keydown.enter="saveRenameProject"
            @blur="saveRenameProject"
          />
          <span v-else class="truncate font-sans">{{ project.title }}</span>
        </div>

        <!-- Project Actions -->
        <div class="flex items-center gap-1 shrink-0">
          <!-- Pin Toggle Button -->
          <button
            @click.stop="togglePin(project.id, $event)"
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

          <!-- Rename / Delete Icons -->
          <div
            v-if="editingProjectId !== project.id"
            class="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity"
          >
            <!-- Rename Icon -->
            <button
              @click.stop="startRenameProject(project)"
              class="p-0.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded transition-colors cursor-pointer"
              :title="t('projects.renameProject')"
            >
              <Pencil class="w-3 h-3" />
            </button>
            <!-- Delete Icon -->
            <button
              @click.stop="emit('delete-project', project)"
              class="p-0.5 text-red-400 hover:text-red-300 hover:bg-theme-column rounded transition-colors cursor-pointer"
              :title="t('buttons.delete')"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Project Action at Bottom of Sidebar -->
    <div class="p-3 border-t border-theme-border shrink-0">
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

    <!-- Server Status Indicator (Only visible when offline) -->
    <div
      v-if="!isServerOnline"
      class="px-4 py-2 border-t border-theme-border flex items-center justify-between shrink-0 bg-red-500/10 text-red-400"
    >
      <span class="text-[10px] uppercase font-bold tracking-wider text-red-400/80">Server Status</span>
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        <span class="text-[11px] font-semibold font-mono text-red-400"> OFFLINE </span>
      </div>
    </div>
  </aside>
</template>
