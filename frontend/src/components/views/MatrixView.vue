<script setup lang="ts">
import { computed, onMounted, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { Clock, AlertCircle, ArrowRight, UserCheck, Trash, MoreHorizontal, List, LayoutGrid, Grid } from '@lucide/vue';
import type { Task } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';
import { updateTask } from '@/api';

const { t } = useI18n();

const props = defineProps<{
  tasks: Task[];
  isSelected: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
}>();

const route = useRoute();
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const uiStore = useUiStore();
const activeProjectId = computed(() => (route.params.projectId as string) || '');
const { thresholdDays, hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

const fetchViewTasks = async () => {
  if (!activeProjectId.value) return;
  await projectStore.fetchTasks({
    projectId: activeProjectId.value,
  });
};

onMounted(async () => {
  await fetchViewTasks();
  window.addEventListener('click', closeMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenu);
});

watch([activeProjectId, hideDoneColumn, hideArchiveColumn], async () => {
  await fetchViewTasks();
});

const updateThreshold = (val: number) => {
  if (val < 1) val = 1;
  settingsStore.setThresholdDays(val);
};

// Check if task is urgent
const isUrgent = (task: Task): boolean => {
  if (!task.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= thresholdDays.value;
};

// Check if task is prioritized (Important)
const isPrioritized = (task: Task): boolean => {
  return task.priority === 'high' || task.priority === 'urgent';
};

// Quadrants definition
const quadrants = computed(() => {
  const q1: Task[] = [];
  const q2: Task[] = [];
  const q3: Task[] = [];
  const q4: Task[] = [];

  props.tasks.forEach((task) => {
    // Exclude completed or archived tasks
    if (task.bucket === 'done' || task.bucket === 'archive') return;

    const urgent = isUrgent(task);
    const important = isPrioritized(task);

    if (urgent && important) q1.push(task);
    else if (!urgent && important) q2.push(task);
    else if (urgent && !important) q3.push(task);
    else q4.push(task);
  });

  return { q1, q2, q3, q4 };
});

const activeMenuColId = ref<string | null>(null);

const toggleMenu = (colId: string) => {
  activeMenuColId.value = activeMenuColId.value === colId ? null : colId;
};

const closeMenu = () => {
  activeMenuColId.value = null;
};

const matrixColumns = computed(() => [
  {
    id: 'q1',
    title: t('matrix.q1Title'),
    subtitle: t('matrix.q1Desc'),
    tasks: quadrants.value.q1,
    color: 'red',
    icon: AlertCircle,
  },
  {
    id: 'q2',
    title: t('matrix.q2Title'),
    subtitle: t('matrix.q2Desc'),
    tasks: quadrants.value.q2,
    color: 'green',
    icon: ArrowRight,
  },
  {
    id: 'q3',
    title: t('matrix.q3Title'),
    subtitle: t('matrix.q3Desc'),
    tasks: quadrants.value.q3,
    color: 'orange',
    icon: UserCheck,
  },
  {
    id: 'q4',
    title: t('matrix.q4Title'),
    subtitle: t('matrix.q4Desc'),
    tasks: quadrants.value.q4,
    color: 'slate',
    icon: Trash,
  },
]);

const handleCardDropped = async (payload: { taskId: string; toId: string }) => {
  const task = props.tasks.find((t) => t.id === payload.taskId);
  if (!task) return;

  const originalPriority = task.priority;
  const originalDueDate = task.due_date;

  let newPriority = task.priority;
  let newDueDate = task.due_date;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (payload.toId === 'q1') {
    if (task.priority !== 'high' && task.priority !== 'urgent') {
      newPriority = 'high';
    }
    if (!isUrgent(task)) {
      newDueDate = todayStr;
    }
  } else if (payload.toId === 'q2') {
    if (task.priority !== 'high' && task.priority !== 'urgent') {
      newPriority = 'high';
    }
    if (isUrgent(task)) {
      newDueDate = '';
    }
  } else if (payload.toId === 'q3') {
    if (task.priority === 'high' || task.priority === 'urgent') {
      newPriority = 'medium';
    }
    if (!isUrgent(task)) {
      newDueDate = todayStr;
    }
  } else if (payload.toId === 'q4') {
    if (task.priority === 'high' || task.priority === 'urgent') {
      newPriority = 'medium';
    }
    if (isUrgent(task)) {
      newDueDate = '';
    }
  }

  // Optimistic update
  task.priority = newPriority;
  task.due_date = newDueDate;

  try {
    await updateTask(task.project_id || activeProjectId.value, payload.taskId, {
      priority: newPriority,
      due_date: newDueDate,
    });
    await fetchViewTasks();
  } catch {
    task.priority = originalPriority;
    task.due_date = originalDueDate;
  }
};
</script>

<template>
  <div class="h-full flex flex-col space-y-4">
    <!-- Header with Threshold Slider -->
    <div class="flex items-center justify-between px-1">
      <div class="flex flex-col">
        <h2 class="text-lg font-bold text-theme-text-main flex items-center gap-2">
          <Clock class="w-5 h-5 text-theme-accent" />
          {{ t('views.matrix') }}
        </h2>
        <span class="text-xs text-theme-text-muted uppercase tracking-widest font-semibold">Eisenhower Matrix</span>
      </div>

      <div class="flex flex-col items-end gap-1">
        <label class="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
          {{ t('matrix.thresholdLabel', { days: thresholdDays }) }}
        </label>
        <div class="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="30"
            :value="thresholdDays"
            @input="updateThreshold(parseInt(($event.target as HTMLInputElement).value))"
            class="w-48 h-1.5 bg-theme-column/40 rounded-lg appearance-none cursor-pointer accent-theme-primary"
          />
        </div>
      </div>
    </div>

    <!-- 2x2 Grid using GenericColumn component -->
    <div class="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 overflow-hidden select-none">
      <GenericColumn
        v-for="col in matrixColumns"
        :key="col.id"
        :id="col.id"
        :title="col.title"
        :tasks="col.tasks"
        :color="col.color"
        :group-name="'matrix-view'"
        :compact-cards="true"
        :is-selected="isSelected"
        :is-fluid="true"
        :layout="uiStore.getVirtualColumnLayout('matrix-view', col.id, 'grid-3')"
        @card-dropped="handleCardDropped"
        @toggle-select="(task) => emit('toggle-select', task)"
      >
        <template #header="{ classes }">
          <div
            class="px-3.5 py-2 flex justify-between items-center border-b rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
            :class="[classes.bg, classes.border]"
          >
            <!-- Title, Description & Count Badge -->
            <div class="flex items-center gap-2 min-w-0 mr-1">
              <component :is="col.icon" class="w-4.5 h-4.5 shrink-0" :class="[classes.text]" />
              <div class="min-w-0">
                <h4 class="font-bold text-sm uppercase tracking-wider truncate" :class="[classes.text]">
                  {{ col.title }}
                </h4>
                <p class="text-[10px] text-theme-text-muted leading-tight truncate uppercase tracking-tighter opacity-70">
                  {{ col.subtitle }}
                </p>
              </div>
              <span
                class="text-xs px-1.5 py-0.25 font-bold rounded shrink-0"
                :class="[classes.badge]"
              >
                {{ col.tasks.length }}
              </span>
            </div>

            <!-- Controls: Layout Selector (NO collapsing) -->
            <div class="flex items-center shrink-0">
              <!-- Layout Selector Dropdown Menu -->
              <div class="relative flex items-center">
                <button
                  @click.stop="toggleMenu(col.id)"
                  class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-all duration-200 cursor-pointer"
                  :class="{ 'text-theme-text-main bg-theme-card/50': activeMenuColId === col.id }"
                  title="Column Layout Options"
                >
                  <MoreHorizontal class="w-4 h-4 shrink-0" />
                </button>

                <!-- Dropdown Panel -->
                <transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <div
                    v-if="activeMenuColId === col.id"
                    class="absolute right-0 top-full mt-1 bg-theme-card border border-theme-border rounded shadow-lg p-1 flex flex-col gap-1 z-50 min-w-[130px]"
                  >
                    <div class="px-2.5 py-1 text-[9px] font-bold text-theme-text-muted/65 uppercase tracking-wider border-b border-theme-border/30 mb-0.5 select-none">
                      Layout
                    </div>
                    <button
                      @click.stop="uiStore.setVirtualColumnLayout('matrix-view', col.id, 'list'); closeMenu()"
                      class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-theme-column/50 transition-colors text-left cursor-pointer w-full"
                      :class="[
                        uiStore.getVirtualColumnLayout('matrix-view', col.id, 'grid-3') === 'list'
                          ? 'text-theme-primary font-semibold bg-theme-primary/10'
                          : 'text-theme-text-muted hover:text-theme-text-main',
                      ]"
                    >
                      <List class="w-3.5 h-3.5 shrink-0" />
                      <span>List</span>
                    </button>
                    <button
                      @click.stop="uiStore.setVirtualColumnLayout('matrix-view', col.id, 'grid-2'); closeMenu()"
                      class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-theme-column/50 transition-colors text-left cursor-pointer w-full"
                      :class="[
                        uiStore.getVirtualColumnLayout('matrix-view', col.id, 'grid-3') === 'grid-2'
                          ? 'text-theme-primary font-semibold bg-theme-primary/10'
                          : 'text-theme-text-muted hover:text-theme-text-main',
                      ]"
                    >
                      <LayoutGrid class="w-3.5 h-3.5 shrink-0" />
                      <span>2 Columns</span>
                    </button>
                    <button
                      @click.stop="uiStore.setVirtualColumnLayout('matrix-view', col.id, 'grid-3'); closeMenu()"
                      class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-theme-column/50 transition-colors text-left cursor-pointer w-full"
                      :class="[
                        uiStore.getVirtualColumnLayout('matrix-view', col.id, 'grid-3') === 'grid-3'
                          ? 'text-theme-primary font-semibold bg-theme-primary/10'
                          : 'text-theme-text-muted hover:text-theme-text-main',
                      ]"
                    >
                      <Grid class="w-3.5 h-3.5 shrink-0" />
                      <span>3 Columns</span>
                    </button>
                  </div>
                </transition>
              </div>
            </div>
          </div>
        </template>
      </GenericColumn>
    </div>
  </div>
</template>
