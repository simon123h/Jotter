<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import type { Task, Bucket, BucketName, Project } from '../types';
import {
  getTasks,
  moveTask,
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
import BoardView from './BoardView.vue';
import ListView from './ListView.vue';
import { useI18n } from '../composables/useI18n';

const { locale, t } = useI18n();

const tasks = ref<Task[]>([]);
const buckets = ref<Bucket[]>([]);
const projects = ref<Project[]>([]);
const activeProjectId = ref<string>(localStorage.getItem('jotter-active-project-id') || 'default');

const loading = ref(false);
const syncLoading = ref(false);
const error = ref<string | null>(null);

// Filter state
const searchQuery = ref('');
const selectedTag = ref<string | null>(null);

// View Mode state (board or list)
const viewMode = ref<'board' | 'list'>((localStorage.getItem('jotter-view-mode') as 'board' | 'list') || 'board');
const setViewMode = (mode: 'board' | 'list') => {
  viewMode.value = mode;
  localStorage.setItem('jotter-view-mode', mode);
};

// Modal state
const isDetailOpen = ref(false);
const selectedTaskId = ref<number | null>(null);
const isCreateOpen = ref(false);
const createDefaultBucket = ref<BucketName>('todo');

// Theme state
const currentTheme = ref(localStorage.getItem('jotter-theme') || 'nordic-light');
const isThemeDropdownOpen = ref(false);
const isLanguageDropdownOpen = ref(false);

const themes = [
  { id: 'midnight', name: 'Midnight Violet', color: 'bg-violet-500' },
  { id: 'forest', name: 'Emerald Forest', color: 'bg-emerald-500' },
  { id: 'frost', name: 'Nordic Frost', color: 'bg-sky-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', color: 'bg-pink-500' },
  { id: 'sakura', name: 'Sakura Rose', color: 'bg-rose-500' },
  { id: 'nordic-light', name: 'Nordic Light', color: 'bg-blue-600' },
  { id: 'desert-light', name: 'Desert Amber', color: 'bg-orange-600' },
];

const setTheme = (theme: string) => {
  currentTheme.value = theme;
  localStorage.setItem('jotter-theme', theme);
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
  isThemeDropdownOpen.value = false;
};

// Projects management
const fetchProjects = async () => {
  try {
    projects.value = await getProjects();
    // Fallback if active project no longer exists
    if (!projects.value.find((p) => p.id === activeProjectId.value)) {
      activeProjectId.value = 'default';
      localStorage.setItem('jotter-active-project-id', 'default');
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch projects';
  }
};

const selectProject = (projectId: string) => {
  activeProjectId.value = projectId;
  localStorage.setItem('jotter-active-project-id', projectId);
  error.value = null;
  selectedTag.value = null;
  fetchAllData();
};

const showAddProjectInput = ref(false);
const newProjectTitle = ref('');
const addProjectInput = ref<HTMLInputElement | null>(null);

const triggerAddProject = () => {
  showAddProjectInput.value = true;
  nextTick(() => {
    addProjectInput.value?.focus();
  });
};

const handleCreateProject = async () => {
  const title = newProjectTitle.value.trim();
  if (!title) {
    showAddProjectInput.value = false;
    return;
  }
  try {
    const created = await createProject(title);
    newProjectTitle.value = '';
    showAddProjectInput.value = false;
    await fetchProjects();
    selectProject(created.id);
  } catch (err: any) {
    error.value = err.message || 'Failed to create project';
  }
};

// Project editing and deletion
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

const saveRenameProject = async () => {
  const projId = editingProjectId.value;
  const newTitle = editingProjectTitle.value.trim();
  if (!projId) return;
  if (!newTitle) {
    editingProjectId.value = null;
    return;
  }
  try {
    await updateProject(projId, newTitle);
    editingProjectId.value = null;
    await fetchProjects();
  } catch (err: any) {
    error.value = err.message || 'Failed to rename project';
  }
};

const handleDeleteProject = async (project: Project) => {
  if (project.id === 'default') {
    alert(t('projects.deleteProjectDefaultError'));
    return;
  }
  const message = t('projects.deleteProjectConfirm', { title: project.title });
  if (!confirm(message)) return;

  try {
    await deleteProject(project.id);
    await fetchProjects();
    if (activeProjectId.value === project.id) {
      selectProject('default');
    }
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
    tasks.value = await getTasks(activeProjectId.value);
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

// Compute unique list of tags across all tasks
const allTags = computed(() => {
  const tagsSet = new Set<string>();
  tasks.value.forEach((t) => {
    if (t.tags) {
      t.tags.forEach((tag) => tagsSet.add(tag));
    }
  });
  return Array.from(tagsSet).sort();
});

// Filter tasks based on Search query (title + body) & selected tag
const filteredTasks = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return tasks.value.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(query) || (task.body && task.body.toLowerCase().includes(query));
    const matchesTag = !selectedTag.value || (task.tags && task.tags.includes(selectedTag.value));
    return matchesSearch && matchesTag;
  });
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
  selectedTaskId.value = task.id;
  isDetailOpen.value = true;
};

const openCreateModal = (bucket: BucketName) => {
  createDefaultBucket.value = bucket;
  isCreateOpen.value = true;
};

const handleCardDropped = async ({
  taskId,
  toBucket,
  newIndex,
}: {
  taskId: number;
  toBucket: BucketName;
  oldIndex: number;
  newIndex: number;
}) => {
  // Find other tasks in the target bucket
  const targetBucketTasks = tasks.value.filter((t) => t.bucket === toBucket).sort((a, b) => a.position - b.position);

  // Exclude the dragged task itself (for intra-column reordering)
  const otherTasks = targetBucketTasks.filter((t) => t.id !== taskId);

  // Calculate new position
  let newPosition: number;
  if (otherTasks.length === 0) {
    newPosition = 1000.0;
  } else if (newIndex === 0) {
    newPosition = otherTasks[0].position - 1000.0;
  } else if (newIndex >= otherTasks.length) {
    newPosition = otherTasks[otherTasks.length - 1].position + 1000.0;
  } else {
    const prevTask = otherTasks[newIndex - 1];
    const nextTask = otherTasks[newIndex];
    newPosition = (prevTask.position + nextTask.position) / 2.0;
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

const handleCreateColumn = async (title: string) => {
  try {
    await createBucket(activeProjectId.value, title);
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to create column';
  }
};

const handleRenameColumn = async ({ bucketName, newTitle }: { bucketName: string; newTitle: string }) => {
  if (!newTitle.trim()) return;
  try {
    await updateBucket(activeProjectId.value, bucketName, { title: newTitle.trim() });
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to rename column';
  }
};

const handleDeleteColumn = async (bucketName: string) => {
  try {
    await deleteBucket(activeProjectId.value, bucketName);
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to delete column';
  }
};

const handleMoveColumn = async (bucketName: string, direction: 'left' | 'right') => {
  const index = buckets.value.findIndex((b) => b.name === bucketName);
  if (index === -1) return;
  if (direction === 'left' && index === 0) return;
  if (direction === 'right' && index === buckets.value.length - 1) return;

  const targetIndex = direction === 'left' ? index - 1 : index + 1;
  const currentCol = buckets.value[index];
  const targetCol = buckets.value[targetIndex];

  // Swap positions locally
  const tempPos = currentCol.position;
  currentCol.position = targetCol.position;
  targetCol.position = tempPos;

  // Sort local list
  buckets.value.sort((a, b) => a.position - b.position);

  try {
    // Persist updates to the database
    await Promise.all([
      updateBucket(activeProjectId.value, currentCol.name, { position: currentCol.position }),
      updateBucket(activeProjectId.value, targetCol.name, { position: targetCol.position }),
    ]);
  } catch {
    error.value = 'Failed to reorder columns. Reverting changes.';
    await fetchBuckets();
  }
};

const triggerSync = async () => {
  syncLoading.value = true;
  error.value = null;
  try {
    const result = await syncSystem();
    alert(t('sync.success', { count: result.synchronized_tasks }));
    await fetchProjects();
    await fetchAllData();
  } catch (err: any) {
    error.value = t('sync.error', { message: err.message || err });
  } finally {
    syncLoading.value = false;
  }
};
</script>

<template>
  <div class="h-screen w-full flex overflow-hidden select-none bg-theme-base">
    <!-- Left Projects Sidebar -->
    <aside class="w-64 border-r border-theme-border flex flex-col shrink-0 bg-theme-card">
      <!-- Sidebar Header -->
      <div class="p-4 border-b border-theme-border flex items-center justify-between shrink-0">
        <h2 class="text-xs font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
          <span class="text-sm">📁</span> {{ t('projects.sidebarTitle') }}
        </h2>
      </div>

      <!-- Projects List -->
      <div class="flex-grow overflow-y-auto p-2 space-y-1 scroller-thin">
        <div
          v-for="project in projects"
          :key="project.id"
          class="group relative flex items-center justify-between px-3 py-2 rounded text-xs transition-all cursor-pointer font-medium"
          :class="
            project.id === activeProjectId
              ? 'bg-theme-primary/10 text-theme-accent border border-theme-primary/15'
              : 'text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main border border-transparent'
          "
          @click="selectProject(project.id)"
        >
          <!-- Project Title / Inline Rename Input -->
          <div class="flex items-center gap-2 overflow-hidden flex-grow mr-2">
            <span class="text-theme-text-muted text-[10px]">#</span>
            <input
              v-if="editingProjectId === project.id"
              :id="`rename-${project.id}`"
              v-model="editingProjectTitle"
              type="text"
              class="w-full bg-theme-base border border-theme-border rounded px-1.5 py-0.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
              @keydown.enter="saveRenameProject"
              @blur="saveRenameProject"
            />
            <span v-else class="truncate text-[11px] font-sans">{{ project.title }}</span>
          </div>

          <!-- Project Actions (Rename, Delete) visible on hover -->
          <div
            v-if="editingProjectId !== project.id && project.id !== 'default'"
            class="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity"
          >
            <!-- Rename Icon -->
            <button
              @click.stop="startRenameProject(project)"
              class="p-0.5 text-[10px] text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded transition-colors cursor-pointer"
              :title="t('projects.renameProject')"
            >
              ✏️
            </button>
            <!-- Delete Icon -->
            <button
              @click.stop="handleDeleteProject(project)"
              class="p-0.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-theme-column rounded transition-colors cursor-pointer"
              :title="t('buttons.delete')"
            >
              🗑️
            </button>
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
            class="w-full bg-theme-base border border-theme-border rounded px-2.5 py-1 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
            @keydown.enter="handleCreateProject"
            @blur="handleCreateProject"
          />
        </div>
        <button
          v-else
          @click="triggerAddProject"
          class="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold border border-dashed border-theme-border text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary hover:bg-theme-column/30 rounded transition-all cursor-pointer"
        >
          <span>➕</span> {{ t('projects.newProject') }}
        </button>
      </div>
    </aside>

    <!-- Main Content Panel -->
    <div class="flex-grow flex flex-col p-3 overflow-hidden">
      <!-- Header Controls -->
      <header class="flex items-center justify-between gap-3 border-b border-theme-border pb-2.5 shrink-0">
        <div class="flex items-baseline gap-2 overflow-hidden mr-2">
          <h1 class="text-lg font-bold tracking-tight text-theme-text-main truncate">
            {{ t('brand.title') }}
            <span class="text-sm font-semibold text-theme-text-muted ml-1" v-if="projects.find((p) => p.id === activeProjectId)">
              / {{ projects.find((p) => p.id === activeProjectId)?.title }}
            </span>
          </h1>
          <p class="text-theme-text-muted text-[10px] font-sans hidden xl:inline-block border-l border-theme-border pl-2 truncate">
            {{ t('brand.subtitle') }}
          </p>
        </div>

        <!-- Toolbar Actions -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Search -->
          <div class="relative w-32 sm:w-44 md:w-56">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('searchPlaceholder')"
              class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1 text-xs text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            />
          </div>

          <!-- View Mode Toggle -->
          <div class="flex items-center bg-theme-card border border-theme-border rounded p-0.5 shadow-sm shrink-0">
            <button
              @click="setViewMode('board')"
              class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
              :class="
                viewMode === 'board'
                  ? 'bg-theme-primary text-white'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
              "
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              <span class="hidden sm:inline">{{ t('views.board') }}</span>
            </button>
            <button
              @click="setViewMode('list')"
              class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer"
              :class="
                viewMode === 'list'
                  ? 'bg-theme-primary text-white'
                  : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
              "
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span class="hidden sm:inline">{{ t('views.list') }}</span>
            </button>
          </div>

          <!-- Theme Selector Dropdown -->
          <div class="relative shrink-0">
            <div v-if="isThemeDropdownOpen" class="fixed inset-0 z-10" @click="isThemeDropdownOpen = false"></div>

            <button
              @click="isThemeDropdownOpen = !isThemeDropdownOpen"
              class="relative z-20 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 bg-theme-card hover:bg-theme-column/80 text-theme-text-card border border-theme-border rounded transition-all shadow-sm cursor-pointer"
              :title="t('themeChoose')"
            >
              <span class="w-3 h-3 rounded-full" :class="themes.find((t) => t.id === currentTheme)?.color"></span>
              <span class="hidden lg:inline">{{ t('themeLabel') }}</span>
              <svg class="w-3 h-3 text-theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              v-if="isThemeDropdownOpen"
              class="absolute right-0 mt-1 w-44 bg-theme-card border border-theme-border rounded shadow-xl z-20 p-1 space-y-0.5"
            >
              <button
                v-for="th in themes"
                :key="th.id"
                @click="setTheme(th.id)"
                class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-theme-text-card hover:bg-theme-column hover:text-theme-text-main rounded transition-colors text-left font-medium cursor-pointer"
                :class="{ 'bg-theme-column/50 border border-theme-border/20': currentTheme === th.id }"
              >
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="th.color"></span>
                {{ t('themeNames.' + th.id) }}
              </button>
            </div>
          </div>

          <!-- Language Selector Dropdown -->
          <div class="relative shrink-0">
            <div v-if="isLanguageDropdownOpen" class="fixed inset-0 z-10" @click="isLanguageDropdownOpen = false"></div>

            <button
              @click="isLanguageDropdownOpen = !isLanguageDropdownOpen"
              class="relative z-20 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-theme-card hover:bg-theme-column/80 text-theme-text-card border border-theme-border rounded transition-all shadow-sm cursor-pointer"
              :title="t('language.choose')"
            >
              <span class="text-xs shrink-0">🌐</span>
              <span class="hidden lg:inline">{{ t('language.' + locale) }}</span>
              <span class="lg:hidden uppercase">{{ locale }}</span>
              <svg class="w-3 h-3 text-theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              v-if="isLanguageDropdownOpen"
              class="absolute right-0 mt-1 w-28 bg-theme-card border border-theme-border rounded shadow-xl z-20 p-1 space-y-0.5"
            >
              <button
                @click="
                  locale = 'en';
                  isLanguageDropdownOpen = false;
                "
                class="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-theme-text-card hover:bg-theme-column hover:text-theme-text-main rounded transition-colors text-left font-medium cursor-pointer"
                :class="{ 'bg-theme-column/50 border border-theme-border/20': locale === 'en' }"
              >
                English
              </button>
              <button
                @click="
                  locale = 'de';
                  isLanguageDropdownOpen = false;
                "
                class="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-theme-text-card hover:bg-theme-column hover:text-theme-text-main rounded transition-colors text-left font-medium cursor-pointer"
                :class="{ 'bg-theme-column/50 border border-theme-border/20': locale === 'de' }"
              >
                Deutsch
              </button>
            </div>
          </div>

          <!-- Sync Button -->
          <button
            @click="triggerSync"
            class="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-theme-card hover:bg-theme-column/80 text-theme-text-card border border-theme-border rounded transition-all shadow-sm cursor-pointer shrink-0"
            :disabled="syncLoading"
            :title="t('sync.tooltip')"
          >
            <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': syncLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
            </svg>
            <span class="hidden lg:inline">
              {{ syncLoading ? t('sync.syncing') : t('sync.button') }}
            </span>
          </button>

          <!-- New Task Button -->
          <button
            @click="openCreateModal(buckets[0]?.name || 'todo')"
            class="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow-sm hover:shadow-theme-ring/10 transition-all cursor-pointer shrink-0"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">{{ t('addTaskButton') }}</span>
          </button>
        </div>
      </header>

      <!-- Error Banner -->
      <div
        v-if="error"
        class="mt-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex justify-between items-center shrink-0"
      >
        <span>{{ error }}</span>
        <button @click="error = null" class="hover:text-white cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Horizontal Tag Filter List -->
      <div v-if="allTags.length" class="flex items-center gap-1.5 overflow-x-auto pb-1.5 mt-2.5 shrink-0 scroller-thin">
        <span class="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider shrink-0 mr-1">{{ t('tagsLabel') }}</span>
        <button
          @click="selectedTag = null"
          class="text-[10px] font-semibold px-2 py-0.5 rounded border transition-all shrink-0 cursor-pointer"
          :class="
            !selectedTag
              ? 'bg-theme-primary/15 border-theme-accent text-theme-accent font-bold shadow-sm'
              : 'bg-theme-card border-theme-border/60 text-theme-text-muted hover:text-theme-text-main'
          "
        >
          {{ t('tagsAll') }}
        </button>
        <button
          v-for="tag in allTags"
          :key="tag"
          @click="selectedTag = tag === selectedTag ? null : tag"
          class="text-[10px] font-semibold px-2 py-0.5 rounded border transition-all shrink-0 cursor-pointer"
          :class="
            tag === selectedTag
              ? 'bg-theme-primary/15 border-theme-accent text-theme-accent font-bold shadow-sm'
              : 'bg-theme-card border-theme-border/60 text-theme-text-muted hover:text-theme-text-main'
          "
        >
          {{ tag }}
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
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
          </div>
          <h3 class="font-bold text-theme-text-main text-sm">{{ t('emptyStateTitle') }}</h3>
          <p class="text-theme-text-muted text-xs max-w-sm mt-0.5">
            {{ t('emptyStateText') }}
          </p>
          <button
            @click="openCreateModal(buckets[0]?.name || 'todo')"
            class="mt-4 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow transition-all cursor-pointer"
          >
            {{ t('createFirstTaskButton') }}
          </button>
        </div>

        <!-- Board View Columns (Horizontal Scrolling Flex) -->
        <BoardView
          v-if="viewMode === 'board'"
          :buckets="buckets"
          :tasks-by-bucket="tasksByBucket"
          @task-click="openDetailModal"
          @add-task-click="openCreateModal"
          @card-dropped="handleCardDropped"
          @rename-column="handleRenameColumn"
          @delete-column="handleDeleteColumn"
          @move-column="handleMoveColumn"
          @create-column="handleCreateColumn"
        />

        <!-- List View Mode (Data dense Table View) -->
        <ListView v-else-if="viewMode === 'list'" :buckets="buckets" :tasks-by-bucket="tasksByBucket" @task-click="openDetailModal" />
      </div>

      <!-- Task Detail Modal -->
      <TaskDetailModal
        :is-open="isDetailOpen"
        :project-id="activeProjectId"
        :task-id="selectedTaskId"
        :buckets="buckets"
        @close="isDetailOpen = false"
        @updated="fetchAllTasks"
        @deleted="fetchAllTasks"
      />

      <!-- Task Create Modal -->
      <TaskCreateModal
        :is-open="isCreateOpen"
        :project-id="activeProjectId"
        :default-bucket="createDefaultBucket"
        :buckets="buckets"
        @close="isCreateOpen = false"
        @created="fetchAllTasks"
      />
    </div>
  </div>
</template>
