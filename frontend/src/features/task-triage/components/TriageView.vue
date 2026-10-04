<script setup lang="ts">
import { ref, toRef } from 'vue';
import { Sparkles, Keyboard } from '@lucide/vue';
import type { Task, Bucket } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';

import TriageCard from '@/features/task-triage/components/TriageCard.vue';
import TriageSummary from '@/features/task-triage/components/TriageSummary.vue';
import TriageShortcutsPanel from '@/features/task-triage/components/TriageShortcutsPanel.vue';
import TriageBucketPicker from '@/features/task-triage/components/TriageBucketPicker.vue';
import { useTriageSession } from '@/features/task-triage/composables/useTriageSession';

const props = defineProps<{
  tasks: Task[];
  buckets: Bucket[];
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const { t } = useI18n();

const {
  sortOrder: triageSortOrder,
  sortedTasks,
  currentTask,
  currentTaskIndex,
  isCongratsState,
  editedCount,
  completedCount,
  deletedCount,
  next,
  prev,
  patchCurrentTask,
  cycleColor,
  markTaskDone,
  removeCurrentTask,
  resetSession,
} = useTriageSession(toRef(props, 'tasks'), () => emit('refresh'));

const showHelp = ref(true);
const showBucketPicker = ref(false);
const triageCardRef = ref<any>(null);

const moveToBucket = async (bucketName: string) => {
  if (!currentTask.value) return;
  await patchCurrentTask({ bucket: bucketName });
  showBucketPicker.value = false;
  next();
};

// Global hotkeys inside triage mode. They are inert while the bucket picker is open, which owns the keyboard
// (number keys pick a bucket, Escape closes) and must not also change priority, dates and so on.
const unlessPickerOpen = (callback: () => unknown) => () => {
  if (!showBucketPicker.value) callback();
};

useKeyboardShortcuts(
  [
    { key: 'j', callback: next },
    { key: 'ArrowRight', callback: next },
    { key: 'k', callback: prev },
    { key: 'ArrowLeft', callback: prev },
    { key: 'h', callback: () => (showHelp.value = !showHelp.value) },
    { key: '1', callback: () => patchCurrentTask({ priority: 'urgent' }) },
    { key: '2', callback: () => patchCurrentTask({ priority: 'high' }) },
    { key: '3', callback: () => patchCurrentTask({ priority: 'medium' }) },
    { key: '4', callback: () => patchCurrentTask({ priority: 'low' }) },
    { key: '0', callback: () => patchCurrentTask({ priority: 'none' }) },
    { key: 't', callback: () => patchCurrentTask({ planned_date: 'today' }) },
    { key: 'o', callback: () => patchCurrentTask({ planned_date: 'tomorrow' }) },
    { key: 'w', callback: () => patchCurrentTask({ planned_date: 'thisWeek' }) },
    { key: 's', callback: () => patchCurrentTask({ planned_date: 'sometime' }) },
    { key: 'u', callback: () => patchCurrentTask({ planned_date: '' }) },
    { key: 'c', callback: cycleColor },
    { key: 'v', callback: markTaskDone },
    { key: 'd', callback: removeCurrentTask },
    { key: 'Backspace', callback: removeCurrentTask },
    { key: 'm', callback: () => (showBucketPicker.value = true) },
    { key: 'a', callback: () => triageCardRef.value?.startAddTag() },
    {
      key: 'Enter',
      callback: () => {
        if (triageCardRef.value && !triageCardRef.value.isEditingTitle && !triageCardRef.value.isEditingDescription) {
          triageCardRef.value.startEditTitle();
        }
      },
    },
  ].map((shortcut) => ({ ...shortcut, callback: unlessPickerOpen(shortcut.callback) }))
);
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
        <TriageSummary
          v-if="sortedTasks.length === 0 || isCongratsState"
          :is-congrats="isCongratsState"
          :edited-count="editedCount"
          :completed-count="completedCount"
          :deleted-count="deletedCount"
          @restart="resetSession"
        />

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
          @move-column="showBucketPicker = true"
          @delete-task="removeCurrentTask"
          @next="next"
          @prev="prev"
        />
      </div>
    </div>

    <!-- Right Sidebar Floating Keyboard Shortcuts Guide Panel -->
    <transition name="slide">
      <TriageShortcutsPanel v-show="showHelp" @close="showHelp = false" />
    </transition>

    <!-- COLUMN / BUCKET SELECTOR MODAL OVERLAY dialog -->
    <TriageBucketPicker v-if="showBucketPicker" :buckets="buckets" @pick="moveToBucket" @close="showBucketPicker = false" />
  </div>
</template>

<style scoped src="./triageAnimations.css"></style>

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
</style>
