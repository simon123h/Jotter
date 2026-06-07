<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import Sortable from 'sortablejs';
import type { Task } from '@/types';
import TaskCard from '@/components/ui/TaskCard.vue';
import { ChevronRight } from '@lucide/vue';

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
    projects?: any[];
    isSelected?: (id: string) => boolean;
    isCollapsed?: boolean;
  }>(),
  {
    layout: 'list',
    groupName: 'kanban-board',
    showAddTask: false,
    compactCards: false,
    showProject: false,
    projects: () => [],
    isSelected: () => false,
    isCollapsed: false,
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
      chosenClass: 'scale-[1.02]',
      dragClass: 'rotate-1',
      draggable: '.task-card',
      filter: '.add-task-btn',
      preventOnFilter: true,
      onStart: () => {
        document.body.classList.add('dragging-active');
      },
      onEnd: (evt: any) => {
        document.body.classList.remove('dragging-active');
        const { item, to } = evt;
        if (!item || !to) return;

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
    class="generic-column flex flex-col bg-theme-column border border-theme-border rounded h-fit max-h-full shrink-0 group/col relative overflow-hidden transition-all duration-300"
    :class="[
      isCollapsed
        ? 'w-12 min-w-[48px] max-w-[48px] h-[500px] md:h-auto'
        : layout === 'grid-3'
          ? 'min-w-[840px] w-[864px] md:w-[960px]'
          : layout === 'grid-2'
            ? 'min-w-[560px] w-[576px] md:w-[640px]'
            : 'min-w-[280px] w-72 md:w-80',
    ]"
  >
    <template v-if="!isCollapsed">
      <!-- Header Slot -->
      <slot name="header">
        <div class="px-3 py-2 flex justify-between items-center border-b border-theme-border bg-theme-card/30 rounded-t min-h-[48px]">
          <div class="flex flex-col justify-center overflow-hidden">
            <div class="flex items-center gap-1.5">
              <h3 class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate">{{ title }}</h3>
              <span class="text-xs px-1.5 py-0.25 font-bold rounded bg-theme-card border border-theme-border/60 text-theme-text-muted">
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
              :project-title="projects?.find((p) => p.id === task.project_id)?.title"
              :is-selected="isSelected(task.id)"
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
              :project-title="projects?.find((p) => p.id === task.project_id)?.title"
              :is-selected="isSelected(task.id)"
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
            :project-title="projects?.find((p) => p.id === task.project_id)?.title"
            :is-selected="isSelected(task.id)"
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
      <!-- Collapsed Column Content Overlay -->
      <div class="absolute inset-0 flex flex-col items-center py-4 gap-4 pointer-events-none select-none z-10">
        <!-- Expand Button -->
        <button
          @click="emit('toggle-collapse')"
          class="pointer-events-auto text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card/50 p-1.5 rounded transition-colors cursor-pointer"
          title="Expand Column"
        >
          <ChevronRight class="w-4 h-4" />
        </button>

        <!-- Count Badge -->
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-theme-card border border-theme-border/60 text-theme-text-muted select-none">
          {{ tasks.length }}
        </span>

        <!-- Rotated vertical title -->
        <div
          @click="emit('toggle-collapse')"
          class="pointer-events-auto font-bold text-xs uppercase tracking-wider text-theme-text-main hover:text-theme-accent cursor-pointer writing-vertical rotate-180 truncate max-h-[320px] mt-2 select-none"
          :title="title"
        >
          {{ title }}
        </div>
      </div>

      <!-- Empty Drop Zone wrapper for Sortable in collapsed mode -->
      <div
        ref="cardsContainer"
        :data-column-id="id"
        class="absolute inset-0 z-0 opacity-0 cards-container-list"
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
