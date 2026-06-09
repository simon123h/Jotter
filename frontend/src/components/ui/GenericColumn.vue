<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import Sortable from 'sortablejs';
import type { Task } from '@/types';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
import TaskCard from '@/components/ui/TaskCard.vue';
import { ChevronRight } from '@lucide/vue';
import { useSelectionStore } from '@/stores/selection';

const selectionStore = useSelectionStore();

const props = withDefaults(
  defineProps<{
    id: string; // Unique identifier for the drop zone
    title: string;
    subtitle?: string;
    tasks: Task[];
    layout?: 'list' | 'grid-2' | 'grid-3';
    color?: string | null;
    maxTasks?: number | null;
    isLimitExceeded?: boolean;
    groupName?: string;
    showAddTask?: boolean;
    compactCards?: boolean;
    showProject?: boolean;
    isCollapsed?: boolean;
    isFluid?: boolean;
    isReadOnly?: boolean;
  }>(),
  {
    subtitle: '',
    layout: 'list',
    color: null,
    maxTasks: null,
    isLimitExceeded: false,
    groupName: 'kanban-board',
    showAddTask: false,
    compactCards: false,
    showProject: false,
    isCollapsed: false,
    isFluid: false,
    isReadOnly: false,
  }
);
const emit = defineEmits<{
  (e: 'add-task-click', id: string): void;
  (e: 'card-dropped', payload: { taskId: string; toId: string; prevTaskId: string | null; nextTaskId: string | null }): void;
  (e: 'mark-done', task: Task): void;
  (e: 'toggle-select', task: Task): void;
  (e: 'toggle-collapse'): void;
}>();

const cardsContainer = ref<HTMLElement | null>(null);
const leftContainer = ref<HTMLElement | null>(null);
const rightContainer = ref<HTMLElement | null>(null);
const col1Container = ref<HTMLElement | null>(null);
const col2Container = ref<HTMLElement | null>(null);
const col3Container = ref<HTMLElement | null>(null);

const leftTasks = computed(() => props.tasks.filter((_, idx) => idx % 2 === 0));
const rightTasks = computed(() => props.tasks.filter((_, idx) => idx % 2 === 1));

const col1Tasks = computed(() => props.tasks.filter((_, idx) => idx % 3 === 0));
const col2Tasks = computed(() => props.tasks.filter((_, idx) => idx % 3 === 1));
const col3Tasks = computed(() => props.tasks.filter((_, idx) => idx % 3 === 2));

const colorMap: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  slate: '#64748b',
};

const columnStyle = computed(() => {
  const styles: Record<string, string> = {};
  if (props.isLimitExceeded) {
    styles['--column-tint'] = '#ef4444';
    styles['background-color'] = 'color-mix(in srgb, #ef4444 8%, var(--theme-bg-column))';
    styles['border-color'] = 'color-mix(in srgb, #ef4444 50%, var(--theme-border))';
    styles['box-shadow'] = '0 0 12px rgba(239, 68, 68, 0.15)';
  } else if (props.color && colorMap[props.color]) {
    const hexColor = colorMap[props.color];
    styles['--column-tint'] = hexColor;
    styles['background-color'] = `color-mix(in srgb, ${hexColor} 3%, var(--theme-bg-column))`;
    styles['border-color'] = `color-mix(in srgb, ${hexColor} 25%, var(--theme-border))`;
  }
  return styles;
});

const headerColorClasses = computed(() => {
  const defaultClasses = {
    bg: 'bg-theme-card/30',
    text: 'text-theme-text-main',
    badge: 'bg-theme-card border border-theme-border/60 text-theme-text-muted',
    border: 'border-theme-border',
  };
  if (!props.color) return defaultClasses;
  const color = props.color;
  const mapping: Record<string, { bg: string; text: string; badge: string; border: string }> = {
    red: {
      bg: 'bg-rose-500/5',
      text: 'text-rose-400',
      badge: 'bg-rose-500/10 border border-rose-500/20 text-rose-400',
      border: 'border-rose-500/10',
    },
    orange: {
      bg: 'bg-orange-500/5',
      text: 'text-orange-400',
      badge: 'bg-orange-500/10 border border-orange-500/20 text-orange-400',
      border: 'border-orange-500/10',
    },
    yellow: {
      bg: 'bg-amber-500/5',
      text: 'text-amber-400',
      badge: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
      border: 'border-amber-500/10',
    },
    green: {
      bg: 'bg-emerald-500/5',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
      border: 'border-emerald-500/10',
    },
    blue: {
      bg: 'bg-blue-500/5',
      text: 'text-blue-400',
      badge: 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
      border: 'border-blue-500/10',
    },
    purple: {
      bg: 'bg-purple-500/5',
      text: 'text-purple-400',
      badge: 'bg-purple-500/10 border border-purple-500/20 text-purple-400',
      border: 'border-purple-500/10',
    },
    pink: {
      bg: 'bg-pink-500/5',
      text: 'text-pink-400',
      badge: 'bg-pink-500/10 border border-pink-500/20 text-pink-400',
      border: 'border-pink-500/10',
    },
    slate: {
      bg: 'bg-slate-500/5',
      text: 'text-slate-400',
      badge: 'bg-slate-500/10 border border-slate-500/20 text-slate-400',
      border: 'border-slate-500/10',
    },
  };
  return mapping[color] || defaultClasses;
});

const sortableInstances = ref<Sortable[]>([]);

const destroySortables = () => {
  sortableInstances.value.forEach((inst) => inst.destroy());
  sortableInstances.value = [];
};

const setupSortables = () => {
  destroySortables();

  nextTick(() => {
    // Ensure component is still mounted and DOM elements exist
    const createSortableOptions = () => ({
      group: props.groupName,
      animation: 180,
      ghostClass: 'opacity-40',
      // chosenClass: 'scale-[1.02]',
      // delay: 60,
      dragClass: 'rotate-1',
      draggable: '.task-card',
      filter: '.add-task-btn',
      preventOnFilter: true,
      onStart: (evt: any) => {
        document.body.classList.add('dragging-active');
        const taskId = evt.item.getAttribute('data-task-id') || '';
        selectionStore.startDragging(taskId);
      },
      onEnd: (evt: any) => {
        document.body.classList.remove('dragging-active');
        selectionStore.stopDragging();
        const { item, to, from, oldIndex } = evt;
        if (!item || !to) return;

        if (props.isReadOnly) {
          if (from && oldIndex !== undefined) {
            if (oldIndex < from.children.length) {
              from.insertBefore(item, from.children[oldIndex]);
            } else {
              from.appendChild(item);
            }
          }
          return;
        }

        const taskId = item.getAttribute('data-task-id') || '';
        const toId = to.getAttribute('data-column-id') || '';

        let prevEl = item.previousElementSibling;
        let nextEl = item.nextElementSibling;

        while (prevEl && !prevEl.classList.contains('task-card')) {
          prevEl = prevEl.previousElementSibling;
        }
        while (nextEl && !nextEl.classList.contains('task-card')) {
          nextEl = nextEl.nextElementSibling;
        }

        const prevTaskId = prevEl ? prevEl.getAttribute('data-task-id') : null;
        const nextTaskId = nextEl ? nextEl.getAttribute('data-task-id') : null;

        // Revert Sortable.js physical DOM manipulation if the card was moved between columns.
        // This lets Vue's reactivity take full control of rendering, preventing double-rendering or unmount issues.
        if (from && from !== to) {
          if (oldIndex !== undefined && oldIndex < from.children.length) {
            from.insertBefore(item, from.children[oldIndex]);
          } else {
            from.appendChild(item);
          }
        }

        emit('card-dropped', {
          taskId,
          toId,
          prevTaskId,
          nextTaskId,
        });
      },
    });

    if (props.layout === 'grid-3') {
      [col1Container, col2Container, col3Container].forEach((cRef) => {
        if (cRef.value instanceof HTMLElement) {
          sortableInstances.value.push(Sortable.create(cRef.value, createSortableOptions()));
        }
      });
    } else if (props.layout === 'grid-2') {
      [leftContainer, rightContainer].forEach((cRef) => {
        if (cRef.value instanceof HTMLElement) {
          sortableInstances.value.push(Sortable.create(cRef.value, createSortableOptions()));
        }
      });
    } else {
      if (cardsContainer.value instanceof HTMLElement) {
        sortableInstances.value.push(Sortable.create(cardsContainer.value, createSortableOptions()));
      }
    }
  });
};

onMounted(() => {
  setupSortables();
});

onBeforeUnmount(() => {
  destroySortables();
});

watch(
  () => props.layout,
  () => {
    setupSortables();
  },
  { deep: false }
);

watch(
  () => props.isCollapsed,
  () => {
    setupSortables();
  }
);
</script>

<template>
  <div
    :style="columnStyle"
    class="generic-column flex flex-col rounded group/col relative overflow-hidden transition-all duration-300"
    :class="[
      isCollapsed
        ? 'w-12 min-w-[48px] max-w-[48px] h-fit max-h-full shrink-0 bg-theme-column/50 backdrop-blur-[2px] border border-theme-border hover:bg-theme-column/75 hover:border-theme-accent/40 shadow-sm hover:shadow-md'
        : 'bg-theme-column border border-theme-border shadow-sm ' +
          (isFluid
            ? 'w-full h-full min-w-0'
            : 'h-fit max-h-full shrink-0 ' +
              (layout === 'grid-3'
                ? 'min-w-[840px] w-[864px] md:w-[960px]'
                : layout === 'grid-2'
                  ? 'min-w-[560px] w-[576px] md:w-[640px]'
                  : 'min-w-[280px] w-72 md:w-80')),
    ]"
  >
    <template v-if="!isCollapsed">
      <!-- Header Slot -->
      <slot name="header" :classes="headerColorClasses">
        <div
          class="px-3 py-2 flex justify-between items-center border-b rounded-t min-h-[48px]"
          :class="[headerColorClasses.bg, headerColorClasses.border]"
        >
          <div class="flex flex-col justify-center overflow-hidden">
            <div class="flex items-center gap-1.5">
              <h3 class="font-bold text-sm uppercase tracking-wider truncate" :class="[headerColorClasses.text]">
                {{ title }}
              </h3>
              <span class="text-xs px-1.5 py-0.25 font-bold rounded" :class="[headerColorClasses.badge]">
                {{ tasks.length }}
              </span>
            </div>
          </div>
        </div>
      </slot>

      <!-- Cards Container -->
      <div class="flex-grow flex flex-col p-2.5 overflow-y-auto scroller-thin">
        <!-- Optional Add Task Button -->
        <slot name="add-button"></slot>

        <!-- Grid 3x -->
        <div v-if="layout === 'grid-3'" class="subcolumn-wrap flex gap-2.5 items-stretch flex-grow pb-6">
          <div
            v-for="(colTasks, i) in [col1Tasks, col2Tasks, col3Tasks]"
            :key="i"
            :ref="
              (el) => {
                if (i === 0) col1Container = el as any;
                else if (i === 1) col2Container = el as any;
                else col3Container = el as any;
              }
            "
            :data-column-id="id"
            class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow"
          >
            <TaskCard
              v-for="task in colTasks"
              :key="task.id"
              class="task-card"
              :task="task"
              :compact="compactCards"
              :show-project="showProject"
              :data-task-id="task.id"
              @mark-done="emit('mark-done', task)"
              @toggle-select="emit('toggle-select', $event)"
            />
          </div>
        </div>

        <!-- Grid 2x -->
        <div v-else-if="layout === 'grid-2'" class="subcolumn-wrap flex gap-2.5 items-stretch flex-grow pb-6">
          <div
            v-for="(colTasks, i) in [leftTasks, rightTasks]"
            :key="i"
            :ref="
              (el) => {
                if (i === 0) leftContainer = el as any;
                else rightContainer = el as any;
              }
            "
            :data-column-id="id"
            class="subcolumn flex flex-col gap-2.5 w-1/2 flex-grow"
          >
            <TaskCard
              v-for="task in colTasks"
              :key="task.id"
              class="task-card"
              :task="task"
              :compact="compactCards"
              :show-project="showProject"
              :data-task-id="task.id"
              @mark-done="emit('mark-done', task)"
              @toggle-select="emit('toggle-select', $event)"
            />
          </div>
        </div>

        <!-- Single Column -->
        <div v-else ref="cardsContainer" :data-column-id="id" class="cards-container-list flex flex-col gap-2.5 flex-grow pb-6">
          <TaskCard
            v-for="task in tasks"
            :key="task.id"
            class="task-card"
            :task="task"
            :compact="compactCards"
            :show-project="showProject"
            :data-task-id="task.id"
            @mark-done="emit('mark-done', task)"
            @toggle-select="emit('toggle-select', $event)"
          />
        </div>
      </div>

      <!-- Footer Slot -->
      <slot name="footer"></slot>
    </template>

    <template v-else>
      <!-- Collapsed Header matching active columns' header height of 48px -->
      <div
        class="h-12 min-h-[48px] flex items-center justify-center border-b border-theme-border bg-theme-card/30 rounded-t shrink-0 column-drag-handle"
      >
        <!-- Expand Button -->
        <button
          @click.stop="emit('toggle-collapse')"
          class="text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/50 p-1.5 rounded transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
          :title="t('expandColumnTooltip')"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Collapsed Column Content Tab (Static to flow and drive h-fit parent height) -->
      <div class="flex flex-col items-center py-4 px-1 gap-3.5 select-none w-full h-fit relative z-10 min-h-[140px]">
        <!-- Count Badge -->
        <span
          class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all duration-300 select-none z-10"
          :class="[
            isLimitExceeded
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
              : 'bg-theme-card border-theme-border/60 text-theme-text-muted',
          ]"
        >
          {{ tasks.length }}
        </span>

        <!-- Rotated vertical title -->
        <div
          class="font-bold text-xs uppercase tracking-wider text-theme-text-muted group-hover/col:text-theme-text-main cursor-pointer writing-vertical rotate-180 truncate max-h-[180px] select-none leading-none transition-colors duration-200 z-10"
          :title="title"
        >
          {{ title }}
        </div>
      </div>

      <!-- Empty Drop Zone wrapper for Sortable in collapsed mode -->
      <div
        ref="cardsContainer"
        :data-column-id="id"
        class="absolute inset-y-12 inset-x-0 z-20 opacity-0 cards-container-list cursor-pointer"
        @click="emit('toggle-collapse')"
      ></div>
    </template>
  </div>
</template>

<style scoped>
.subcolumn-wrap,
.subcolumn,
.cards-container-list {
  flex-grow: 1;
  min-height: 100px;
}
.writing-vertical {
  writing-mode: vertical-lr;
  text-orientation: mixed;
}
</style>
