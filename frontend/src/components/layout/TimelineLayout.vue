<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { Task, Project } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useBuckets } from '@/composables/useBuckets';
import { ChevronLeft, List, LayoutGrid, Grid, MoreHorizontal } from '@lucide/vue';

const props = defineProps<{
  tasks: Task[];
  projects?: Project[];
  isSelected: (id: string) => boolean;
  groupName: string;
  showProjectBadge?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-select', task: Task): void;
  (e: 'refresh'): void;
}>();

const { t } = useI18n();
const route = useRoute();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
const activeProjectId = computed(() => (route.params.projectId as string) || '');
const { hideDoneColumn, hideArchiveColumn } = storeToRefs(settingsStore);

const { fetchBuckets } = useBuckets(activeProjectId, hideDoneColumn, hideArchiveColumn);
const { handleMarkTaskDone, handleTimeViewPlannedDateUpdate } = useTaskMutations(
  ref(props.tasks),
  activeProjectId,
  fetchBuckets,
  async () => {
    emit('refresh');
  }
);

// Group tasks into categorical planning columns
const timeColumns = computed(() => {
  const groups: Record<string, Task[]> = {
    notPlanned: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    thisMonth: [],
    thisYear: [],
    sometime: [],
  };

  props.tasks.forEach((task) => {
    // Exclude completed or archived tasks
    if (task.bucket === 'done' || task.bucket === 'archive') return;

    const key = task.planned_date || 'notPlanned';
    if (groups[key]) {
      groups[key].push(task);
    } else {
      groups.notPlanned.push(task);
    }
  });

  return [
    { id: 'notPlanned', title: t('plannedDateOptions.notPlanned'), tasks: groups.notPlanned, color: 'slate' },
    { id: 'today', title: t('plannedDateOptions.today'), tasks: groups.today, color: 'red' },
    { id: 'tomorrow', title: t('plannedDateOptions.tomorrow'), tasks: groups.tomorrow, color: 'orange' },
    { id: 'thisWeek', title: t('plannedDateOptions.thisWeek'), tasks: groups.thisWeek, color: 'yellow' },
    { id: 'thisMonth', title: t('plannedDateOptions.thisMonth'), tasks: groups.thisMonth, color: 'blue' },
    { id: 'thisYear', title: t('plannedDateOptions.thisYear'), tasks: groups.thisYear, color: 'green' },
    { id: 'sometime', title: t('plannedDateOptions.sometime'), tasks: groups.sometime, color: 'purple' },
  ];
});

const handleCardDropped = async (payload: { taskId: string; toId: string }) => {
  const isSelectedTask = props.isSelected(payload.taskId);
  const tasksToUpdate = isSelectedTask
    ? props.tasks.filter((t) => props.isSelected(t.id))
    : props.tasks.filter((t) => t.id === payload.taskId);

  if (tasksToUpdate.length === 0) return;

  const targetDate = payload.toId === 'notPlanned' ? '' : payload.toId;

  await Promise.all(
    tasksToUpdate.map((t) =>
      handleTimeViewPlannedDateUpdate({
        taskId: t.id,
        plannedDate: targetDate,
        projectId: t.project_id,
      })
    )
  );
  emit('refresh');
};

const onMarkDone = async (task: Task) => {
  await handleMarkTaskDone(task);
  emit('refresh');
};

const activeMenuColId = ref<string | null>(null);

const toggleMenu = (colId: string) => {
  activeMenuColId.value = activeMenuColId.value === colId ? null : colId;
};

const closeMenu = () => {
  activeMenuColId.value = null;
};

onMounted(() => {
  window.addEventListener('click', closeMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenu);
});
</script>

<template>
  <div class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
    <GenericColumn
      v-for="col in timeColumns"
      :key="col.id"
      :id="col.id"
      :title="col.title"
      :tasks="col.tasks"
      :color="col.color"
      :group-name="groupName"
      :compact-cards="true"
      :show-project="showProjectBadge"
      :projects="projects"
      :is-selected="isSelected"
      :is-collapsed="uiStore.isColumnCollapsed(groupName, col.id)"
      :layout="uiStore.getVirtualColumnLayout(groupName, col.id)"
      @mark-done="onMarkDone"
      @card-dropped="handleCardDropped"
      @toggle-select="(task) => emit('toggle-select', task)"
      @toggle-collapse="uiStore.toggleColumnCollapse(groupName, col.id)"
    >
      <template #header="{ classes }">
        <div
          class="px-3 py-2 flex justify-between items-center border-b rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
          :class="[classes.bg, classes.border]"
        >
          <!-- Title & Count Badge -->
          <div class="flex items-center gap-1.5 min-w-0 mr-1">
            <h3 class="font-bold text-sm uppercase tracking-wider truncate" :class="[classes.text]">
              {{ col.title }}
            </h3>
            <span class="text-xs px-1.5 py-0.25 font-bold rounded shrink-0" :class="[classes.badge]">
              {{ col.tasks.length }}
            </span>
          </div>

          <!-- Controls: Layout Selector & Collapse Toggle -->
          <div class="flex items-center shrink-0 gap-1.5">
            <!-- Collapse Button -->
            <button
              @click.stop="uiStore.toggleColumnCollapse(groupName, col.id)"
              class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
              title="Collapse Column"
            >
              <ChevronLeft class="w-4 h-4 shrink-0" />
            </button>

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
                  <div
                    class="px-2.5 py-1 text-[9px] font-bold text-theme-text-muted/65 uppercase tracking-wider border-b border-theme-border/30 mb-0.5 select-none"
                  >
                    Layout
                  </div>
                  <button
                    @click.stop="
                      uiStore.setVirtualColumnLayout(groupName, col.id, 'list');
                      closeMenu();
                    "
                    class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-theme-column/50 transition-colors text-left cursor-pointer w-full"
                    :class="[
                      uiStore.getVirtualColumnLayout(groupName, col.id) === 'list'
                        ? 'text-theme-primary font-semibold bg-theme-primary/10'
                        : 'text-theme-text-muted hover:text-theme-text-main',
                    ]"
                  >
                    <List class="w-3.5 h-3.5 shrink-0" />
                    <span>List</span>
                  </button>
                  <button
                    @click.stop="
                      uiStore.setVirtualColumnLayout(groupName, col.id, 'grid-2');
                      closeMenu();
                    "
                    class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-theme-column/50 transition-colors text-left cursor-pointer w-full"
                    :class="[
                      uiStore.getVirtualColumnLayout(groupName, col.id) === 'grid-2'
                        ? 'text-theme-primary font-semibold bg-theme-primary/10'
                        : 'text-theme-text-muted hover:text-theme-text-main',
                    ]"
                  >
                    <LayoutGrid class="w-3.5 h-3.5 shrink-0" />
                    <span>2 Columns</span>
                  </button>
                  <button
                    @click.stop="
                      uiStore.setVirtualColumnLayout(groupName, col.id, 'grid-3');
                      closeMenu();
                    "
                    class="flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded hover:bg-theme-column/50 transition-colors text-left cursor-pointer w-full"
                    :class="[
                      uiStore.getVirtualColumnLayout(groupName, col.id) === 'grid-3'
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
</template>
