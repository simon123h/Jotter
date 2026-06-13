<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  Tag,
  CheckCircle,
  Check,
  Keyboard,
  X,
  FolderInput,
  Flame,
  Clock,
  CheckSquare,
  Sparkle,
} from '@lucide/vue';
import type { Task, Bucket } from '@/types';
import { updateTask, deleteTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import TagInput from '@/components/ui/TagInput.vue';

const props = defineProps<{
  tasks: Task[];
  buckets: Bucket[];
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const { t } = useI18n();

// Local triage states
const currentTaskIndex = ref(0);
const triageSortOrder = ref<'created-asc' | 'created-desc' | 'priority' | 'due'>('created-asc');
const showHelp = ref(true);
const showBucketPicker = ref(false);

// Inline editing states
const isEditingTitle = ref(false);
const isEditingDescription = ref(false);
const editTitleText = ref('');
const editDescriptionText = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null);

// Tag adding state
const showTagInput = ref(false);
const newTagText = ref('');
const tagInputRef = ref<InstanceType<typeof TagInput> | null>(null);

// Session stats tracking
const editedCount = ref(0);
const completedCount = ref(0);
const deletedCount = ref(0);
const lastDeletedTask = ref<Task | null>(null);
const isCongratsState = ref(false);

// Highlight card colors configuration
const colorsList = [
  { id: null, bg: 'bg-theme-column border-theme-border/40', ring: 'ring-theme-border' },
  { id: 'red', bg: 'bg-rose-500/20 border-rose-500/30', ring: 'ring-rose-500' },
  { id: 'orange', bg: 'bg-amber-600/20 border-amber-600/30', ring: 'ring-amber-600' },
  { id: 'yellow', bg: 'bg-yellow-500/20 border-yellow-500/30', ring: 'ring-yellow-500' },
  { id: 'green', bg: 'bg-emerald-500/20 border-emerald-500/30', ring: 'ring-emerald-500' },
  { id: 'blue', bg: 'bg-blue-500/20 border-blue-500/30', ring: 'ring-blue-500' },
  { id: 'purple', bg: 'bg-purple-500/20 border-purple-500/30', ring: 'ring-purple-500' },
  { id: 'pink', bg: 'bg-pink-500/20 border-pink-500/30', ring: 'ring-pink-500' },
];

const priorityList = [
  { id: 'none', label: 'priorityOptions.none', color: 'text-theme-text-muted', bg: 'bg-theme-column/30' },
  { id: 'low', label: 'priorityOptions.low', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'medium', label: 'priorityOptions.medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'high', label: 'priorityOptions.high', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  {
    id: 'urgent',
    label: 'priorityOptions.urgent',
    color: 'text-rose-400 font-bold',
    bg: 'bg-rose-500/10 border-rose-500/20 animate-pulse',
  },
];

// Computed list of tasks in the active sorting order
const sortedTasks = computed(() => {
  const list = [...props.tasks];
  if (triageSortOrder.value === 'created-asc') {
    return list.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  } else if (triageSortOrder.value === 'created-desc') {
    return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } else if (triageSortOrder.value === 'priority') {
    const priorityWeights: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };
    return list.sort((a, b) => {
      const wa = priorityWeights[a.priority || 'none'] || 0;
      const wb = priorityWeights[b.priority || 'none'] || 0;
      return wb - wa;
    });
  } else if (triageSortOrder.value === 'due') {
    return list.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }
  return list;
});

// The current triaged task
const currentTask = computed<Task | null>(() => {
  if (sortedTasks.value.length === 0 || currentTaskIndex.value < 0) return null;
  if (currentTaskIndex.value >= sortedTasks.value.length) {
    return null;
  }
  return sortedTasks.value[currentTaskIndex.value];
});

// Sync index safety bounds
watch(sortedTasks, (newTasks) => {
  if (newTasks.length === 0) {
    currentTaskIndex.value = 0;
  } else if (currentTaskIndex.value >= newTasks.length) {
    currentTaskIndex.value = Math.max(0, newTasks.length - 1);
  }
});

// Watch currentTask change to reset edit inputs
watch(
  currentTask,
  (newTask) => {
    if (newTask) {
      editTitleText.value = newTask.title;
      editDescriptionText.value = newTask.body || '';
      isEditingTitle.value = false;
      isEditingDescription.value = false;
      showTagInput.value = false;
      newTagText.value = '';
    }
  },
  { immediate: true }
);

// Bucket title translation fallback
const bucketTitle = (bucketName: string, fallback: string) => {
  const trans = t('buckets.' + bucketName);
  return trans !== 'buckets.' + bucketName ? trans : fallback;
};

// Markdown compiler for task description
const compiledDescription = computed(() => {
  if (!currentTask.value || !currentTask.value.body) return '';
  return marked.parse(currentTask.value.body);
});

// General mutations
const patchCurrentTask = async (payload: Partial<Task>) => {
  if (!currentTask.value) return;
  try {
    await updateTask(currentTask.value.project_id, currentTask.value.id, payload);
    editedCount.value++;
    emit('refresh');
  } catch (err) {
    console.error('Triage save failed', err);
  }
};

// Keyboard Actions & Navs
const next = () => {
  if (sortedTasks.value.length === 0) return;
  if (currentTaskIndex.value < sortedTasks.value.length - 1) {
    currentTaskIndex.value++;
  } else {
    // Reached the end of queue
    isCongratsState.value = true;
  }
};

const prev = () => {
  if (currentTaskIndex.value > 0) {
    currentTaskIndex.value--;
  }
};

const handlePriorityKey = (level: string) => {
  patchCurrentTask({ priority: level });
};

const handlePlannedKey = (planned: string) => {
  patchCurrentTask({ planned_date: planned });
};

const cycleColor = () => {
  if (!currentTask.value) return;
  const curColor = currentTask.value.color;
  const idx = colorsList.findIndex((c) => c.id === curColor);
  const nextIdx = (idx + 1) % colorsList.length;
  patchCurrentTask({ color: colorsList[nextIdx].id });
};

const markTaskDone = async () => {
  if (!currentTask.value) return;
  const taskToComplete = currentTask.value;
  await updateTask(taskToComplete.project_id, taskToComplete.id, { bucket: 'done' });
  completedCount.value++;
  emit('refresh');
  next();
};

const removeCurrentTask = async () => {
  if (!currentTask.value) return;
  const taskToDelete = currentTask.value;
  if (confirm(t('buttons.deleteTask') + '?')) {
    try {
      lastDeletedTask.value = { ...taskToDelete };
      await deleteTask(taskToDelete.project_id, taskToDelete.id);
      deletedCount.value++;
      emit('refresh');
      // No index increment since task was removed from sortedTasks list
    } catch (err) {
      console.error(err);
    }
  }
};

// Title edit save
const saveTitle = () => {
  const trimmed = editTitleText.value.trim();
  if (trimmed && currentTask.value && trimmed !== currentTask.value.title) {
    patchCurrentTask({ title: trimmed });
  }
  isEditingTitle.value = false;
};

// Description edit save
const saveDescription = () => {
  if (currentTask.value && editDescriptionText.value !== currentTask.value.body) {
    patchCurrentTask({ body: editDescriptionText.value });
  }
  isEditingDescription.value = false;
};

// Start edits
const startEditTitle = () => {
  isEditingTitle.value = true;
  setTimeout(() => titleInputRef.value?.focus(), 50);
};

const startEditDescription = () => {
  isEditingDescription.value = true;
  setTimeout(() => descriptionInputRef.value?.focus(), 50);
};

// Tag management
const startAddTag = () => {
  showTagInput.value = true;
  setTimeout(() => tagInputRef.value?.focus(), 50);
};

const saveTag = () => {
  const input = newTagText.value.trim();
  if (input && currentTask.value) {
    const existing = currentTask.value.tags || [];
    const newTags = input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && !existing.includes(t));
    if (newTags.length > 0) {
      patchCurrentTask({ tags: [...existing, ...newTags] });
    }
  }
  newTagText.value = '';
  showTagInput.value = false;
};

const removeTag = (tag: string) => {
  if (!currentTask.value) return;
  const existing = currentTask.value.tags || [];
  patchCurrentTask({ tags: existing.filter((t) => t !== tag) });
};

// Move to Bucket (Column) Popup
const triggerBucketPicker = () => {
  showBucketPicker.value = true;
};

const moveToBucket = async (bucketName: string) => {
  if (!currentTask.value) return;
  await patchCurrentTask({ bucket: bucketName });
  showBucketPicker.value = false;
  next();
};

const resetStats = () => {
  editedCount.value = 0;
  completedCount.value = 0;
  deletedCount.value = 0;
  isCongratsState.value = false;
  currentTaskIndex.value = 0;
};

// Global Hotkeys Registration inside triage mode
useKeyboardShortcuts([
  { key: 'j', callback: () => !showBucketPicker.value && next() },
  { key: 'ArrowRight', callback: () => !showBucketPicker.value && next() },
  { key: 'k', callback: () => !showBucketPicker.value && prev() },
  { key: 'ArrowLeft', callback: () => !showBucketPicker.value && prev() },
  {
    key: 'h',
    callback: () => {
      showHelp.value = !showHelp.value;
    },
  },
  { key: '1', callback: () => handlePriorityKey('urgent') },
  { key: '2', callback: () => handlePriorityKey('high') },
  { key: '3', callback: () => handlePriorityKey('medium') },
  { key: '4', callback: () => handlePriorityKey('low') },
  { key: '0', callback: () => handlePriorityKey('none') },
  { key: 't', callback: () => handlePlannedKey('today') },
  { key: 'o', callback: () => handlePlannedKey('tomorrow') },
  { key: 'w', callback: () => handlePlannedKey('thisWeek') },
  { key: 's', callback: () => handlePlannedKey('sometime') },
  { key: 'u', callback: () => handlePlannedKey('') },
  { key: 'c', callback: () => cycleColor() },
  { key: 'v', callback: () => markTaskDone() },
  { key: 'd', callback: () => removeCurrentTask() },
  { key: 'Backspace', callback: () => removeCurrentTask() },
  {
    key: 'm',
    callback: () => {
      showBucketPicker.value = true;
    },
  },
  { key: 'a', callback: () => startAddTag() },
  { key: 'Enter', callback: () => !isEditingTitle.value && !isEditingDescription.value && startEditTitle() },
]);

// Inner hotkey handles for bucket picker popup (1-9 numeric triggers)
const handleBucketPickerKeyDown = (event: KeyboardEvent) => {
  if (!showBucketPicker.value) return;
  const num = parseInt(event.key, 10);
  if (num >= 1 && num <= props.buckets.length) {
    event.preventDefault();
    const targetBucket = props.buckets[num - 1];
    if (targetBucket) {
      moveToBucket(targetBucket.name);
    }
  } else if (event.key === 'Escape') {
    showBucketPicker.value = false;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleBucketPickerKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleBucketPickerKeyDown);
});
</script>

<template>
  <div class="h-full flex gap-3 relative select-none animate-fade-in">
    <!-- Main Left/Center Triage Area -->
    <div class="flex-grow flex flex-col h-full overflow-hidden">
      <!-- Triage Top Bar Control Panel -->
      <div
        class="flex items-center justify-between px-4 py-3 bg-theme-card/40 border border-theme-border/50 rounded-xl mb-3 shrink-0 backdrop-blur-md"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-theme-accent">
            <Sparkles class="w-4 h-4 text-theme-accent animate-bounce" />
            {{ t('triage.title') }}
          </div>
          <span
            v-if="sortedTasks.length > 0 && !isCongratsState"
            class="text-xs font-semibold px-2 py-0.5 rounded-full bg-theme-column text-theme-text-muted"
          >
            {{ currentTaskIndex + 1 }} / {{ sortedTasks.length }}
          </span>
        </div>

        <!-- Sorting & Toggle guide panel -->
        <div class="flex items-center gap-2">
          <!-- Sorting Selection Badge -->
          <div class="flex items-center gap-1 bg-theme-column/40 border border-theme-border/40 rounded-lg px-2 py-1 text-xs">
            <span class="text-theme-text-muted pr-1">{{ t('projects.sortLabel') || 'Sort:' }}</span>
            <select
              v-model="triageSortOrder"
              class="bg-transparent border-none text-theme-text-main font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="created-asc" class="bg-theme-card text-theme-text-main">{{ t('triage.sortCreatedAsc') }}</option>
              <option value="created-desc" class="bg-theme-card text-theme-text-main">{{ t('triage.sortCreatedDesc') }}</option>
              <option value="priority" class="bg-theme-card text-theme-text-main">{{ t('triage.sortPriority') }}</option>
              <option value="due" class="bg-theme-card text-theme-text-main">{{ t('triage.sortDue') }}</option>
            </select>
          </div>

          <!-- Shortcuts Toggle Button -->
          <button
            @click="showHelp = !showHelp"
            class="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-theme-border/50 bg-theme-column/20 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main transition-all cursor-pointer"
          >
            <Keyboard class="w-3.5 h-3.5 shrink-0" />
            <span class="hidden md:inline">{{ showHelp ? t('buttons.close') : t('triage.shortcutsTitle') }}</span>
          </button>
        </div>
      </div>

      <!-- Centered Triage Workspace Core -->
      <div class="flex-grow flex items-center justify-center overflow-y-auto min-h-0 relative px-4">
        <!-- 1. EMPTY / COMPLETED CONGRATULATIONS STATE -->
        <div
          v-if="sortedTasks.length === 0 || isCongratsState"
          class="max-w-md w-full bg-theme-card border border-theme-border/60 rounded-2xl p-8 shadow-2xl text-center flex flex-col items-center gap-4 animate-scale-in"
        >
          <div class="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckSquare class="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <h2 class="text-lg font-bold text-theme-text-main">
            {{ isCongratsState ? t('triage.congratsTitle') : t('triage.noTasks') }}
          </h2>
          <p class="text-xs text-theme-text-muted leading-relaxed max-w-sm">
            {{ isCongratsState ? t('triage.congratsDesc') : t('emptyStateText') }}
          </p>

          <!-- Session Stats Summary -->
          <div
            v-if="isCongratsState"
            class="w-full bg-theme-column/30 border border-theme-border/30 rounded-xl p-4 mt-2 text-left space-y-2.5"
          >
            <div
              class="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted pb-1.5 border-b border-theme-border/40 flex items-center gap-1.5"
            >
              <Sparkle class="w-3.5 h-3.5 text-theme-accent" />
              {{ t('triage.statsSession') }}
            </div>
            <div class="grid grid-cols-3 gap-2.5 text-center">
              <div class="bg-theme-card/60 p-2.5 rounded border border-theme-border/40">
                <div class="text-base font-extrabold text-theme-accent">{{ editedCount }}</div>
                <div class="text-[10px] text-theme-text-muted mt-0.5">{{ t('triage.edited') }}</div>
              </div>
              <div class="bg-theme-card/60 p-2.5 rounded border border-theme-border/40">
                <div class="text-base font-extrabold text-emerald-400">{{ completedCount }}</div>
                <div class="text-[10px] text-theme-text-muted mt-0.5">{{ t('triage.completed') }}</div>
              </div>
              <div class="bg-theme-card/60 p-2.5 rounded border border-theme-border/40">
                <div class="text-base font-extrabold text-rose-400">{{ deletedCount }}</div>
                <div class="text-[10px] text-theme-text-muted mt-0.5">{{ t('triage.deleted') }}</div>
              </div>
            </div>
          </div>

          <button
            @click="resetStats"
            class="px-4 py-2 mt-4 bg-theme-primary hover:bg-theme-primary-hover text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            {{ t('triage.restartSession') }}
          </button>
        </div>

        <!-- 2. HIGH-FIDELITY ACTIVE TRIAGE CARD PANEL -->
        <div
          v-else-if="currentTask"
          class="max-w-2xl w-full flex flex-col h-[520px] rounded-2xl border bg-theme-card shadow-2xl transition-all duration-300 relative overflow-hidden animate-scale-in"
          :class="[
            colorsList.find((c) => c.id === currentTask?.color)?.bg || colorsList[0].bg,
            colorsList.find((c) => c.id === currentTask?.color)?.id ? 'border-l-[6px]' : 'border-theme-border/60',
          ]"
        >
          <!-- Task Header Metadata Bar -->
          <div class="px-6 py-4 flex items-center justify-between border-b border-theme-border/40 bg-theme-column/10 shrink-0">
            <!-- Priority Badge -->
            <div class="flex items-center gap-1.5">
              <span
                v-for="p in [priorityList.find((item) => item.id === currentTask?.priority) || priorityList[0]]"
                :key="p.id"
                class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 shadow-sm"
                :class="[p.color, p.bg]"
              >
                <Flame v-if="p.id === 'urgent' || p.id === 'high'" class="w-3 h-3 text-orange-400" />
                {{ t(p.label) }}
              </span>

              <!-- Column / Bucket Indicator -->
              <span
                class="px-2.5 py-1 rounded-full bg-theme-column border border-theme-border/40 text-theme-text-muted text-[10px] font-bold uppercase tracking-wider"
              >
                {{ bucketTitle(currentTask.bucket, currentTask.bucket) }}
              </span>
            </div>

            <!-- Planned Date Badge Indicator -->
            <div class="flex items-center gap-2">
              <span
                v-if="currentTask.planned_date"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-theme-accent/10 border border-theme-accent/20 text-theme-accent shadow-sm animate-pulse-slow"
              >
                <Clock class="w-3 h-3 text-theme-accent" />
                {{ t('plannedDateOptions.' + currentTask.planned_date) }}
              </span>
              <span
                v-if="currentTask.due_date"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400"
              >
                <Calendar class="w-3 h-3 text-red-400" />
                Due: {{ currentTask.due_date }}
              </span>
            </div>
          </div>

          <!-- Central Editable Area -->
          <div class="flex-grow flex flex-col p-6 overflow-y-auto scroller-thin min-h-0">
            <!-- Editable Title -->
            <div class="mb-4">
              <div v-if="isEditingTitle" class="flex items-stretch gap-2">
                <input
                  v-model="editTitleText"
                  ref="titleInputRef"
                  type="text"
                  @blur="saveTitle"
                  @keydown.enter="saveTitle"
                  @keydown.esc="isEditingTitle = false"
                  class="flex-grow bg-theme-base border border-theme-border rounded-lg px-3 py-1.5 text-sm font-bold text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary"
                />
                <button @click="saveTitle" class="px-3 bg-theme-primary text-white rounded-lg text-xs font-bold cursor-pointer">
                  <Check class="w-4 h-4" />
                </button>
              </div>
              <h1
                v-else
                @click="startEditTitle"
                class="text-xl font-extrabold text-theme-text-main tracking-tight cursor-pointer hover:underline decoration-dashed decoration-theme-primary/60 underline-offset-4 flex items-center justify-between group transition-all"
                title="Click or press [Enter] to edit"
              >
                <span>{{ currentTask.title }}</span>
                <span
                  class="text-[10px] font-semibold text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity bg-theme-column/60 border border-theme-border/40 rounded px-1.5 py-0.5"
                >
                  {{ t('triage.clickToEdit') }}
                </span>
              </h1>
            </div>

            <!-- Tags Container -->
            <div class="flex flex-wrap items-center gap-1.5 mb-5 shrink-0">
              <Tag class="w-3.5 h-3.5 text-theme-text-muted mr-1 shrink-0" />
              <span
                v-for="tag in currentTask.tags || []"
                :key="tag"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-theme-column/60 border border-theme-border/50 text-xs font-medium text-theme-text-muted"
              >
                #{{ tag }}
                <button
                  @click.stop="removeTag(tag)"
                  class="p-0.5 hover:bg-theme-base rounded text-theme-text-muted hover:text-rose-400 cursor-pointer"
                  title="Remove tag"
                >
                  <X class="w-2.5 h-2.5" />
                </button>
              </span>

              <!-- Inline Quick Tag Add Input -->
              <div v-if="showTagInput" class="flex items-center gap-1 w-44">
                <TagInput
                  v-model="newTagText"
                  ref="tagInputRef"
                  @blur="saveTag"
                  @enter="saveTag"
                  @keydown.esc="showTagInput = false"
                  placeholder="Comma separated tags..."
                  input-class="bg-theme-base border border-theme-border rounded px-2 py-0.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary w-full"
                />
              </div>
              <button
                v-else
                @click="startAddTag"
                class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border border-dashed border-theme-border text-xs text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary/60 transition-colors cursor-pointer"
              >
                + {{ t('triage.addTags') }}
              </button>
            </div>

            <!-- Editable Description (Markdown Body) -->
            <div class="flex-grow flex flex-col min-h-0">
              <label class="text-[10px] font-extrabold uppercase tracking-widest text-theme-text-muted mb-1.5">{{
                t('triage.description')
              }}</label>

              <div v-if="isEditingDescription" class="flex-grow flex flex-col gap-2 min-h-0">
                <textarea
                  v-model="editDescriptionText"
                  ref="descriptionInputRef"
                  @keydown.ctrl.enter="saveDescription"
                  @keydown.esc="isEditingDescription = false"
                  @blur="saveDescription"
                  :placeholder="t('triage.descriptionPlaceholder')"
                  class="flex-grow w-full bg-theme-base border border-theme-border rounded-xl p-3 text-xs text-theme-text-main focus:outline-none focus:ring-1 focus:ring-theme-primary font-mono scroller-thin"
                ></textarea>
                <div class="flex justify-between items-center shrink-0">
                  <span class="text-[10px] text-theme-text-muted font-semibold">{{ t('triage.pressToSave') }}</span>
                  <div class="flex gap-1.5">
                    <button
                      @click="isEditingDescription = false"
                      class="px-2.5 py-1 text-xs font-semibold text-theme-text-muted hover:text-theme-text-main cursor-pointer"
                    >
                      {{ t('buttons.cancel') }}
                    </button>
                    <button
                      @click="saveDescription"
                      class="px-3 py-1 bg-theme-primary hover:bg-theme-primary-hover text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1 shadow-lg"
                    >
                      <Check class="w-3.5 h-3.5" /> {{ t('buttons.save') }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Rendered markdown display -->
              <div
                v-else
                @click="startEditDescription"
                class="flex-grow rounded-xl bg-theme-column/25 border border-theme-border/30 p-4 overflow-y-auto cursor-pointer hover:border-theme-border/70 transition-colors scroller-thin min-h-0 group relative"
                title="Click to edit markdown"
              >
                <div
                  v-if="currentTask.body"
                  class="prose prose-sm dark:prose-invert prose-p:leading-relaxed max-w-none text-xs text-theme-text-muted"
                  v-html="compiledDescription"
                ></div>
                <div v-else class="text-xs text-theme-text-muted/40 font-semibold italic flex items-center gap-1">
                  {{ t('triage.noDescription') }}
                </div>
                <span
                  class="text-[9px] font-bold text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity bg-theme-card border border-theme-border/40 rounded px-1.5 py-0.5 absolute top-2 right-2 shadow-sm"
                >
                  {{ t('triage.editBody') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Floating Queue Actions Bar -->
          <div class="px-6 py-4 border-t border-theme-border/40 bg-theme-column/10 flex items-center justify-between shrink-0">
            <!-- Left Side Actions (Complete, Delete, Move) -->
            <div class="flex items-center gap-1.5">
              <button
                @click="markTaskDone"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-emerald-500/10"
              >
                <CheckCircle class="w-4 h-4 shrink-0" />
                <span>{{ t('buttons.markDone') }}</span>
                <kbd class="hidden md:inline bg-white/25 text-white/95 text-[9px] px-1 py-0.5 rounded ml-0.5 font-bold font-mono">V</kbd>
              </button>

              <button
                @click="triggerBucketPicker"
                class="flex items-center gap-1 px-2.5 py-1.5 bg-theme-column hover:bg-theme-column/80 border border-theme-border/60 text-theme-text-muted hover:text-theme-text-main rounded-lg text-xs font-bold cursor-pointer transition-colors"
                title="Move to column"
              >
                <FolderInput class="w-3.5 h-3.5 shrink-0" />
                <span class="hidden md:inline">{{ t('triage.moveColumn') }}</span>
                <kbd
                  class="hidden md:inline bg-theme-card text-theme-text-muted text-[9px] px-1 py-0.5 rounded border border-theme-border ml-1 font-bold font-mono"
                  >M</kbd
                >
              </button>

              <button
                @click="removeCurrentTask"
                class="p-2 bg-theme-column hover:bg-rose-500/15 border border-theme-border/60 hover:border-rose-500/35 text-theme-text-muted hover:text-rose-400 rounded-lg cursor-pointer transition-all"
                title="Delete task"
              >
                <Trash2 class="w-4 h-4 shrink-0" />
              </button>
            </div>

            <!-- Queue Pager arrows (Prev / Next) -->
            <div class="flex items-center gap-1.5">
              <button
                @click="prev"
                :disabled="currentTaskIndex === 0"
                class="p-2 bg-theme-column hover:bg-theme-column/80 border border-theme-border/60 text-theme-text-muted disabled:opacity-40 hover:text-theme-text-main rounded-lg cursor-pointer transition-colors"
              >
                <ChevronLeft class="w-4 h-4 shrink-0" />
              </button>
              <span class="text-xs font-extrabold text-theme-text-muted px-1.5">
                {{ currentTaskIndex + 1 }} / {{ sortedTasks.length }}
              </span>
              <button
                @click="next"
                class="p-2 bg-theme-column hover:bg-theme-column/80 border border-theme-border/60 text-theme-text-muted hover:text-theme-text-main rounded-lg cursor-pointer transition-colors"
              >
                <ChevronRight class="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Sidebar Floating Keyboard Shortcuts Guide Panel -->
    <transition name="slide">
      <div
        v-show="showHelp"
        class="w-72 border border-theme-border/60 rounded-xl bg-theme-card/60 backdrop-blur-md p-4 flex flex-col h-full shrink-0 shadow-xl overflow-hidden relative"
      >
        <div class="flex items-center justify-between pb-3 border-b border-theme-border/40 shrink-0">
          <div class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-theme-text-main">
            <Keyboard class="w-4 h-4 text-theme-accent shrink-0 animate-pulse" />
            {{ t('triage.shortcutsTitle') }}
          </div>
          <button
            @click="showHelp = false"
            class="p-1 rounded hover:bg-theme-column/50 text-theme-text-muted hover:text-theme-text-main cursor-pointer shrink-0"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Shortcuts Scroll Panel list -->
        <div class="flex-grow overflow-y-auto space-y-4 pt-4 scroller-thin min-h-0 text-[11px]">
          <!-- Category 1: Queue Flow -->
          <div class="space-y-2">
            <h4 class="font-extrabold text-[10px] uppercase tracking-wider text-theme-accent">{{ t('triage.shortcuts.navHeader') }}</h4>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.nextTask') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >J</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.prevTask') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >K</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.editTitle') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >Enter</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.addTags') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >A</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.toggleHelp') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >H</kbd
                >
              </div>
            </div>
          </div>

          <!-- Category 2: Task Priority -->
          <div class="space-y-2">
            <h4 class="font-extrabold text-[10px] uppercase tracking-wider text-theme-accent">
              {{ t('triage.shortcuts.priorityHeader') }}
            </h4>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.urgentPriority') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >1</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.highPriority') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >2</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.mediumPriority') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >3</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.lowPriority') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >4</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.clearPriority') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >0</kbd
                >
              </div>
            </div>
          </div>

          <!-- Category 3: Task Planning -->
          <div class="space-y-2">
            <h4 class="font-extrabold text-[10px] uppercase tracking-wider text-theme-accent">{{ t('triage.shortcuts.datesHeader') }}</h4>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.planToday') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >T</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.planTomorrow') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >O</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.planWeek') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >W</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.planSomeday') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >S</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.clearPlan') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >U</kbd
                >
              </div>
            </div>
          </div>

          <!-- Category 4: Other actions -->
          <div class="space-y-2 pb-4">
            <h4 class="font-extrabold text-[10px] uppercase tracking-wider text-theme-accent">{{ t('triage.shortcuts.opsHeader') }}</h4>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.markDone') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >V</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.moveToColumn') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >M</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.cycleColor') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >C</kbd
                >
              </div>
              <div class="flex items-center justify-between py-1 border-b border-theme-border/20">
                <span class="text-theme-text-muted">{{ t('triage.shortcuts.deleteTask') }}</span>
                <kbd
                  class="px-1.5 py-0.5 rounded bg-theme-column border border-theme-border/80 text-[10px] font-mono font-bold text-theme-text-main"
                  >D / Backspace</kbd
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- COLUMN / BUCKET SELECTOR MODAL OVERLAY dialog -->
    <div
      v-if="showBucketPicker"
      class="absolute inset-0 bg-theme-base/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
    >
      <div class="bg-theme-card border border-theme-border rounded-xl shadow-2xl p-5 max-w-sm w-full space-y-4 animate-scale-in">
        <h3 class="text-sm font-bold text-theme-text-main flex items-center gap-1.5">
          <FolderInput class="w-4 h-4 text-theme-accent" />
          {{ t('triage.columnPopupTitle') }}
        </h3>
        <div class="space-y-1.5">
          <button
            v-for="(b, idx) in buckets"
            :key="b.name"
            @click="moveToBucket(b.name)"
            class="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-theme-column/40 hover:bg-theme-column text-sm font-semibold transition-colors border border-theme-border/30 cursor-pointer"
          >
            <span class="truncate">{{ bucketTitle(b.name, b.title) }}</span>
            <kbd class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-card border border-theme-border text-theme-text-muted">
              {{ idx + 1 }}
            </kbd>
          </button>
        </div>
        <div class="flex justify-end pt-1">
          <button
            @click="showBucketPicker = false"
            class="px-3 py-1.5 text-xs font-semibold text-theme-text-muted hover:text-theme-text-main cursor-pointer"
          >
            {{ t('buttons.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-pulse-slow {
  animation: pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Slide in animation for right sidebar panel */
.slide-enter-active,
.slide-leave-active {
  transition:
    max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  max-width: 0;
  opacity: 0;
  padding-left: 0;
  padding-right: 0;
  border-color: transparent;
}
.slide-enter-to,
.slide-leave-from {
  max-width: 18rem;
  opacity: 1;
}

/* Micro animations */
.animate-fade-in {
  animation: fadeIn 0.25s ease-out;
}
.animate-scale-in {
  animation: scaleIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
