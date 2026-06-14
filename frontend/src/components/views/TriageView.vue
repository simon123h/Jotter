<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRef } from 'vue';
import {
  Sparkles,
  Keyboard,
  X,
  FolderInput,
  Sparkle,
  CheckSquare,
} from '@lucide/vue';
import type { Task, Bucket } from '@/types';
import { deleteTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { TRIAGE_COLORS } from '@/utils/constants';

// Refactored modular sub-components
import TriageCard from '@/features/task-triage/components/TriageCard.vue';

const props = defineProps<{
  tasks: Task[];
  buckets: Bucket[];
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const { t, tBucket } = useI18n();

const activeProjectId = computed(() => currentTask.value?.project_id || '');
const { patchTask } = useTaskMutations(
  toRef(props, 'tasks'),
  activeProjectId,
  async () => {},
  async () => {
    emit('refresh');
  }
);

// Local triage states
const currentTaskIndex = ref(0);
const triageSortOrder = ref<'created-asc' | 'created-desc' | 'priority' | 'due'>('created-asc');
const showHelp = ref(true);
const showBucketPicker = ref(false);

const triageCardRef = ref<any>(null);

// Session stats tracking
const editedCount = ref(0);
const completedCount = ref(0);
const deletedCount = ref(0);
const lastDeletedTask = ref<Task | null>(null);
const isCongratsState = ref(false);

const colorsList = TRIAGE_COLORS;

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

// General mutations
const patchCurrentTask = async (payload: Partial<Task>) => {
  if (!currentTask.value) return;
  try {
    await patchTask(currentTask.value, payload);
    editedCount.value++;
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
  try {
    await patchTask(taskToComplete, { bucket: 'done' });
    completedCount.value++;
    next();
  } catch (err) {
    console.error('Failed to mark task done', err);
  }
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
    } catch (err) {
      console.error(err);
    }
  }
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
  { key: 'a', callback: () => triageCardRef.value?.startAddTag() },
  {
    key: 'Enter',
    callback: () => {
      if (
        triageCardRef.value &&
        !triageCardRef.value.isEditingTitle &&
        !triageCardRef.value.isEditingDescription
      ) {
        triageCardRef.value.startEditTitle();
      }
    },
  },
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

        <!-- 2. DECOUPLED MOUNT OF PRESENTATIONAL ACTIVE TRIAGE CARD -->
        <TriageCard
          v-else-if="currentTask"
          ref="triageCardRef"
          :task="currentTask"
          :buckets="buckets"
          :current-task-index="currentTaskIndex"
          :total-tasks="sortedTasks.length"
          @update-task="patchCurrentTask"
          @mark-done="markTaskDone"
          @move-column="triggerBucketPicker"
          @delete-task="removeCurrentTask"
          @next="next"
          @prev="prev"
        />
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
            <span class="truncate">{{ tBucket(b.name, b.title) }}</span>
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
