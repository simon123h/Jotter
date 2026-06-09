<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ClipboardList, Check, Calendar, Clock } from '@lucide/vue';
import type { Task } from '@/types';
import { useI18n } from '@/composables/useI18n';
import { useSelectionStore } from '@/stores/selection';
import { useProjectStore } from '@/stores/project';
import { updateTask } from '@/api';

const { t, locale } = useI18n();
const selectionStore = useSelectionStore();
const projectStore = useProjectStore();

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

const projectTitle = computed(() => {
  const proj = projectStore.projects.find((p) => p.id === props.task.project_id);
  return proj ? proj.title : props.task.project_id;
});

const isSelected = computed(() => selectionStore.isSelected(props.task.id));
const selectionCount = computed(() => selectionStore.selectionCount);

const emit = defineEmits<{
  (e: 'click', task: Task): void;
  (e: 'mark-done', task: Task): void;
  (e: 'toggle-select', task: Task): void;
}>();

const route = useRoute();
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

// Checklist statistics
const checklistStats = computed(() => {
  if (!props.task.body) return null;
  const matches = props.task.body.match(/- \[[ xX]\]/g);
  if (!matches) return null;
  const total = matches.length;
  const checked = (props.task.body.match(/- \[[xX]\]/g) || []).length;
  return { checked, total };
});

interface RenderedChecklistItem {
  label: string;
  checked: boolean;
  globalIndex: number;
  level: number;
}

const renderedChecklist = computed<RenderedChecklistItem[]>(() => {
  if (!props.task.body) return [];
  const lines = props.task.body.split('\n');
  const items: RenderedChecklistItem[] = [];
  let globalIndex = 0;

  for (const line of lines) {
    // Check if it's a checklist item (any indentation)
    const checklistMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      const leadingSpaces = checklistMatch[1];
      const checked = checklistMatch[2].toLowerCase() === 'x';
      const label = checklistMatch[3].trim();

      // Calculate nesting level based on leading spaces (2 spaces or tabs per level)
      const normalizedSpaces = leadingSpaces.replace(/\t/g, '  ');
      const level = Math.floor(normalizedSpaces.length / 2);

      if (level <= props.maxNestingLevel) {
        items.push({
          label,
          checked,
          globalIndex,
          level,
        });
      }
      globalIndex++;
    }
  }
  return items;
});

const toggleChecklistItem = async (targetIndex: number, isChecked: boolean) => {
  let currentIndex = 0;
  const regex = /(^|\n)(\s*[-*+]\s+\[)([ xX])(\])/g;

  const newBody = props.task.body.replace(regex, (match, p1, p2, _p3, p4) => {
    if (currentIndex === targetIndex) {
      currentIndex++;
      const newChar = isChecked ? 'x' : ' ';
      return p1 + p2 + newChar + p4;
    }
    currentIndex++;
    return match;
  });

  try {
    await updateTask(props.task.project_id, props.task.id, {
      body: newBody,
    });
    await projectStore.invalidate();
  } catch (err: any) {
    console.error('Failed to update task checklist:', err);
  }
};

// Helper to assign a consistent, pleasant color theme to each tag (matching the professional theme)
const getTagClasses = (tag: string) => {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const themes = [
    'bg-theme-accent/10 text-theme-accent border-theme-accent/20',
    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ];
  return themes[hash % themes.length];
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getPriorityClasses = (prio: string) => {
  switch (prio) {
    case 'low':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'urgent':
      return 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
};

const colorMap: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
};

const cardStyle = computed(() => {
  const styles: Record<string, string> = {};
  if (props.task.color && colorMap[props.task.color]) {
    const hexColor = colorMap[props.task.color];
    styles['--card-tint'] = hexColor;
    styles['background-color'] = `color-mix(in srgb, ${hexColor} 20%, var(--theme-bg-card))`;
    styles['border-color'] = `color-mix(in srgb, ${hexColor} 40%, var(--theme-border))`;
  }
  return styles;
});
</script>

<template>
  <router-link
    :to="targetRoute"
    :data-task-id="task.id"
    class="task-card bg-theme-card border border-theme-border rounded shadow-sm hover:border-theme-accent hover:shadow-theme-ring transition-all duration-150 cursor-pointer group flex flex-col select-none relative no-underline text-inherit"
    :class="[
      { 'colored-card': task.color },
      { 'ring-2 ring-theme-accent border-theme-accent bg-theme-accent/5 shadow-theme-ring is-selected': isSelected },
      compact ? 'p-2 gap-1' : 'p-3 gap-2',
    ]"
    :style="cardStyle"
  >
    <!-- Multi-select Checkbox (Hover or Selected) -->
    <div
      @click.stop.prevent="emit('toggle-select', task)"
      class="absolute -left-2 -top-2 w-5 h-5 rounded-full border-2 bg-theme-card transition-all z-30 flex items-center justify-center cursor-pointer"
      :class="[
        isSelected
          ? 'border-theme-accent bg-theme-accent scale-110 opacity-100 shadow-lg'
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
      <div
        v-if="showDoneButton && task.bucket !== 'done'"
        class="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -m-2"
      >
        <!-- Mark Done Button -->
        <button
          @click.stop.prevent="emit('mark-done', task)"
          class="p-1 text-theme-text-muted hover:text-emerald-400 hover:bg-theme-column rounded transition-colors cursor-pointer"
          :title="t('taskCard.markDone')"
        >
          <Check :class="compact ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'" class="shrink-0" />
        </button>
      </div>
    </div>

    <!-- Checklist Items (Directly below the title) -->
    <div
      v-if="!compact && renderedChecklist.length > 0"
      class="task-card-checklist flex flex-col gap-1.5 mt-1 pt-2 border-t border-theme-border/20 relative pr-14"
      @click.stop
    >
      <!-- Floating Checklist Stats at top-right corner of the checklist bounding box -->
      <div
        v-if="checklistStats"
        class="absolute top-2 right-0 flex items-center gap-1 font-semibold pointer-events-none select-none"
        :class="[
          checklistStats.checked === checklistStats.total
            ? 'text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20'
            : 'text-theme-text-muted',
        ]"
      >
        <ClipboardList class="w-3.5 h-3.5 shrink-0" />
        <span class="text-xs">{{ checklistStats.checked }}/{{ checklistStats.total }}</span>
      </div>

      <label
        v-for="item in renderedChecklist"
        :key="item.globalIndex"
        class="flex items-start gap-2 text-xs text-theme-text-card cursor-pointer hover:text-theme-text-main transition-colors select-none"
        :class="{ 'line-through text-theme-text-muted/60': item.checked }"
        :style="{ paddingLeft: `${item.level * 16}px` }"
      >
        <input
          type="checkbox"
          :checked="item.checked"
          @click.stop.prevent="toggleChecklistItem(item.globalIndex, !item.checked)"
          class="mt-0.5 rounded border-theme-border text-theme-accent focus:ring-theme-accent/30 cursor-pointer"
        />
        <span class="leading-snug break-words">{{ item.label }}</span>
      </label>
    </div>

    <!-- Flexible Combined Row: Tags, Due Date, Planned Date, Priority, and List Counter (when compact or no visible list items) -->
    <div
      v-if="
        showFooter &&
        (task.due_date ||
          task.planned_date ||
          task.priority ||
          (showTags && task.tags && task.tags.length) ||
          (checklistStats && (compact || renderedChecklist.length === 0)))
      "
      class="flex flex-wrap items-center gap-2 text-xs text-theme-text-muted select-none mt-1"
    >
      <!-- Tags List inside the combined flexible row -->
      <div v-if="showTags && task.tags && task.tags.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in task.tags"
          :key="tag"
          class="rounded border uppercase tracking-wider leading-none"
          :class="[getTagClasses(tag), compact ? 'text-[8px] px-1 py-0.25 font-bold' : 'text-[10px] px-1.5 py-0.25 font-extrabold']"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Due Date -->
      <div v-if="task.due_date" class="flex items-center gap-1 text-theme-text-muted" :title="'Due: ' + formatDate(task.due_date)">
        <Calendar :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
        <span :class="{ 'text-[10px]': compact }">{{ formatDate(task.due_date) }}</span>
      </div>

      <!-- Planned date -->
      <div
        v-if="task.planned_date"
        class="flex items-center gap-1 text-theme-accent/80"
        :title="'Planned: ' + t('plannedDateOptions.' + task.planned_date)"
      >
        <Clock class="w-3 h-3" />
        <span :class="{ 'text-[10px]': compact }">{{ t('plannedDateOptions.' + task.planned_date) }}</span>
      </div>

      <!-- Priority -->
      <div
        v-if="task.priority"
        class="rounded border uppercase tracking-wider leading-none"
        :class="[
          getPriorityClasses(task.priority),
          compact ? 'text-[8px] px-1 py-0.25 font-bold' : 'text-[10px] px-1.5 py-0.25 font-extrabold',
        ]"
      >
        {{ task.priority }}
      </div>

      <!-- Checklist Stats (Only displayed in footer row if not already shown inside the checklist bounding box) -->
      <div
        v-if="checklistStats && (compact || renderedChecklist.length === 0)"
        class="flex items-center gap-1 font-semibold ml-auto"
        :class="[
          checklistStats.checked === checklistStats.total
            ? 'text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20'
            : 'text-theme-text-muted',
          { 'text-[10px]': compact },
        ]"
      >
        <ClipboardList :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
        <span>{{ checklistStats.checked }}/{{ checklistStats.total }}</span>
      </div>
    </div>
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
