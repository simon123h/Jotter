<script setup lang="ts">
import { ref, computed } from 'vue';
import { marked } from 'marked';
import type { Task } from '../types';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  (e: 'click', task: Task): void;
}>();

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

// Strip markdown tags to show a clean plain text preview snippet
const notesSnippet = computed(() => {
  if (!props.task.body) return '';
  return props.task.body
    .replace(/#+\s+/g, '') // remove headings
    .replace(/[-*]\s+\[[ xX]\]/g, '') // remove checkboxes
    .replace(/[-*]\s+/g, '') // remove bullet points
    .replace(/[`*_]/g, '') // remove bold/italic/code formatting
    .replace(/\s+/g, ' ')
    .trim();
});

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
  isExpanded.value = !isExpanded.value;
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
</script>

<template>
  <div
    class="bg-theme-card border border-theme-border p-3 rounded shadow-sm hover:border-theme-accent hover:shadow-theme-ring transition-all duration-150 cursor-pointer group flex flex-col gap-2 select-none"
    @click="emit('click', task)"
  >
    <!-- Title & ID -->
    <div class="flex justify-between items-start gap-2">
      <h4 class="text-xs font-bold text-theme-text-card group-hover:text-theme-accent transition-colors leading-tight line-clamp-2">
        {{ task.title }}
      </h4>
      <span class="text-[10px] font-mono text-theme-text-muted shrink-0 font-medium bg-theme-column/40 px-1.5 py-0.5 rounded">
        #{{ task.id }}
      </span>
    </div>

    <!-- Tags List -->
    <div v-if="task.tags && task.tags.length" class="flex flex-wrap gap-1 mt-0.5">
      <span
        v-for="tag in task.tags"
        :key="tag"
        class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border"
        :class="getTagClasses(tag)"
      >
        {{ tag }}
      </span>
    </div>

    <!-- Notes Preview Snippet / Expanded Content -->
    <div v-if="hasNotes" class="mt-1 border-t border-theme-border/40 pt-1.5 flex flex-col gap-1.5">
      <!-- Snippet / Expand Toggle Row -->
      <div class="flex items-center justify-between gap-2">
        <!-- Note Snippet -->
        <span v-if="!isExpanded" class="text-[11px] text-theme-text-muted line-clamp-1 break-all flex-grow font-sans italic">
          {{ notesSnippet }}
        </span>
        <span v-else class="text-[10px] font-bold uppercase tracking-wider text-theme-accent font-sans"> Notes Detail </span>

        <!-- Inline Toggle Button -->
        <button
          @click="toggleExpand"
          class="shrink-0 p-0.5 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main rounded transition-colors cursor-pointer"
          :title="isExpanded ? 'Collapse notes' : 'Expand notes'"
        >
          <svg
            class="w-3.5 h-3.5 transform transition-transform"
            :class="{ 'rotate-180': isExpanded }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <!-- Expanded Markdown Content -->
      <div
        v-if="isExpanded"
        class="text-[11px] text-theme-text-card max-h-40 overflow-y-auto scroller-thin p-2 bg-theme-column/30 border border-theme-border/50 rounded prose prose-invert max-w-none break-all"
        @click.stop
        v-html="parsedMarkdown"
      ></div>
    </div>

    <!-- Meta Information Footer (Checklist & Time) -->
    <div class="flex justify-between items-center text-[10px] text-theme-text-muted mt-1 pt-1 border-t border-theme-border/40">
      <!-- Checklist Stats -->
      <div
        v-if="checklistStats"
        class="flex items-center gap-1 font-semibold"
        :class="
          checklistStats.checked === checklistStats.total
            ? 'text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20'
            : 'text-theme-text-muted'
        "
      >
        <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <span>{{ checklistStats.checked }}/{{ checklistStats.total }}</span>
      </div>
      <div v-else></div>
      <!-- spacer if no checklist -->

      <!-- Updated At Caption -->
      <span class="font-mono">{{ new Date(task.updated_at).toLocaleDateString() }}</span>
    </div>
  </div>
</template>

<style scoped>
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
