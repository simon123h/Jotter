<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Check } from '@lucide/vue';
import type { Task } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { useLongPress } from '@/composables/useLongPress';
import { useSelectionStore } from '@/stores/selection';
import { useProjectStore } from '@/stores/project';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { updateTask } from '@/api';
import { toggleChecklistItemInMarkdown } from '@/utils/markdown';
import { parseChecklist } from '@/utils/checklist';
import { getTaskCardTintStyle } from '@/utils/taskColors';
import { triggerDoneParticleBurst } from '@/utils/effects';
import { triggerMediumHaptic } from '@/utils/haptics';
import TaskCardChecklist from '@/components/ui/task-card/TaskCardChecklist.vue';
import TaskCardFooter from '@/components/ui/task-card/TaskCardFooter.vue';

const { t } = useI18n();
const selectionStore = useSelectionStore();
const projectStore = useProjectStore();
const timeblockStore = useTimeblockStore();
const route = useRoute();
const router = useRouter();

const props = withDefaults(
  defineProps<{
    task: Task;
    showTags?: boolean;
    showDoneButton?: boolean;
    showFooter?: boolean;
    allowExpand?: boolean;
    compact?: boolean;
    showProject?: boolean;
    maxNestingLevel?: number;
  }>(),
  {
    showTags: true,
    showDoneButton: true,
    showFooter: true,
    allowExpand: true,
    compact: false,
    showProject: false,
    maxNestingLevel: 0,
  }
);

const emit = defineEmits<{
  (e: 'click', task: Task): void;
  (e: 'mark-done', task: Task): void;
  (e: 'toggle-select', task: Task): void;
}>();

const allocatedTimeblock = computed(() => timeblockStore.timeblockForTask(props.task.id));

const projectTitle = computed(() => {
  const proj = projectStore.projects.find((p) => p.id === props.task.project_id);
  return proj ? proj.title : props.task.project_id;
});

const isSelected = computed(() => selectionStore.isSelected(props.task.id));
const selectionCount = computed(() => selectionStore.selectionCount);

// Long-press toggles selection on touch devices
const { isLongPressTriggered, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = useLongPress(() => {
  triggerMediumHaptic();
  emit('toggle-select', props.task);
});

const handleCardClick = (e: MouseEvent) => {
  if (isLongPressTriggered.value) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (selectionCount.value > 0) {
    e.preventDefault();
    e.stopPropagation();
    emit('toggle-select', props.task);
    return;
  }
  emit('click', props.task);
};

const handleMarkDone = (e: MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();

  const target = (e.currentTarget as HTMLElement) || (e.target as HTMLElement);
  if (target && target.getBoundingClientRect) {
    const rect = target.getBoundingClientRect();
    triggerDoneParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  } else {
    triggerDoneParticleBurst(e.clientX, e.clientY);
  }

  emit('mark-done', props.task);
};

const targetRoute = computed(() => {
  const viewMode = String(route?.name || '').replace('-task', '') || 'board';
  return {
    name: `${viewMode}-task`,
    params: {
      projectId: route?.params?.projectId === 'all' ? 'all' : props.task.project_id,
      taskId: String(props.task.id),
    },
    query: route?.query || {},
  };
});

const checklist = computed(() => parseChecklist(props.task.body, props.maxNestingLevel));
// When the checklist is shown inside the card, its progress is drawn there instead of in the footer
const showChecklistInCard = computed(() => !props.compact && checklist.value.items.length > 0);

const toggleChecklistItem = async (targetIndex: number, isChecked: boolean) => {
  const newBody = toggleChecklistItemInMarkdown(props.task.body, targetIndex, isChecked);

  try {
    await updateTask(props.task.project_id, props.task.id, { body: newBody });
    await projectStore.invalidate();
  } catch (err: any) {
    console.error('Failed to update task checklist:', err);
  }
};

const cardStyle = computed(() => getTaskCardTintStyle(props.task.color));

const handleTagClick = (tag: string) => {
  router.replace({
    query: {
      ...route.query,
      tags: tag.trim().toLowerCase(),
    },
  });
};
</script>

<template>
  <router-link
    :to="selectionCount > 0 ? '' : targetRoute"
    :data-task-id="task.id"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
    @click="handleCardClick"
    class="task-card bg-theme-card border border-theme-border rounded shadow-sm hover:border-theme-accent hover:shadow-theme-ring transition-all duration-150 cursor-pointer group flex flex-col select-none relative no-underline text-inherit"
    :class="[
      { 'colored-card': task.color },
      { 'ring-2 ring-theme-accent border-theme-accent bg-theme-accent/5 shadow-theme-ring is-selected': isSelected },
      compact ? 'p-2 gap-1' : 'p-3 gap-2',
    ]"
    :style="cardStyle"
  >
    <!-- Multi-select Checkbox (Hover, Selected, or Selection Mode Active) -->
    <div
      @click.stop.prevent="emit('toggle-select', task)"
      class="absolute -left-2 -top-2 w-5 h-5 rounded-full border-2 bg-theme-card transition-all z-30 flex items-center justify-center cursor-pointer"
      :class="[
        isSelected
          ? 'border-theme-accent bg-theme-accent scale-110 opacity-100 shadow-lg'
          : selectionCount > 0
            ? 'border-theme-border opacity-70 hover:opacity-100 hover:border-theme-accent hover:scale-105'
            : 'border-theme-border opacity-0 group-hover:opacity-100 hover:border-theme-accent hover:scale-105',
      ]"
    >
      <Check v-if="isSelected" class="w-3 h-3 stroke-[3px]" />
    </div>

    <!-- Multi-drag Badge -->
    <div
      v-if="isSelected && selectionCount > 1"
      class="task-drag-badge absolute -top-2 -right-2 bg-theme-accent text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-lg border border-theme-card z-40"
    >
      +{{ selectionCount - 1 }}
    </div>

    <!-- Title & ID -->
    <div class="flex justify-between items-start gap-2">
      <div class="flex flex-col gap-0.5 overflow-hidden">
        <span v-if="showProject && projectTitle" class="text-[9px] font-bold uppercase tracking-widest text-theme-accent/70 truncate">
          {{ projectTitle }}
        </span>
        <h4
          class="text-theme-text-card group-hover:text-theme-accent transition-colors leading-tight line-clamp-2"
          :class="compact ? 'text-xs' : 'text-sm'"
        >
          {{ task.title }}
        </h4>
      </div>
      <div class="flex items-center gap-1 shrink-0 -m-2">
        <!-- Action Buttons (Always visible on mobile/touch, hover on desktop) -->
        <div class="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <!-- Mark Done Button -->
          <button
            v-if="showDoneButton && task.bucket !== 'done'"
            @click.stop.prevent="handleMarkDone($event)"
            class="p-1 text-theme-text-muted hover:text-emerald-400 hover:bg-theme-column rounded transition-colors cursor-pointer"
            :title="t('taskCard.markDone')"
          >
            <Check :class="compact ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'" class="shrink-0" />
          </button>
        </div>
      </div>
    </div>

    <!-- Checklist Items (Directly below the title) -->
    <TaskCardChecklist v-if="showChecklistInCard" :items="checklist.items" :stats="checklist.stats" @toggle="toggleChecklistItem" />

    <!-- Tags, dates, priority, attachments and timeblock badge -->
    <TaskCardFooter
      v-if="showFooter"
      :task="task"
      :compact="compact"
      :show-tags="showTags"
      :checklist-stats="checklist.stats"
      :show-checklist-stats="!showChecklistInCard"
      :allocated-timeblock="allocatedTimeblock"
      @tag-click="handleTagClick"
    />
  </router-link>
</template>

<style scoped>
.colored-card:hover {
  border-color: var(--card-tint) !important;
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-tint) 30%, transparent) !important;
}

/* Inline markdown rendering tweaks inside card */
:deep(ul) {
  list-style-type: disc;
  padding-left: 1rem;
  margin-bottom: 0.25rem;
}
:deep(ol) {
  list-style-type: decimal;
  padding-left: 1rem;
  margin-bottom: 0.25rem;
}
:deep(p) {
  margin-bottom: 0.25rem;
  line-height: 1.4;
}
:deep(a) {
  color: var(--theme-accent);
  text-decoration: underline;
}
:deep(code) {
  background-color: var(--theme-bg-card);
  padding: 0.05rem 0.15rem;
  border-radius: 0.125rem;
  font-family: monospace;
}
:deep(input[type='checkbox']) {
  accent-color: var(--theme-primary);
  margin-right: 0.25rem;
  transform: translateY(1px);
}
</style>
