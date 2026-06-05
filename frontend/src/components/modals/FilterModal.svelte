<script lang="ts">
  import { X, SlidersHorizontal, Calendar, Tag, Trash2 } from '@lucide/svelte';
  import { useI18n } from '@/composables/useI18n';
  import { settingsStore } from '@/stores/settings';
  import type { Bucket, TaskFilterParams } from '@/types';
  import { tick } from 'svelte';

  let {
    isOpen,
    buckets = [],
    allTags = [],
    currentFilters = {},
    onclose,
    onapply
  } = $props<{
    isOpen: boolean;
    buckets: Bucket[];
    allTags: string[];
    currentFilters: TaskFilterParams;
    onclose?: () => void;
    onapply?: (filters: TaskFilterParams) => void;
  }>();

  const { t } = useI18n();

  let dialogRef = $state<HTMLDialogElement | null>(null);

  // Local state for filters
  let search = $state('');
  let selectedBuckets = $state<string[]>([]);
  let selectedPriorities = $state<string[]>([]);
  let selectedTags = $state<string[]>([]);
  let tagMode = $state<'any' | 'all'>('any');
  let dueDateStatus = $state<'all' | 'has' | 'none'>('all');
  let dueAfter = $state('');
  let dueBefore = $state('');
  let hideDoneColumnLocal = $state(false);

  $effect(() => {
    if (isOpen) {
      search = currentFilters.search || '';

      selectedBuckets = currentFilters.buckets
        ? currentFilters.buckets
            .split(',')
            .map((b) => b.trim())
            .filter(Boolean)
        : [];

      selectedPriorities = currentFilters.priorities
        ? currentFilters.priorities
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : [];

      selectedTags = currentFilters.tags
        ? currentFilters.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      tagMode = currentFilters.tag_mode || 'any';

      if (currentFilters.has_due_date === true) {
        dueDateStatus = 'has';
      } else if (currentFilters.has_due_date === false) {
        dueDateStatus = 'none';
      } else {
        dueDateStatus = 'all';
      }

      dueAfter = currentFilters.due_after || '';
      dueBefore = currentFilters.due_before || '';
      hideDoneColumnLocal = settingsStore.hideDoneColumn;

      tick().then(() => {
        if (dialogRef && !dialogRef.open) {
          dialogRef.showModal();
        }
      });
    } else {
      tick().then(() => {
        if (dialogRef && dialogRef.open) {
          dialogRef.close();
        }
      });
    }
  });

  const handleClose = () => {
    onclose?.();
  };

  const handleClear = () => {
    search = '';
    selectedBuckets = [];
    selectedPriorities = [];
    selectedTags = [];
    tagMode = 'any';
    dueDateStatus = 'all';
    dueAfter = '';
    dueBefore = '';
    hideDoneColumnLocal = false;
  };

  const handleApply = () => {
    let has_due_date: boolean | null = null;
    if (dueDateStatus === 'has') has_due_date = true;
    else if (dueDateStatus === 'none') has_due_date = false;

    const filters: TaskFilterParams = {
      search: search.trim() || undefined,
      buckets: selectedBuckets.length ? selectedBuckets.join(',') : undefined,
      priorities: selectedPriorities.length ? selectedPriorities.join(',') : undefined,
      tags: selectedTags.length ? selectedTags.join(',') : undefined,
      tag_mode: selectedTags.length ? tagMode : undefined,
      has_due_date,
      due_after: dueDateStatus !== 'none' && dueAfter ? dueAfter : undefined,
      due_before: dueDateStatus !== 'none' && dueBefore ? dueBefore : undefined,
    };

    settingsStore.hideDoneColumn = hideDoneColumnLocal;

    onapply?.(filters);
    onclose?.();
  };

  const handleNativeClose = () => {
    onclose?.();
  };

  const handleDialogClick = (event: MouseEvent) => {
    if (event.target !== dialogRef) return;
    const rect = dialogRef.getBoundingClientRect();
    const isDialogContent =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isDialogContent) {
      onclose?.();
    }
  };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialogRef}
  onclose={handleNativeClose}
  onclick={handleDialogClick}
  class="bg-theme-base border border-theme-border rounded-lg shadow-2xl p-0 max-w-3xl w-full max-h-[90vh] focus:outline-none overflow-hidden"
>
  <!-- Header -->
  <div class="px-4 py-3 border-b border-theme-border flex justify-between items-center bg-theme-card/50">
    <h3 class="text-sm font-bold text-theme-text-main uppercase tracking-wider flex items-center gap-1.5">
      <SlidersHorizontal class="w-4 h-4 shrink-0 text-theme-accent" />
      {t('filterModal.title')}
    </h3>
    <button
      onclick={handleClose}
      class="text-theme-text-muted hover:text-theme-text-main transition-colors p-1 hover:bg-theme-card rounded cursor-pointer"
    >
      <X class="w-4 h-4 shrink-0" />
    </button>
  </div>

  <!-- Body -->
  <div class="flex-grow p-6 overflow-y-auto max-h-[70vh] scroller-thin">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Search Input (Full Width) -->
      <div class="md:col-span-2">
        <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="searchInput">
          {t('filterModal.searchLabel')}
        </label>
        <input
          id="searchInput"
          bind:value={search}
          type="text"
          placeholder={t('filterModal.searchPlaceholder')}
          class="w-full bg-theme-card border border-theme-border rounded px-3 py-2 text-sm text-theme-text-input placeholder-theme-text-muted/40 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary"
        />
      </div>

      <!-- Columns/Buckets Filter (Full Width) -->
      {#if buckets.length}
        <div class="md:col-span-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="columnsSelect">
            {t('filterModal.columnsLabel')}
          </label>
          <div id="columnsSelect" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {#each buckets as b (b.name)}
              <label
                class="flex items-center gap-2 px-3 py-2 rounded border border-theme-border/50 bg-theme-card/30 hover:bg-theme-column/30 transition-all cursor-pointer text-xs text-theme-text-main"
              >
                <input type="checkbox" value={b.name} bind:group={selectedBuckets} class="accent-theme-primary" />
                <span class="truncate" title={b.title}>{b.title}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Left Column: Priorities & Due Date Section -->
      <div class="space-y-6">
        <!-- Priorities Filter -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="prioritiesSelect">
            {t('filterModal.prioritiesLabel')}
          </label>
          <div id="prioritiesSelect" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {#each ['none', 'low', 'medium', 'high', 'urgent'] as p (p)}
              <label
                class="flex items-center gap-2 px-2.5 py-1.5 rounded border border-theme-border/50 bg-theme-card/30 hover:bg-theme-column/30 transition-all cursor-pointer text-xs text-theme-text-main"
              >
                <input type="checkbox" value={p} bind:group={selectedPriorities} class="accent-theme-primary" />
                <span>{t(`priorityOptions.${p}`)}</span>
              </label>
            {/each}
          </div>
        </div>

        <!-- Due Date Section -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="dueDateStatusSelect">
            {t('filterModal.dueDateLabel')}
          </label>

          <div id="dueDateStatusSelect" class="flex items-center gap-2 bg-theme-card border border-theme-border/50 rounded p-1 mb-3">
            {#each ['all', 'has', 'none'] as status (status)}
              <label
                class="flex-1 text-center py-1 rounded text-xs font-semibold cursor-pointer transition-all select-none {
                  dueDateStatus === status ? 'bg-theme-primary text-white font-bold' : 'text-theme-text-muted hover:text-theme-text-main'
                }"
              >
                <input type="radio" value={status} bind:group={dueDateStatus} class="hidden" />
                {t(`filterModal.dueDate${status.charAt(0).toUpperCase() + status.slice(1)}`)}
              </label>
            {/each}
          </div>

          <!-- Date ranges, only editable if not 'none' -->
          {#if dueDateStatus !== 'none'}
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1 flex items-center gap-1" for="dueAfterInput">
                  <Calendar class="w-3 h-3 text-theme-text-muted" />
                  {t('filterModal.dueAfterLabel')}
                </label>
                <input
                  id="dueAfterInput"
                  bind:value={dueAfter}
                  type="date"
                  class="w-full bg-theme-card border border-theme-border rounded px-2 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                />
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1 flex items-center gap-1" for="dueBeforeInput">
                  <Calendar class="w-3 h-3 text-theme-text-muted" />
                  {t('filterModal.dueBeforeLabel')}
                </label>
                <input
                  id="dueBeforeInput"
                  bind:value={dueBefore}
                  type="date"
                  class="w-full bg-theme-card border border-theme-border rounded px-2 py-1.5 text-xs text-theme-text-input focus:outline-none focus:border-theme-primary"
                />
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Right Column: Tags & Layout Options -->
      <div class="space-y-6">
        <!-- Tags Filter -->
        {#if allTags.length}
          <div>
            <div class="flex justify-between items-center mb-1.5">
              <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted" for="tagsSelect">
                {t('filterModal.tagsLabel')}
              </label>

              <!-- Tag matching mode selection -->
              <div class="flex items-center gap-2 bg-theme-card border border-theme-border/50 rounded p-0.5 text-[10px]">
                <button
                  type="button"
                  onclick={() => tagMode = 'any'}
                  class="px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer {
                    tagMode === 'any' ? 'bg-theme-primary text-white font-bold' : 'text-theme-text-muted hover:text-theme-text-main'
                  }"
                >
                  {t('filterModal.tagModeAny')}
                </button>
                <button
                  type="button"
                  onclick={() => tagMode = 'all'}
                  class="px-1.5 py-0.5 rounded font-semibold transition-all cursor-pointer {
                    tagMode === 'all' ? 'bg-theme-primary text-white font-bold' : 'text-theme-text-muted hover:text-theme-text-main'
                  }"
                >
                  {t('filterModal.tagModeAll')}
                </button>
              </div>
            </div>

            <div
              id="tagsSelect"
              class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto border border-theme-border/40 p-2 rounded bg-theme-card/25 scroller-thin animate-fade-in"
            >
              {#each allTags as tag (tag)}
                <label
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full border border-theme-border/45 bg-theme-card/40 hover:bg-theme-column/45 cursor-pointer text-[11px] text-theme-text-main transition-all {
                    selectedTags.includes(tag) ? 'border-theme-primary/30 bg-theme-primary/10 text-theme-accent font-semibold' : ''
                  }"
                >
                  <input type="checkbox" value={tag} bind:group={selectedTags} class="hidden" />
                  <Tag class="w-2.5 h-2.5 shrink-0 text-theme-text-muted" />
                  <span>{tag}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Layout Options -->
        <div class="border-t border-theme-border/30 pt-4">
          <label class="block text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-1.5" for="generalOptions">
            {t('settingsView.general')}
          </label>
          <label
            id="generalOptions"
            class="flex items-center gap-2 px-3 py-2 rounded border border-theme-border/50 bg-theme-card/30 hover:bg-theme-column/30 transition-all cursor-pointer text-xs text-theme-text-main w-full"
          >
            <input id="hide-done-column-checkbox" type="checkbox" bind:checked={hideDoneColumnLocal} class="accent-theme-primary" />
            <span>{t('doneBucket.hide')}</span>
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer Buttons -->
  <div class="p-3 border-t border-theme-border flex justify-between items-center bg-theme-card/30">
    <button
      type="button"
      onclick={handleClear}
      class="flex items-center gap-1.5 px-3 py-1.5 border border-theme-border hover:bg-theme-column/30 text-theme-text-muted hover:text-theme-text-main rounded text-xs font-semibold transition-all cursor-pointer"
    >
      <Trash2 class="w-3.5 h-3.5" />
      {t('filterModal.clearAll')}
    </button>

    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={handleClose}
        class="px-3.5 py-1.5 border border-theme-border rounded text-xs font-semibold text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/30 transition-all cursor-pointer"
      >
        {t('buttons.cancel')}
      </button>
      <button
        type="button"
        onclick={handleApply}
        class="px-4 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded text-xs font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
      >
        {t('filterModal.apply')}
      </button>
    </div>
  </div>
</dialog>

<style>
dialog {
  display: none;
}
dialog[open] {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
}
dialog::backdrop {
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(2px);
}
</style>
