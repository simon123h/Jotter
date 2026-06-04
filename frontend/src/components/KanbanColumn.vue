<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import Sortable from 'sortablejs';
import type { Task, BucketName } from '../types';
import TaskCard from './TaskCard.vue';
import ColumnEditModal from './ColumnEditModal.vue';
import { useI18n } from '../composables/useI18n';
import { MoreHorizontal, Plus } from '@lucide/vue';

const { t } = useI18n();

const props = defineProps<{
  bucketName: BucketName;
  title: string;
  subtitle: string;
  color?: string | null;
  layout?: 'list' | 'grid-2' | 'grid-3';
  maxTasks?: number | null;
  tasks: Task[];
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: number; toBucket: BucketName; prevTaskId: number | null; nextTaskId: number | null }): void;
  (
    e: 'rename-column',
    payload: {
      bucketName: string;
      newTitle: string;
      newSubtitle: string;
      newColor?: string | null;
      newLayout?: 'list' | 'grid-2' | 'grid-3';
      newMaxTasks?: number | null;
    }
  ): void;
  (e: 'delete-column', bucketName: string): void;
  (e: 'mark-done', task: Task): void;
}>();

const isLimitExceeded = computed(() => {
  return props.maxTasks !== null && props.maxTasks !== undefined && props.maxTasks > 0 && props.tasks.length > props.maxTasks;
});

const cardsContainer = ref<HTMLElement | null>(null);
const leftContainer = ref<HTMLElement | null>(null);
const rightContainer = ref<HTMLElement | null>(null);
const col1Container = ref<HTMLElement | null>(null);
const col2Container = ref<HTMLElement | null>(null);
const col3Container = ref<HTMLElement | null>(null);
const isEditModalOpen = ref(false);

const displayTitle = computed(() => {
  const translated = t('buckets.' + props.bucketName);
  return translated !== 'buckets.' + props.bucketName ? translated : props.title;
});

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
  if (isLimitExceeded.value) {
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

const onSaveColumn = (payload: {
  bucketName: string;
  title: string;
  subtitle: string;
  color: string | null;
  layout: 'list' | 'grid-2' | 'grid-3';
  max_tasks: number | null;
}) => {
  if (
    payload.title &&
    (payload.title !== props.title ||
      payload.subtitle !== props.subtitle ||
      payload.color !== props.color ||
      payload.layout !== props.layout ||
      payload.max_tasks !== props.maxTasks)
  ) {
    emit('rename-column', {
      bucketName: props.bucketName,
      newTitle: payload.title,
      newSubtitle: payload.subtitle,
      newColor: payload.color,
      newLayout: payload.layout,
      newMaxTasks: payload.max_tasks,
    });
  }
};

const onContainerDblClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest('.task-card') || target.closest('button') || target.closest('a')) {
    return;
  }
  emit('add-task-click', props.bucketName);
};

const sortableInstances = ref<Sortable[]>([]);

const destroySortables = () => {
  sortableInstances.value.forEach((inst) => inst.destroy());
  sortableInstances.value = [];
};

const setupSortables = () => {
  destroySortables();

  nextTick(() => {
    const createSortableOptions = () => ({
      group: 'kanban-board',
      animation: 180,
      delay: 0,
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
        const taskId = Number(item.getAttribute('data-task-id'));
        const toBucket = to.getAttribute('data-bucket-name') as BucketName;

        let prevEl = item.previousElementSibling;
        let nextEl = item.nextElementSibling;

        while (prevEl && !prevEl.classList.contains('task-card')) {
          prevEl = prevEl.previousElementSibling;
        }
        while (nextEl && !nextEl.classList.contains('task-card')) {
          nextEl = nextEl.nextElementSibling;
        }

        const prevTaskId = prevEl ? Number(prevEl.getAttribute('data-task-id')) : null;
        const nextTaskId = nextEl ? Number(nextEl.getAttribute('data-task-id')) : null;

        emit('card-dropped', {
          taskId,
          toBucket,
          prevTaskId,
          nextTaskId,
        });
      },
    });

    if (props.layout === 'grid-3') {
      if (col1Container.value) {
        sortableInstances.value.push(Sortable.create(col1Container.value, createSortableOptions()));
      }
      if (col2Container.value) {
        sortableInstances.value.push(Sortable.create(col2Container.value, createSortableOptions()));
      }
      if (col3Container.value) {
        sortableInstances.value.push(Sortable.create(col3Container.value, createSortableOptions()));
      }
    } else if (props.layout === 'grid-2') {
      if (leftContainer.value) {
        sortableInstances.value.push(Sortable.create(leftContainer.value, createSortableOptions()));
      }
      if (rightContainer.value) {
        sortableInstances.value.push(Sortable.create(rightContainer.value, createSortableOptions()));
      }
    } else {
      if (cardsContainer.value) {
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
  }
);
</script>

<template>
  <div
    :style="columnStyle"
    class="kanban-column flex flex-col bg-theme-column border border-theme-border rounded h-full shrink-0 group/col relative overflow-hidden transition-all duration-300"
    :class="[
      layout === 'grid-3'
        ? 'min-w-[840px] w-[864px] md:w-[960px]'
        : layout === 'grid-2'
          ? 'min-w-[560px] w-[576px] md:w-[640px]'
          : 'min-w-[280px] w-72 md:w-80',
    ]"
  >
    <!-- Column Header -->
    <div
      class="px-3 py-2 flex justify-between items-center border-b border-theme-border bg-theme-card/30 rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
    >
      <!-- Title Area -->
      <div class="flex-grow flex flex-col justify-center overflow-hidden mr-1">
        <div class="flex flex-col gap-0.5 overflow-hidden">
          <div class="flex items-center gap-1.5 overflow-hidden">
            <h3
              class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
              @dblclick="isEditModalOpen = true"
              :title="t('doubleClickToRename')"
            >
              {{ displayTitle }}
            </h3>
            <span
              class="text-xs px-1.5 py-0.25 font-bold rounded shrink-0 transition-all duration-300"
              :class="[
                isLimitExceeded
                  ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 animate-pulse'
                  : 'bg-theme-card border border-theme-border/60 text-theme-text-muted',
              ]"
            >
              {{ maxTasks ? `${tasks.length}/${maxTasks}` : tasks.length }}
            </span>
          </div>
          <!-- Subtitle / Description -->
          <span
            v-if="subtitle"
            class="text-xs text-theme-text-muted truncate cursor-pointer font-sans italic hover:text-theme-accent leading-normal"
            @dblclick="isEditModalOpen = true"
            :title="t('doubleClickToRename')"
          >
            {{ subtitle }}
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center shrink-0">
        <!-- Edit Column Details -->
        <button
          @click="isEditModalOpen = true"
          class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
          :title="t('renameColumnTooltip')"
        >
          <MoreHorizontal class="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>

    <!-- Cards Container -->
    <div
      @dblclick="onContainerDblClick"
      class="flex-grow flex flex-col p-2.5 overflow-y-auto scroller-thin animate-fade-in"
    >
      <!-- "+ Add Task" Card-style Button at the top of the column -->
      <button
        @click="emit('add-task-click', bucketName)"
        class="w-full flex items-center justify-center gap-1.5 py-2 px-3 mb-2.5 border border-dashed border-theme-border/60 hover:border-theme-accent bg-theme-card/20 hover:bg-theme-card/60 text-theme-text-muted hover:text-theme-text-main rounded transition-all cursor-pointer shadow-sm group/btn shrink-0"
      >
        <Plus class="w-3.5 h-3.5 shrink-0 transition-transform group-hover/btn:scale-110" />
        <span class="text-sm font-semibold">{{ t('addTaskButton') }}</span>
      </button>
      <!-- Grid 3x Masonry-style subcolumns -->
      <div v-if="layout === 'grid-3'" class="subcolumn-wrap flex gap-2.5 items-stretch flex-grow">
        <!-- Col 1 -->
        <div ref="col1Container" :data-bucket-name="bucketName" class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow">
          <TaskCard
            class="task-card"
            v-for="task in col1Tasks"
            :key="task.id"
            :task="task"
            :data-task-id="task.id"
            @click="emit('task-click', task)"
            @mark-done="emit('mark-done', $event)"
          />
        </div>

        <!-- Col 2 -->
        <div ref="col2Container" :data-bucket-name="bucketName" class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow">
          <TaskCard
            class="task-card"
            v-for="task in col2Tasks"
            :key="task.id"
            :task="task"
            :data-task-id="task.id"
            @click="emit('task-click', task)"
            @mark-done="emit('mark-done', $event)"
          />
        </div>

        <!-- Col 3 -->
        <div ref="col3Container" :data-bucket-name="bucketName" class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow">
          <TaskCard
            class="task-card"
            v-for="task in col3Tasks"
            :key="task.id"
            :task="task"
            :data-task-id="task.id"
            @click="emit('task-click', task)"
            @mark-done="emit('mark-done', $event)"
          />
        </div>
      </div>

      <!-- Grid 2x Masonry-style subcolumns -->
      <div v-else-if="layout === 'grid-2'" class="subcolumn-wrap flex gap-2.5 items-stretch flex-grow">
        <!-- Left Subcolumn -->
        <div ref="leftContainer" :data-bucket-name="bucketName" class="subcolumn flex flex-col gap-2.5 w-1/2 flex-grow">
          <TaskCard
            class="task-card"
            v-for="task in leftTasks"
            :key="task.id"
            :task="task"
            :data-task-id="task.id"
            @click="emit('task-click', task)"
            @mark-done="emit('mark-done', $event)"
          />
        </div>

        <!-- Right Subcolumn -->
        <div ref="rightContainer" :data-bucket-name="bucketName" class="subcolumn flex flex-col gap-2.5 w-1/2 flex-grow">
          <TaskCard
            class="task-card"
            v-for="task in rightTasks"
            :key="task.id"
            :task="task"
            :data-task-id="task.id"
            @click="emit('task-click', task)"
            @mark-done="emit('mark-done', $event)"
          />
        </div>
      </div>

      <!-- Single Column List -->
      <div v-else ref="cardsContainer" :data-bucket-name="bucketName" class="cards-container-list flex flex-col gap-2.5 flex-grow">
        <TaskCard
          class="task-card"
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :data-task-id="task.id"
          @click="emit('task-click', task)"
          @mark-done="emit('mark-done', $event)"
        />
      </div>
    </div>

    <!-- Edit Column Details Modal -->
    <ColumnEditModal
      :is-open="isEditModalOpen"
      :bucket-name="bucketName"
      :initial-title="title"
      :initial-subtitle="subtitle"
      :initial-color="color"
      :initial-layout="layout"
      :initial-max-tasks="maxTasks"
      :tasks-count="tasks.length"
      @close="isEditModalOpen = false"
      @save="onSaveColumn"
      @delete-column="emit('delete-column', bucketName)"
    />
  </div>
</template>

<style scoped>
/* Make subcolumns and lists fill the vertical space to serve as reliable drop zones */
.subcolumn-wrap,
.subcolumn,
.cards-container-list {
  flex-grow: 1;
  min-height: 120px;
}
</style>
