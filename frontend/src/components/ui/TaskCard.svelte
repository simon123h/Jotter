<script lang="ts">
  import { marked } from 'marked';
  import { ChevronDown, ClipboardList, Check, Calendar } from '@lucide/svelte';
  import type { Task } from '@/types';
  import { useI18n } from '@/composables/useI18n';

  let { task, onclick, onmarkdone } = $props<{
    task: Task;
    onclick?: (task: Task) => void;
    onmarkdone?: (task: Task) => void;
  }>();

  const { t } = useI18n();

  let isExpanded = $state(false);

  const checklistStats = $derived.by(() => {
    if (!task.body) return null;
    const matches = task.body.match(/- \[[ xX]\]/g);
    if (!matches) return null;
    const total = matches.length;
    const checked = (task.body.match(/- \[[xX]\]/g) || []).length;
    return { checked, total };
  });

  const hasNotes = $derived(!!task.body);

  const parsedMarkdown = $derived.by(() => {
    if (!task.body) return '';
    try {
      return marked.parse(task.body);
    } catch {
      return task.body;
    }
  });

  const toggleExpand = (event: Event) => {
    event.stopPropagation();
    isExpanded = !isExpanded;
  };

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
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  const cardStyle = $derived.by(() => {
    let styles = '';
    if (task.color && colorMap[task.color]) {
      const hexColor = colorMap[task.color];
      styles += `--card-tint: ${hexColor}; `;
      styles += `background-color: color-mix(in srgb, ${hexColor} 20%, var(--theme-bg-card)); `;
      styles += `border-color: color-mix(in srgb, ${hexColor} 40%, var(--theme-border));`;
    }
    return styles;
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="bg-theme-card border border-theme-border p-3 rounded shadow-sm hover:border-theme-accent hover:shadow-theme-ring transition-all duration-150 cursor-pointer group flex flex-col gap-2 select-none {task.color ? 'colored-card' : ''}"
  style={cardStyle}
  onclick={() => onclick?.(task)}
>
  <!-- Title & ID -->
  <div class="flex justify-between items-start gap-2">
    <h4 class="text-sm text-theme-text-card group-hover:text-theme-accent transition-colors leading-tight line-clamp-2">
      {task.title}
    </h4>
    {#if task.bucket !== 'done'}
      <div
        class="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <!-- Mark Done Button -->
        <button
          onclick={(e) => { e.stopPropagation(); onmarkdone?.(task); }}
          class="p-1 text-theme-text-muted hover:text-emerald-400 hover:bg-theme-column rounded transition-colors cursor-pointer"
          title={t('taskCard.markDone')}
        >
          <Check class="w-4.5 h-4.5 shrink-0" />
        </button>
      </div>
    {/if}
  </div>

  <!-- Tags List -->
  {#if task.tags && task.tags.length}
    <div class="flex flex-wrap gap-1 mt-0.5">
      {#each task.tags as tag (tag)}
        <span
          class="text-xs uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border {getTagClasses(tag)}"
        >
          {tag}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Combined Footer Row: Due Date, Priority, Checklist, and Chevron -->
  {#if task.due_date || task.priority || checklistStats || hasNotes}
    <div
      class="flex justify-between items-center text-xs text-theme-text-muted mt-1.5 pt-1.5 select-none"
    >
      <!-- Left side: Due Date & Priority -->
      <div class="flex items-center gap-2.5">
        {#if task.due_date}
          <div class="flex items-center gap-1 text-theme-text-muted">
            <Calendar class="w-3.5 h-3.5 shrink-0" />
            <span>{formatDate(task.due_date)}</span>
          </div>
        {/if}
        {#if task.priority}
          <div
            class="px-1.5 py-0.25 rounded border text-[10px] font-extrabold uppercase tracking-wider leading-none {getPriorityClasses(task.priority)}"
          >
            {task.priority}
          </div>
        {/if}
      </div>

      <!-- Right side: Checklist & Chevron -->
      <div class="flex items-center gap-2.5">
        <!-- Checklist Stats -->
        {#if checklistStats}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={toggleExpand}
            class="flex items-center gap-1 font-semibold {
              checklistStats.checked === checklistStats.total
                ? 'text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20'
                : 'text-theme-text-muted'
            }"
          >
            <ClipboardList class="w-3.5 h-3.5 shrink-0" />
            <span>{checklistStats.checked}/{checklistStats.total}</span>
          </div>
        {/if}

        <!-- Inline Toggle Button -->
        {#if hasNotes}
          <button
            onclick={toggleExpand}
            class="p-0.5 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main rounded transition-colors cursor-pointer"
            title={isExpanded ? t('taskCard.collapseNotes') : t('taskCard.expandNotes')}
          >
            <ChevronDown class="w-4 h-4 transform transition-transform animate-duration-150 {isExpanded ? 'rotate-180' : ''}" />
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Expanded Markdown Content -->
  {#if hasNotes && isExpanded}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="text-xs max-h-40 overflow-y-auto scroller-thin p-0.5 pt-2 border-t border-theme-border/40 card-markdown"
      onclick={(e) => e.stopPropagation()}
    >
      {@html parsedMarkdown}
    </div>
  {/if}
</div>

<style>
.colored-card:hover {
  border-color: var(--card-tint) !important;
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-tint) 30%, transparent) !important;
}

/* Inline markdown rendering tweaks inside card */
.card-markdown :global(ul) {
  list-style-type: disc;
  padding-left: 1rem;
  margin-bottom: 0.25rem;
}
.card-markdown :global(ol) {
  list-style-type: decimal;
  padding-left: 1rem;
  margin-bottom: 0.25rem;
}
.card-markdown :global(p) {
  margin-bottom: 0.25rem;
  line-height: 1.4;
}
.card-markdown :global(a) {
  color: var(--theme-accent);
  text-decoration: underline;
}
.card-markdown :global(code) {
  background-color: var(--theme-bg-card);
  padding: 0.05rem 0.15rem;
  border-radius: 0.125rem;
  font-family: monospace;
}
.card-markdown :global(input[type='checkbox']) {
  accent-color: var(--theme-primary);
  margin-right: 0.25rem;
  transform: translateY(1px);
}
</style>
