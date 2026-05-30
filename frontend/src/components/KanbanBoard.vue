<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Task, Bucket, BucketName } from '../types';
import { getTasks, moveTask, syncSystem } from '../api';
import KanbanColumn from './KanbanColumn.vue';
import TaskDetailModal from './TaskDetailModal.vue';
import TaskCreateModal from './TaskCreateModal.vue';

const tasks = ref<Task[]>([]);
const loading = ref(false);
const syncLoading = ref(false);
const error = ref<string | null>(null);

// Filter state
const searchQuery = ref('');
const selectedTag = ref<string | null>(null);

// Modal state
const isDetailOpen = ref(false);
const selectedTaskId = ref<number | null>(null);
const isCreateOpen = ref(false);
const createDefaultBucket = ref<BucketName>('todo');

const buckets: Bucket[] = [
  { name: 'backlog', title: 'Backlog' },
  { name: 'todo', title: 'To Do' },
  { name: 'in-progress', title: 'In Progress' },
  { name: 'done', title: 'Done' },
];

const fetchAllTasks = async () => {
  loading.value = true;
  error.value = null;
  try {
    tasks.value = await getTasks();
  } catch (err: any) {
    error.value = err.message || 'Failed to fetch tasks';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAllTasks();
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
  const groups: Record<BucketName, Task[]> = {
    backlog: [],
    todo: [],
    'in-progress': [],
    done: [],
  };

  filteredTasks.value.forEach((task) => {
    const b = task.bucket as BucketName;
    if (groups[b]) {
      groups[b].push(task);
    }
  });

  // Sort each bucket by position ascending
  Object.keys(groups).forEach((key) => {
    groups[key as BucketName].sort((a, b) => a.position - b.position);
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
  const targetBucketTasks = tasks.value
    .filter((t) => t.bucket === toBucket)
    .sort((a, b) => a.position - b.position);

  // Exclude the dragged task itself (for intra-column reordering)
  const otherTasks = targetBucketTasks.filter((t) => t.id !== taskId);

  // Calculate new position
  let newPosition = 1000.0;
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
    } catch (err) {
      // Revert if API call fails
      movedTask.bucket = originalBucket;
      movedTask.position = originalPosition;
      error.value = 'Failed to persist card movement. Reverted change.';
    }
  }
};

const triggerSync = async () => {
  syncLoading.value = true;
  error.value = null;
  try {
    const result = await syncSystem();
    alert(`Index synchronized successfully! Loaded ${result.synchronized_tasks} tasks from markdown files.`);
    await fetchAllTasks();
  } catch (err: any) {
    error.value = err.message || 'Failed to sync index';
  } finally {
    syncLoading.value = false;
  }
};
</script>

<template>
  <div class="flex-grow flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
    <!-- Header Controls -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <h1 class="text-3xl font-black tracking-tight text-white bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          Local-First Markdown Kanban
        </h1>
        <p class="text-slate-400 text-sm mt-1">
          Single Source of Truth: Plain Markdown Files. SQLite Ephemeral Index.
        </p>
      </div>

      <!-- Toolbar Actions -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- Search -->
        <div class="relative min-w-[200px]">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search tasks..."
            class="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <!-- Sync Button -->
        <button
          @click="triggerSync"
          class="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all shadow-sm"
          :disabled="syncLoading"
          title="Rebuild database index from Markdown files"
        >
          <svg
            class="w-4 h-4"
            :class="{ 'animate-spin': syncLoading }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2"
            />
          </svg>
          {{ syncLoading ? 'Syncing...' : 'Sync Index' }}
        </button>

        <!-- New Task Button -->
        <button
          @click="openCreateModal('todo')"
          class="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md hover:shadow-violet-500/10 transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>
      </div>
    </header>

    <!-- Error Banner -->
    <div
      v-if="error"
      class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex justify-between items-center"
    >
      <span>{{ error }}</span>
      <button @click="error = null" class="hover:text-white">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Horizontal Tag Filter List -->
    <div v-if="allTags.length" class="flex items-center gap-2 overflow-x-auto pb-2 shrink-0">
      <span class="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Tags:</span>
      <button
        @click="selectedTag = null"
        class="text-xs font-semibold px-3 py-1 rounded-full border transition-all shrink-0"
        :class="
          !selectedTag
            ? 'bg-violet-500/15 border-violet-500 text-violet-400 font-bold shadow-sm'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        "
      >
        All
      </button>
      <button
        v-for="tag in allTags"
        :key="tag"
        @click="selectedTag = tag === selectedTag ? null : tag"
        class="text-xs font-semibold px-3 py-1 rounded-full border transition-all shrink-0"
        :class="
          tag === selectedTag
            ? 'bg-violet-500/15 border-violet-500 text-violet-400 font-bold shadow-sm'
            : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white'
        "
      >
        {{ tag }}
      </button>
    </div>

    <!-- Loading Board state -->
    <div v-if="loading && !tasks.length" class="flex-grow flex flex-col items-center justify-center py-20 gap-3">
      <div class="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-slate-400">Loading Kanban Board...</span>
    </div>

    <!-- Empty Board state -->
    <div
      v-else-if="!tasks.length"
      class="flex-grow flex flex-col items-center justify-center text-center py-20 bg-slate-850/20 border border-dashed border-slate-800 rounded-3xl p-8"
    >
      <div class="p-4 bg-slate-800/50 rounded-full border border-slate-700 mb-4 text-violet-400">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      </div>
      <h3 class="font-bold text-slate-200 text-lg">No tasks found</h3>
      <p class="text-slate-400 text-sm max-w-sm mt-1">
        Get started by creating a new task, or sync the index if you already have Markdown files in the `tasks` folder.
      </p>
      <button
        @click="openCreateModal('todo')"
        class="mt-5 text-xs font-semibold px-4.5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md transition-all"
      >
        Create First Task
      </button>
    </div>

    <!-- Board Grid -->
    <div v-else class="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start overflow-x-auto pb-4">
      <KanbanColumn
        v-for="b in buckets"
        :key="b.name"
        :bucket-name="b.name"
        :title="b.title"
        :tasks="tasksByBucket[b.name] || []"
        @task-click="openDetailModal"
        @add-task-click="openCreateModal"
        @card-dropped="handleCardDropped"
      />
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
