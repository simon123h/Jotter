<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import Sortable from 'sortablejs';
import type { Task, BucketName } from '../types';
import TaskCard from './TaskCard.vue';
import ColumnEditModal from './ColumnEditModal.vue';
import { useI18n } from '../composables/useI18n';
import { Pencil, Trash2, Plus } from '@lucide/vue';

const { t } = useI18n();

const props = defineProps<{
  bucketName: BucketName;
  title: string;
  subtitle: string;
  color?: string | null;
  layout?: 'list' | 'grid-2' | 'grid-3';
  tasks: Task[];
  isFirst: boolean;
  isLast: boolean;
}>();

const emit = defineEmits<{
  (e: 'task-click', task: Task): void;
  (e: 'add-task-click', bucket: BucketName): void;
  (e: 'card-dropped', payload: { taskId: number; toBucket: BucketName; prevTaskId: number | null; nextTaskId: number | null }): void;
  (e: 'rename-column', payload: { bucketName: string; newTitle: string; newSubtitle: string; newColor?: string | null; newLayout?: 'list' | 'grid-2' | 'grid-3' }): void;
  (e: 'delete-column', bucketName: string): void;
  (e: 'mark-done', task: Task): void;
}>();

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
  if (!props.color || !colorMap[props.color]) return {};
  const hexColor = colorMap[props.color];
  return {
    '--column-tint': hexColor,
    'background-color': `color-mix(in srgb, ${hexColor} 3%, var(--theme-bg-column))`,
    'border-color': `color-mix(in srgb, ${hexColor} 25%, var(--theme-border))`,
  };
});

const onSaveColumn = (payload: { bucketName: string; title: string; subtitle: string; color: string | null; layout: 'list' | 'grid-2' | 'grid-3' }) => {
  if (payload.title && (payload.title !== props.title || payload.subtitle !== props.subtitle || payload.color !== props.color || payload.layout !== props.layout)) {
    emit('rename-column', {
      bucketName: props.bucketName,
      newTitle: payload.title,
      newSubtitle: payload.subtitle,
      newColor: payload.color,
      newLayout: payload.layout,
    });
  }
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
      onEnd: (evt: any) => {
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
    class="flex flex-col bg-theme-column border border-theme-border rounded h-full shrink-0 group/col relative overflow-hidden transition-all duration-300"
    :class="[
      layout === 'grid-3'
        ? 'min-w-[840px] w-[864px] md:w-[960px]'
        : layout === 'grid-2'
          ? 'min-w-[560px] w-[576px] md:w-[640px]'
          : 'min-w-[280px] w-72 md:w-80'
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
              class="text-xs px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0"
            >
              {{ tasks.length }}
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
      <div class="flex items-center gap-0.5 shrink-0">
        <!-- Rename Column -->
        <button
          @click="isEditModalOpen = true"
          class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card rounded transition-colors cursor-pointer"
          :title="t('renameColumnTooltip')"
        >
          <Pencil class="w-3.5 h-3.5 shrink-0" />
        </button>

        <!-- Delete Column -->
        <button
          @click="emit('delete-column', bucketName)"
          :disabled="tasks.length > 0"
          class="p-1 rounded transition-colors cursor-pointer"
          :class="
            tasks.length > 0
              ? 'text-theme-text-muted/30 cursor-not-allowed opacity-40'
              : 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
          "
          :title="tasks.length > 0 ? t('deleteColumnDisabledTooltip') : t('deleteColumnTooltip')"
        >
          <Trash2 class="w-3.5 h-3.5 shrink-0" />
        </button>

        <!-- Add Task -->
        <button
          @click="emit('add-task-click', bucketName)"
          class="text-theme-text-muted hover:text-theme-text-main hover:bg-theme-card p-1 rounded transition-colors cursor-pointer border border-theme-border/20 shadow-sm"
          :title="t('colAddTooltip')"
        >
          <Plus class="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>

    <!-- Cards Container -->
    <div
      class="flex-grow p-2.5 overflow-y-auto min-h-[150px] scroller-thin animate-fade-in"
    >
      <!-- Grid 3x Masonry-style subcolumns -->
      <div v-if="layout === 'grid-3'" class="flex gap-2.5 items-start min-h-[120px]">
        <!-- Col 1 -->
        <div
          ref="col1Container"
          :data-bucket-name="bucketName"
          class="flex flex-col gap-2.5 w-1/3 min-h-[120px]"
        >
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
        <div
          ref="col2Container"
          :data-bucket-name="bucketName"
          class="flex flex-col gap-2.5 w-1/3 min-h-[120px]"
        >
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
        <div
          ref="col3Container"
          :data-bucket-name="bucketName"
          class="flex flex-col gap-2.5 w-1/3 min-h-[120px]"
        >
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
      <div v-else-if="layout === 'grid-2'" class="flex gap-2.5 items-start min-h-[120px]">
        <!-- Left Subcolumn -->
        <div
          ref="leftContainer"
          :data-bucket-name="bucketName"
          class="flex flex-col gap-2.5 w-1/2 min-h-[120px]"
        >
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
        <div
          ref="rightContainer"
          :data-bucket-name="bucketName"
          class="flex flex-col gap-2.5 w-1/2 min-h-[120px]"
        >
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
      <div
        v-else
        ref="cardsContainer"
        :data-bucket-name="bucketName"
        class="flex flex-col gap-2.5 min-h-[120px]"
      >
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

      <!-- Add Task Button inside scroll area, below the last card -->
      <button
        @click="emit('add-task-click', bucketName)"
        class="add-task-btn w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-theme-border hover:border-theme-accent hover:bg-theme-card text-theme-text-muted hover:text-theme-accent rounded text-sm font-semibold transition-all cursor-pointer shadow-sm group/btn mt-2.5"
      >
        <Plus class="w-4 h-4 shrink-0 transition-transform group-hover/btn:scale-110" />
        {{ t('addTaskButton') }}
      </button>
    </div>

    <!-- Edit Column Details Modal -->
    <ColumnEditModal
      :is-open="isEditModalOpen"
      :bucket-name="bucketName"
      :initial-title="title"
      :initial-subtitle="subtitle"
      :initial-color="color"
      :initial-layout="layout"
      @close="isEditModalOpen = false"
      @save="onSaveColumn"
    />
  </div>
</template>
