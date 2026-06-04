<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue';
import Sortable from 'sortablejs';
import type { Task } from '../types';
import TaskCard from './TaskCard.vue';
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'mark-done', task: Task): void;
  (e: 'update-due-date', payload: { taskId: string; columnId: string }): void;
}>();

export type TimeColumnId = 'noDate' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'thisYear';

// Group tasks into relative time columns
const timeColumns = computed(() => {
  const groups: Record<TimeColumnId, Task[]> = {
    noDate: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    thisMonth: [],
    thisYear: [],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  props.tasks.forEach((task) => {
    // Exclude completed tasks
    if (task.bucket === 'done') return;

    if (!task.due_date) {
      groups.noDate.push(task);
      return;
    }

    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      groups.today.push(task);
    } else if (diffDays === 1) {
      groups.tomorrow.push(task);
    } else if (diffDays > 1 && diffDays <= 7) {
      groups.thisWeek.push(task);
    } else if (diffDays > 7 && diffDays <= 30) {
      groups.thisMonth.push(task);
    } else {
      groups.thisYear.push(task);
    }
  });

  return [
    { id: 'noDate' as TimeColumnId, title: t('timeView.noDate'), tasks: groups.noDate, bgClass: 'bg-slate-500/5' },
    { id: 'today' as TimeColumnId, title: t('timeView.today'), tasks: groups.today, bgClass: 'bg-red-500/5' },
    { id: 'tomorrow' as TimeColumnId, title: t('timeView.tomorrow'), tasks: groups.tomorrow, bgClass: 'bg-orange-500/5' },
    { id: 'thisWeek' as TimeColumnId, title: t('timeView.thisWeek'), tasks: groups.thisWeek, bgClass: 'bg-yellow-500/5' },
    { id: 'thisMonth' as TimeColumnId, title: t('timeView.thisMonth'), tasks: groups.thisMonth, bgClass: 'bg-blue-500/5' },
    { id: 'thisYear' as TimeColumnId, title: t('timeView.thisYear'), tasks: groups.thisYear, bgClass: 'bg-emerald-500/5' },
  ];
});

// Sortable drag-and-drop between time columns
const columnsContainer = ref<HTMLElement | null>(null);
const sortableInstances: Sortable[] = [];

const destroySortables = () => {
  sortableInstances.forEach((s) => s.destroy());
  sortableInstances.length = 0;
};

const initSortable = () => {
  destroySortables();

  if (!columnsContainer.value) return;

  const cardContainers = columnsContainer.value.querySelectorAll<HTMLElement>('[data-column-id]');
  cardContainers.forEach((container) => {
    const instance = Sortable.create(container, {
      group: 'time-view',
      animation: 180,
      delay: 0,
      ghostClass: 'opacity-40',
      chosenClass: 'scale-[1.02]',
      dragClass: 'rotate-1',
      onEnd: (evt) => {
        const { item, from, to, oldIndex } = evt;
        // Skip if dropped back in the same column (just reordering within)
        if (from === to) return;

        const taskId = item.getAttribute('data-task-id') || '';
        const columnId = to.getAttribute('data-column-id') as string;

        if (!taskId || !columnId) return;

        // Revert Sortable's DOM manipulation before emitting.
        // Sortable has already physically moved the element in the DOM, but
        // Vue's virtual DOM doesn't know about this. We put the element back
        // and let Vue handle the re-render via reactivity when the due date
        // is updated by the parent.
        to.removeChild(item);
        if (oldIndex != null && from.children[oldIndex]) {
          from.insertBefore(item, from.children[oldIndex]);
        } else {
          from.appendChild(item);
        }

        emit('update-due-date', { taskId, columnId });
      },
    });
    sortableInstances.push(instance);
  });
};

onMounted(() => {
  nextTick(() => initSortable());
});

// Re-init Sortable when the task grouping changes so empty columns stay droppable.
let reinitPending = false;
watch(timeColumns, () => {
  if (reinitPending) return;
  reinitPending = true;
  nextTick(() => {
    initSortable();
    reinitPending = false;
  });
});

onBeforeUnmount(() => {
  destroySortables();
});
</script>

<template>
  <div ref="columnsContainer" class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <div
      v-for="col in timeColumns"
      :key="col.id"
      class="flex flex-col bg-theme-column border border-theme-border rounded w-72 shrink-0 md:w-80 group/col h-fit max-h-full"
    >
      <!-- Column Header -->
      <div
        class="px-3.5 py-2.5 flex justify-between items-center border-b border-theme-border rounded-t shrink-0 min-h-[48px]"
        :class="col.bgClass"
      >
        <div class="flex items-center gap-2 min-w-0">
          <h3 class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate">
            {{ col.title }}
          </h3>
          <span class="text-xs px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0">
            {{ col.tasks.length }}
          </span>
        </div>
      </div>

      <!--
        Cards area wrapper: position-relative so the empty-state overlay
        can be positioned absolutely OUTSIDE the Sortable container.
        This is critical: the Sortable container (data-column-id div) must
        contain ONLY TaskCard elements, never a placeholder div, otherwise
        Sortable cannot detect it as a valid drop zone when it's empty.
      -->
      <div class="flex-grow relative flex flex-col min-h-0">
        <!-- Empty state overlay (positioned on top, pointer-events-none so drops pass through) -->
        <div
          v-if="!col.tasks.length"
          class="absolute inset-0 flex items-center justify-center text-theme-text-muted italic text-xs pointer-events-none z-0"
        >
          {{ t('timeView.emptyColumn') }}
        </div>

        <!-- Sortable drop zone: contains ONLY TaskCards, never placeholder elements -->
        <div :data-column-id="col.id" class="p-2.5 overflow-y-auto space-y-2.5 min-h-[150px] flex-grow scroller-thin relative z-10">
          <TaskCard
            v-for="task in col.tasks"
            :key="task.id"
            :task="task"
            :data-task-id="task.id"
            @click="emit('task-click', task)"
            @mark-done="emit('mark-done', task)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
