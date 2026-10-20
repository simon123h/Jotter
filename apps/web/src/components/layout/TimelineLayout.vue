<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { Task } from '@/types';
import GenericColumn from '@/components/ui/GenericColumn.vue';
import SnapScroller from '@/components/ui/SnapScroller.vue';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { useBuckets } from '@/composables/useBuckets';
import { ChevronLeft, List, LayoutGrid, Grid, MoreHorizontal } from '@lucide/vue';
import { useSelectionStore } from '@/stores/selection';
import { PLAN_SLOTS, plannedSlot, slotValue, type PlanSlot } from '@jotter/task-filter';

const props = defineProps<{
  tasks: Task[];
  groupName: string;
  showProjectBadge?: boolean;
}>();

const selectionStore = useSelectionStore();

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

const SLOT_COLORS: Record<PlanSlot, string> = {
  slipped: 'pink',
  today: 'red',
  tomorrow: 'orange',
  week: 'yellow',
  month: 'blue',
  later: 'green',
  none: 'slate',
};
const SLOT_TITLES: Record<PlanSlot, string> = {
  slipped: 'plannedDateOptions.slipped',
  today: 'plannedDateOptions.today',
  tomorrow: 'plannedDateOptions.tomorrow',
  week: 'plannedDateOptions.thisWeek',
  month: 'plannedDateOptions.thisMonth',
  later: 'plannedDateOptions.later',
  none: 'plannedDateOptions.notPlanned',
};

// Group tasks into the stretches of time they are planned for; what has slipped only shows when there is something
const timeColumns = computed(() => {
  const groups = Object.fromEntries(PLAN_SLOTS.map((slot) => [slot, [] as Task[]])) as Record<PlanSlot, Task[]>;
  const now = new Date();
  props.tasks.forEach((task) => {
    // Exclude completed or archived tasks
    if (task.bucket === 'done' || task.bucket === 'archive') return;
    groups[plannedSlot(task.planned_date, now)].push(task);
  });

  return PLAN_SLOTS.filter((slot) => slot !== 'slipped' || groups.slipped.length).map((slot) => ({
    id: slot,
    title: t(SLOT_TITLES[slot]),
    tasks: groups[slot],
    color: SLOT_COLORS[slot],
  }));
});

const handleCardDropped = async (payload: { taskId: string; toId: string }) => {
  const slot = payload.toId as PlanSlot;
  // Slipped is where a plan ends up, not somewhere to plan to
  if (slot === 'slipped') return;

  const isSelectedTask = selectionStore.isSelected(payload.taskId);
  const now = new Date();
  // A task already in that stretch keeps its own plan: dropping a Wednesday on "This week" must not widen it to the week
  const tasksToUpdate = (
    isSelectedTask ? props.tasks.filter((t) => selectionStore.isSelected(t.id)) : props.tasks.filter((t) => t.id === payload.taskId)
  ).filter((t) => plannedSlot(t.planned_date, now) !== slot);

  if (tasksToUpdate.length === 0) return;

  const targetDate = slotValue(slot, now);

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
  <SnapScroller>
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
              :title="t('collapseColumnTooltip')"
            >
              <ChevronLeft class="w-4 h-4 shrink-0" />
            </button>

            <!-- Layout Selector Dropdown Menu -->
            <div class="relative flex items-center">
              <button
                @click.stop="toggleMenu(col.id)"
                class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-all duration-200 cursor-pointer"
                :class="{ 'text-theme-text-main bg-theme-card/50': activeMenuColId === col.id }"
                :title="t('layoutOptions.tooltip')"
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
                    {{ t('layoutOptions.label') }}
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
                    <span>{{ t('layoutOptions.list') }}</span>
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
                    <span>{{ t('layoutOptions.grid2') }}</span>
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
                    <span>{{ t('layoutOptions.grid3') }}</span>
                  </button>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </template>
    </GenericColumn>
  </SnapScroller>
</template>
