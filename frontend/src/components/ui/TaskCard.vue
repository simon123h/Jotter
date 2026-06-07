<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { marked } from 'marked';
import { ChevronDown, ClipboardList, Check, Calendar } from '@lucide/vue';
import type { Task } from '@/types';
import { useI18n } from '@/composables/useI18n';

const { t, locale } = useI18n();

const props = withDefaults(
  defineProps<{
    task: Task;
    showTags?: boolean;
    showDoneButton?: boolean;
    showFooter?: boolean;
    allowExpand?: boolean;
    compact?: boolean;
    showProject?: boolean;
    projectTitle?: string;
    isSelected?: boolean;
  }>(),
  {
    showTags: true,
    showDoneButton: true,
    showFooter: true,
    allowExpand: true,
    compact: false,
    showProject: false,
    isSelected: false,
  }
);

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
    params: { projectId: props.task.project_id, taskId: String(props.task.id) },
    query: route?.query || {},
  };
});

const isExpanded = ref(false);

// Checklist statistics
const checklistStats = computed(() => {
  if (!props.task.body) return null;
  const matches = props.task.body.match(/- \[[ xX]\]/g);
  if (!matches) return null;
  const total = matches.length;
  const checked = (props.task.body.match(/- \[[xX]\]/g) || []).length;
  return { checked, total };
});

const hasNotes = computed(() => !!props.task.body);

const parsedMarkdown = computed(() => {
  if (!props.task.body) return '';
  try {
    return marked.parse(props.task.body);
  } catch {
    return props.task.body;
  }
});

const toggleExpand = (event: Event) => {
  event.stopPropagation();
  if (props.allowExpand) {
    isExpanded.value = !isExpanded.value;
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
    class="bg-theme-card border border-theme-border rounded shadow-sm hover:border-theme-accent hover:shadow-theme-ring transition-all duration-150 cursor-pointer group flex flex-col select-none relative no-underline text-inherit"
    :class="[
      { 'colored-card': task.color },
      { 'ring-2 ring-theme-accent border-theme-accent bg-theme-accent/5 shadow-theme-ring': isSelected },
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
        class="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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

    <!-- Tags List -->
    <div v-if="showTags && task.tags && task.tags.length" class="flex flex-wrap gap-1 mt-0.5">
      <span
        v-for="tag in task.tags"
        :key="tag"
        class="uppercase font-bold tracking-wider rounded border"
        :class="[getTagClasses(tag), compact ? 'text-[9px] px-1 py-0' : 'text-xs px-1.5 py-0.5']"
      >
        {{ tag }}
      </span>
    </div>

    <!-- Combined Footer Row: Due Date, Priority, Checklist, and Chevron -->
    <div
      v-if="showFooter && (task.due_date || task.planned_date || task.priority || checklistStats || hasNotes)"
      class="flex justify-between items-center text-xs text-theme-text-muted select-none"
      :class="compact ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'"
    >
      <!-- Left side: Due Date & Priority -->
      <div class="flex items-center gap-2.5">
        <div v-if="task.due_date" class="flex items-center gap-1 text-theme-text-muted" :title="'Due: ' + formatDate(task.due_date)">
          <Calendar :class="compact ? 'w-3 h-3' : 'w-3.5 h-3.5'" class="shrink-0" />
          <span :class="{ 'text-[10px]': compact }">{{ formatDate(task.due_date) }}</span>
        </div>
        <div
          v-if="task.planned_date"
          class="flex items-center gap-1 text-theme-accent/80"
          :title="'Planned: ' + t('plannedDateOptions.' + task.planned_date)"
        >
          <span class="font-bold text-[10px]" :class="{ 'text-[8px]': compact }">P:</span>
          <span :class="{ 'text-[10px]': compact }">{{ t('plannedDateOptions.' + task.planned_date) }}</span>
        </div>
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
      </div>

      <!-- Right side: Checklist & Chevron -->
      <div class="flex items-center gap-2.5">
        <!-- Checklist Stats -->
        <div
          v-if="checklistStats"
          @click.stop.prevent="toggleExpand"
          class="flex items-center gap-1 font-semibold"
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

        <!-- Inline Toggle Button -->
        <button
          v-if="allowExpand && hasNotes"
          @click.stop.prevent="toggleExpand"
          class="p-0.5 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main rounded transition-colors cursor-pointer"
          :title="isExpanded ? t('taskCard.collapseNotes') : t('taskCard.expandNotes')"
        >
          <ChevronDown
            class="transform transition-transform animate-duration-150"
            :class="[{ 'rotate-180': isExpanded }, compact ? 'w-3.5 h-3.5' : 'w-4 h-4']"
          />
        </button>
      </div>
    </div>

    <!-- Expanded Markdown Content -->
    <div
      v-if="allowExpand && hasNotes && isExpanded"
      class="text-xs max-h-40 overflow-y-auto scroller-thin p-0.5 pt-2 border-t border-theme-border/40"
      @click.stop
      v-html="parsedMarkdown"
    ></div>
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
