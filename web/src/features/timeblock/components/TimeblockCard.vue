<script setup lang="ts">
import { computed } from 'vue';
import { X, CheckCircle2, Circle, ListPlus, Repeat } from '@lucide/vue';
import { useI18n } from '@/composables/useI18n';
import type { Task, Timeblock } from '@/types';
import { getTimeblockStyle, isTaskDone } from '../utils/timeGrid';

const props = defineProps<{
  timeblock: Timeblock;
  tasks: Task[];
  startHour: number;
  endHour: number;
  isMoving: boolean;
  isResizing: boolean;
  hasSelection: boolean;
}>();

const emit = defineEmits<{
  (e: 'move-start', event: MouseEvent): void;
  (e: 'resize-start', event: MouseEvent): void;
  (e: 'add-selected', event: Event): void;
  (e: 'open-task', task: Task): void;
  (e: 'toggle-done', task: Task, event: Event): void;
  (e: 'unallocate', task: Task, event: Event): void;
}>();

const { t } = useI18n();
const boxStyle = computed(() => getTimeblockStyle(props.timeblock, props.startHour, props.endHour));
</script>

<template>
  <div
    :style="boxStyle"
    @mousedown="emit('move-start', $event)"
    class="timeblock-item absolute left-1.5 right-1.5 rounded-lg border p-2 shadow-sm transition-all flex flex-col overflow-hidden cursor-pointer group select-none z-10"
    :class="[
      isMoving ? 'ring-2 ring-white/80 shadow-2xl opacity-90 scale-[1.02] z-30' : '',
      isResizing ? 'ring-2 ring-amber-400 shadow-xl opacity-95 z-30' : '',
    ]"
  >
    <!-- Box Header: Time badge + Title + Add Button -->
    <div
      class="flex items-center justify-between gap-2 shrink-0 mb-2 pb-1.5 border-b border-black/10 dark:border-white/10 pointer-events-auto"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="text-xs font-extrabold px-2 py-0.5 rounded-md bg-black/10 dark:bg-black/40 text-theme-text-main tracking-tight shrink-0 shadow-2xs"
        >
          {{ timeblock.start_time }} - {{ timeblock.end_time }}
        </span>
        <span class="text-sm font-bold text-theme-text-main truncate flex items-center gap-1.5" :title="timeblock.title">
          {{ timeblock.title }}
          <Repeat
            v-if="timeblock.recurrence && timeblock.recurrence !== 'none'"
            class="w-3 h-3 text-theme-text-muted shrink-0"
            :title="`${t('timeblock.recurrenceLabel')}: ${timeblock.recurrence}`"
          />
        </span>
      </div>
      <!-- Add Selected Tasks Symbol Button (visible only when tasks are selected) -->
      <button
        v-if="hasSelection"
        type="button"
        @click.stop="emit('add-selected', $event)"
        class="p-1 rounded-md bg-theme-primary text-white hover:bg-theme-primary/90 transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-2xs animate-in fade-in zoom-in-90 duration-150"
        :title="t('timeblock.addSelectedTooltip')"
        :aria-label="t('timeblock.addSelectedTasks')"
      >
        <ListPlus class="w-4 h-4" />
      </button>
    </div>

    <!-- Allocated Tasks List Inside Box -->
    <div class="flex-1 overflow-y-auto space-y-1 min-h-0 pr-0.5 pb-2 custom-scrollbar">
      <div
        v-for="task in tasks"
        :key="task.id"
        @click.stop="emit('open-task', task)"
        class="task-item-card task-card flex items-center justify-between gap-1.5 px-2 py-1 rounded bg-theme-card/95 border border-theme-border/70 text-[11px] font-medium text-theme-text-main hover:bg-theme-column/90 transition-all cursor-pointer group/item shadow-2xs"
        :class="isTaskDone(task) ? 'opacity-50' : ''"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            @click.stop="emit('toggle-done', task, $event)"
            class="shrink-0 p-0.5 hover:text-theme-primary transition-colors cursor-pointer"
            :title="isTaskDone(task) ? t('taskCard.markNotDone') : t('taskCard.markDone')"
          >
            <CheckCircle2 v-if="isTaskDone(task)" class="w-3.5 h-3.5 text-emerald-400" />
            <Circle v-else class="w-3.5 h-3.5 text-theme-text-muted" />
          </button>
          <span class="truncate" :class="isTaskDone(task) ? 'line-through text-theme-text-muted' : ''">
            {{ task.title }}
          </span>
        </div>
        <button
          type="button"
          @click.stop="emit('unallocate', task, $event)"
          class="p-0.5 text-theme-text-muted hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 cursor-pointer"
          :title="t('timeblock.unallocate')"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Bottom Resize Handle -->
    <div
      @mousedown.stop="emit('resize-start', $event)"
      class="timeblock-resize-handle absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center z-20 group/resize"
      :title="t('timeblock.resize')"
    >
      <div
        class="w-8 h-1 rounded-full bg-black/20 dark:bg-white/30 group-hover/resize:bg-black/50 dark:group-hover/resize:bg-white/80 transition-colors"
      ></div>
    </div>
  </div>
</template>
