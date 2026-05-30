<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Task, Bucket, BucketName } from '../types';
import { getTasks, moveTask, syncSystem, getBuckets, createBucket, updateBucket, deleteBucket } from '../api';
import KanbanColumn from './KanbanColumn.vue';
import TaskDetailModal from './TaskDetailModal.vue';
import TaskCreateModal from './TaskCreateModal.vue';
import { useI18n } from '../composables/useI18n';

const { locale, t } = useI18n();

const tasks = ref<Task[]>([]);
const buckets = ref<Bucket[]>([]);
const loading = ref(false);
const syncLoading = ref(false);
const error = ref<string | null>(null);

// Column create state
const isAddingColumn = ref(false);
const newColumnTitle = ref('');

// Filter state
const searchQuery = ref('');
const selectedTag = ref<string | null>(null);

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

const fetchBuckets = async () => {
  try {
    buckets.value = await getBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch columns';
  }
};

const fetchAllTasks = async () => {
  try {
    tasks.value = await getTasks();
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

onMounted(() => {
  fetchAllData();
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

// Filter tasks based on Search query & selected tag
const filteredTasks = computed(() => {
  return tasks.value.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.value.toLowerCase());
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
      await moveTask(taskId, toBucket, newPosition);
    } catch {
      // Revert if API call fails
      movedTask.bucket = originalBucket;
      movedTask.position = originalPosition;
      error.value = t('errors.moveTask');
    }
  }
};

const handleAddColumn = async () => {
  const title = newColumnTitle.value.trim();
  if (!title) return;
  try {
    await createBucket(title);
    newColumnTitle.value = '';
    isAddingColumn.value = false;
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to create column';
  }
};

const handleRenameColumn = async ({ bucketName, newTitle }: { bucketName: string; newTitle: string }) => {
  if (!newTitle.trim()) return;
  try {
    await updateBucket(bucketName, { title: newTitle.trim() });
    await fetchBuckets();
  } catch (err: any) {
    error.value = err.message || 'Failed to rename column';
  }
};

const handleDeleteColumn = async (bucketName: string) => {
  try {
    await deleteBucket(bucketName);
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
      updateBucket(currentCol.name, { position: currentCol.position }),
      updateBucket(targetCol.name, { position: targetCol.position }),
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
    await fetchAllData();
  } catch (err: any) {
    error.value = t('sync.error', { message: err.message || err });
  } finally {
    syncLoading.value = false;
  }
};
</script>

<template>
  <div class="flex-grow flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
    <!-- Header Controls -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-6">
      <div>
        <h1 class="text-3xl font-black tracking-tight bg-gradient-to-r from-theme-grad-from to-theme-grad-to bg-clip-text text-transparent">
          {{ t('brand.title') }}
        </h1>
        <p class="text-theme-text-muted text-sm mt-1">{{ t('brand.subtitle') }}</p>
      </div>

      <!-- Toolbar Actions -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Search -->
        <div class="relative min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('searchPlaceholder')"
            class="w-full bg-theme-card/80 border border-theme-border/60 rounded-xl px-4 py-2 text-sm text-theme-text-input placeholder-theme-text-muted/60 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
          />
        </div>

        <!-- Theme Selector Dropdown -->
        <div class="relative">
          <!-- Overlay to close dropdown -->
          <div v-if="isThemeDropdownOpen" class="fixed inset-0 z-10" @click="isThemeDropdownOpen = false"></div>

          <button
            @click="isThemeDropdownOpen = !isThemeDropdownOpen"
            class="relative z-20 flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-theme-card hover:bg-theme-column/85 text-theme-text-card border border-theme-border rounded-xl transition-all shadow-sm cursor-pointer"
            :title="t('themeChoose')"
          >
            <span class="w-3.5 h-3.5 rounded-full" :class="themes.find((t) => t.id === currentTheme)?.color"></span>
            {{ t('themeLabel') }}
            <svg class="w-3.5 h-3.5 text-theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isThemeDropdownOpen"
            class="absolute right-0 mt-2 w-48 bg-theme-card border border-theme-border rounded-xl shadow-xl z-20 p-1.5 space-y-1"
          >
            <button
              v-for="th in themes"
              :key="th.id"
              @click="setTheme(th.id)"
              class="w-full flex items-center gap-3 px-3 py-2 text-xs text-theme-text-card hover:bg-theme-column hover:text-theme-text-main rounded-lg transition-colors text-left font-medium cursor-pointer"
              :class="{ 'bg-theme-column/50 border border-theme-border/30': currentTheme === th.id }"
            >
              <span class="w-3 h-3 rounded-full shrink-0" :class="th.color"></span>
              {{ t('themeNames.' + th.id) }}
            </button>
          </div>
        </div>

        <!-- Language Selector Dropdown -->
        <div class="relative">
          <!-- Overlay to close dropdown -->
          <div v-if="isLanguageDropdownOpen" class="fixed inset-0 z-10" @click="isLanguageDropdownOpen = false"></div>

          <button
            @click="isLanguageDropdownOpen = !isLanguageDropdownOpen"
            class="relative z-20 flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-theme-card hover:bg-theme-column/85 text-theme-text-card border border-theme-border rounded-xl transition-all shadow-sm cursor-pointer"
            :title="t('language.choose')"
          >
            <span class="text-sm shrink-0">🌐</span>
            {{ t('language.' + locale) }}
            <svg class="w-3.5 h-3.5 text-theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isLanguageDropdownOpen"
            class="absolute right-0 mt-2 w-36 bg-theme-card border border-theme-border rounded-xl shadow-xl z-20 p-1.5 space-y-1"
          >
            <button
              @click="
                locale = 'en';
                isLanguageDropdownOpen = false;
              "
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-card hover:bg-theme-column hover:text-theme-text-main rounded-lg transition-colors text-left font-medium cursor-pointer"
              :class="{ 'bg-theme-column/50 border border-theme-border/30': locale === 'en' }"
            >
              English
            </button>
            <button
              @click="
                locale = 'de';
                isLanguageDropdownOpen = false;
              "
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text-card hover:bg-theme-column hover:text-theme-text-main rounded-lg transition-colors text-left font-medium cursor-pointer"
              :class="{ 'bg-theme-column/50 border border-theme-border/30': locale === 'de' }"
            >
              Deutsch
            </button>
          </div>
        </div>

        <!-- Sync Button -->
        <button
          @click="triggerSync"
          class="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-theme-card hover:bg-theme-column/80 text-theme-text-card border border-theme-border rounded-xl transition-all shadow-sm cursor-pointer"
          :disabled="syncLoading"
          :title="t('sync.tooltip')"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': syncLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
          </svg>
          {{ syncLoading ? t('sync.syncing') : t('sync.button') }}
        </button>

        <!-- New Task Button -->
        <button
          @click="openCreateModal(buckets[0]?.name || 'todo')"
          class="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-xl shadow-md hover:shadow-theme-ring/20 transition-all cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ t('addTaskButton') }}
        </button>
      </div>
    </header>

    <!-- Error Banner -->
    <div v-if="error" class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex justify-between items-center">
      <span>{{ error }}</span>
      <button @click="error = null" class="hover:text-white">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Horizontal Tag Filter List -->
    <div v-if="allTags.length" class="flex items-center gap-2 overflow-x-auto pb-2 shrink-0">
      <span class="text-xs font-bold text-theme-text-muted uppercase tracking-wider shrink-0">{{ t('tagsLabel') }}</span>
      <button
        @click="selectedTag = null"
        class="text-xs font-semibold px-3 py-1 rounded-full border transition-all shrink-0 cursor-pointer"
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
        class="text-xs font-semibold px-3 py-1 rounded-full border transition-all shrink-0 cursor-pointer"
        :class="
          tag === selectedTag
            ? 'bg-theme-primary/15 border-theme-accent text-theme-accent font-bold shadow-sm'
            : 'bg-theme-card border-theme-border/60 text-theme-text-muted hover:text-theme-text-main'
        "
      >
        {{ tag }}
      </button>
    </div>

    <!-- Loading Board state -->
    <div v-if="loading && !tasks.length" class="flex-grow flex flex-col items-center justify-center py-20 gap-3">
      <div class="w-12 h-12 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
      <span class="text-theme-text-muted">{{ t('loadingBoard') }}</span>
    </div>

    <!-- Empty Board state -->
    <div
      v-else-if="!tasks.length"
      class="flex-grow flex flex-col items-center justify-center text-center py-20 bg-theme-column/10 border border-dashed border-theme-border rounded-3xl p-8"
    >
      <div class="p-4 bg-theme-card/50 rounded-full border border-theme-border mb-4 text-theme-accent">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      </div>
      <h3 class="font-bold text-theme-text-main text-lg">{{ t('emptyStateTitle') }}</h3>
      <p class="text-theme-text-muted text-sm max-w-sm mt-1">
        {{ t('emptyStateText') }}
      </p>
      <button
        @click="openCreateModal(buckets[0]?.name || 'todo')"
        class="mt-5 text-xs font-semibold px-4.5 py-2.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-xl shadow-md transition-all cursor-pointer"
      >
        {{ t('createFirstTaskButton') }}
      </button>
    </div>

    <!-- Board Columns (Horizontal Scrolling Flex) -->
    <div v-else class="flex-grow flex gap-6 items-start overflow-x-auto pb-4 w-full select-none">
      <KanbanColumn
        v-for="(b, idx) in buckets"
        :key="b.name"
        :bucket-name="b.name"
        :title="b.title"
        :tasks="tasksByBucket[b.name] || []"
        :is-first="idx === 0"
        :is-last="idx === buckets.length - 1"
        @task-click="openDetailModal"
        @add-task-click="openCreateModal"
        @card-dropped="handleCardDropped"
        @rename-column="handleRenameColumn"
        @delete-column="handleDeleteColumn"
        @move-column="handleMoveColumn"
      />

      <!-- Add Column Card -->
      <div
        class="flex flex-col bg-theme-column/20 border border-dashed border-theme-border/60 rounded-2xl w-72 shrink-0 p-4 transition-all"
      >
        <div v-if="!isAddingColumn" class="flex items-center justify-center h-28">
          <button
            @click="isAddingColumn = true"
            class="flex flex-col items-center gap-2 text-theme-text-muted hover:text-theme-text-main font-semibold text-xs cursor-pointer w-full py-6 rounded-xl hover:bg-theme-card/30 transition-all"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ t('buttons.addColumn') }}
          </button>
        </div>
        <div v-else class="space-y-3">
          <h4 class="font-bold text-xs uppercase tracking-wider text-theme-text-muted">{{ t('newColumnTitle') }}</h4>
          <input
            v-model="newColumnTitle"
            type="text"
            :placeholder="t('columnTitlePlaceholder')"
            class="w-full bg-theme-card border border-theme-border/60 rounded-xl px-3 py-2 text-xs text-theme-text-input placeholder-theme-text-muted/60 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
            @keyup.enter="handleAddColumn"
            @keyup.esc="isAddingColumn = false"
            autofocus
          />
          <div class="flex gap-2 justify-end">
            <button
              @click="isAddingColumn = false"
              class="text-[10px] font-semibold px-2.5 py-1.5 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded-lg cursor-pointer"
            >
              {{ t('buttons.cancel') }}
            </button>
            <button
              @click="handleAddColumn"
              class="text-[10px] font-semibold px-2.5 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg cursor-pointer"
            >
              {{ t('buttons.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Detail Modal -->
    <TaskDetailModal
      :is-open="isDetailOpen"
      :task-id="selectedTaskId"
      :buckets="buckets"
      @close="isDetailOpen = false"
      @updated="fetchAllTasks"
      @deleted="fetchAllTasks"
    />

    <!-- Task Create Modal -->
    <TaskCreateModal
      :is-open="isCreateOpen"
      :default-bucket="createDefaultBucket"
      :buckets="buckets"
      @close="isCreateOpen = false"
      @created="fetchAllTasks"
    />
  </div>
</template>
