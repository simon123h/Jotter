<script lang="ts">
  import { ChevronDown, ClipboardList } from '@lucide/svelte';
  import type { Task, Bucket } from '@/types';
  import { useI18n } from '@/composables/useI18n';

  let {
    buckets = [],
    tasksByBucket = {},
    ontaskclick
  } = $props<{
    buckets: Bucket[];
    tasksByBucket: Record<string, Task[]>;
    ontaskclick?: (task: Task) => void;
  }>();

  const { t } = useI18n();

  let collapsedColumns = $state<Record<string, boolean>>({});

  const toggleColumnCollapse = (bucketName: string) => {
    collapsedColumns[bucketName] = !collapsedColumns[bucketName];
  };

  const getChecklistStats = (body: string) => {
    if (!body) return null;
    const matches = body.match(/- \[[ xX]\]/g);
    if (!matches) return null;
    const total = matches.length;
    const checked = (body.match(/- \[[xX]\]/g) || []).length;
    return { checked, total };
  };
</script>

<div class="h-full overflow-y-auto scroller-thin border border-theme-border rounded bg-theme-card/10 w-full">
  <div class="min-w-[800px] w-full border-collapse text-left font-sans text-sm">
    <!-- Table Header -->
    <div
      class="flex items-center bg-theme-column/60 border-b border-theme-border text-xs font-bold uppercase tracking-wider text-theme-text-muted px-3 py-2 select-none sticky top-0 z-10 backdrop-blur-sm"
    >
      <span class="flex-grow min-w-0">{t('table.title')}</span>
      <span class="w-20 shrink-0 text-center">{t('table.progress')}</span>
      <span class="w-52 shrink-0">{t('table.tags')}</span>
    </div>

    <!-- Grouped by bucket -->
    {#each buckets as b (b.name)}
      <div class="border-b border-theme-border last:border-b-0">
        <!-- Group Header -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={() => toggleColumnCollapse(b.name)}
          class="bg-theme-column/25 px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none hover:bg-theme-column/40 border-b border-theme-border/30 text-xs font-bold uppercase tracking-wider text-theme-text-muted"
        >
          <ChevronDown
            class="w-3.5 h-3.5 transform transition-transform text-theme-text-muted animate-duration-150 {collapsedColumns[b.name] ? '-rotate-90' : ''}"
          />
          <span>{t('buckets.' + b.name) || b.title}</span>
          {#if b.subtitle}
            <span
              class="text-xs lowercase italic text-theme-text-muted/60 font-sans tracking-normal ml-1.5 normal-case font-medium"
            >
              &mdash; {b.subtitle}
            </span>
          {/if}
          <span class="px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted rounded text-xs font-bold">
            {tasksByBucket[b.name]?.length || 0}
          </span>
        </div>

        <!-- Group Rows -->
        {#if !collapsedColumns[b.name]}
          <div class="divide-y divide-theme-border/30 bg-theme-card/10">
            {#if !tasksByBucket[b.name] || !tasksByBucket[b.name].length}
              <div class="px-8 py-2 text-theme-text-muted italic text-xs">
                {t('emptyColumnText')}
              </div>
            {:else}
              {#each tasksByBucket[b.name] as task (task.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  onclick={() => ontaskclick?.(task)}
                  class="flex items-center hover:bg-theme-column/20 px-3 py-2 cursor-pointer transition-colors duration-100 gap-3 group"
                >
                  <!-- Task Title + Note snippet -->
                  <div class="flex-grow min-w-0 flex items-baseline gap-2 overflow-hidden">
                    <span class="text-theme-text-card group-hover:text-theme-accent transition-colors truncate">
                      {task.title}
                    </span>
                    {#if task.body}
                      <span class="text-theme-text-muted/60 text-xs truncate italic max-w-[28rem] font-sans">
                        -
                        {task.body
                          .replace(/#+\s+/g, '')
                          .replace(/[-*]\s+\[[ xX]\]/g, '')
                          .replace(/[-*]\s+/g, '')
                          .replace(/[`*_]/g, '')
                          .replace(/\s+/g, ' ')
                          .trim()}
                      </span>
                    {/if}
                  </div>

                  <!-- Checklist Stats -->
                  <div class="w-20 shrink-0 flex items-center justify-center">
                    {#if getChecklistStats(task.body)}
                      <span
                        class="flex items-center gap-1 text-xs font-bold {
                          getChecklistStats(task.body)!.checked === getChecklistStats(task.body)!.total
                            ? 'text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20'
                            : 'text-theme-text-muted'
                        }"
                      >
                        <ClipboardList class="w-3 h-3 shrink-0" />
                        <span>{getChecklistStats(task.body)!.checked}/{getChecklistStats(task.body)!.total}</span>
                      </span>
                    {/if}
                  </div>

                  <!-- Tags -->
                  <div class="w-52 shrink-0 overflow-hidden flex flex-wrap gap-1">
                    {#each task.tags as tag (tag)}
                      <span
                        class="text-xs uppercase font-bold tracking-wider px-1 py-0.5 rounded border bg-theme-column/30 text-theme-text-muted border-theme-border/45"
                      >
                        {tag}
                      </span>
                    {/each}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
