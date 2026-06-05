<script lang="ts">
  import { Menu, SlidersHorizontal, LayoutGrid, List, Grid, Clock, Plus } from '@lucide/svelte';
  import { useI18n } from '@/composables/useI18n';
  import type { Project, BucketName } from '@/types';
  import type { ViewMode } from '@/stores/settings';

  let {
    searchQuery = $bindable(''),
    isSidebarOpen,
    projects,
    activeProjectId,
    hasActiveFilters,
    viewMode,
    defaultBucketName,
    ontogglesidebar,
    onopenfilter,
    onsetviewmode,
    oncreatetask
  } = $props<{
    searchQuery: string;
    isSidebarOpen: boolean;
    projects: Project[];
    activeProjectId: string;
    hasActiveFilters: boolean;
    viewMode: ViewMode;
    defaultBucketName: BucketName;
    ontogglesidebar?: () => void;
    onopenfilter?: () => void;
    onsetviewmode?: (mode: ViewMode) => void;
    oncreatetask?: (defaultBucket: BucketName) => void;
  }>();

  const { t } = useI18n();
</script>

<header class="flex items-center justify-between gap-3 border-b border-theme-border px-4 py-3 shrink-0 bg-theme-card z-10 w-full">
  <div class="flex items-center gap-2.5 overflow-hidden mr-2 shrink-0">
    <!-- Hamburger Menu Button -->
    <button
      onclick={ontogglesidebar}
      class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded transition-all cursor-pointer shrink-0"
      title={isSidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')}
    >
      <Menu class="w-4 h-4 shrink-0" />
    </button>
    <h1 class="text-base font-bold tracking-tight text-theme-text-main truncate flex items-baseline gap-1.5">
      {t('brand.title')}
      {#if projects.find((p) => p.id === activeProjectId)}
        <span class="text-xs font-semibold text-theme-text-muted opacity-80">
          / {projects.find((p) => p.id === activeProjectId)?.title}
        </span>
      {/if}
    </h1>
  </div>

  <!-- Search (Flex-grow to fill remaining space) -->
  <div class="flex-grow mx-3 relative">
    <input
      bind:value={searchQuery}
      type="text"
      placeholder={t('searchPlaceholder')}
      class="w-full bg-theme-card border border-theme-border rounded px-2.5 py-1 text-xs text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-ring"
    />
  </div>

  <!-- Toolbar Actions -->
  <div class="flex items-center gap-2 shrink-0">
    <!-- Advanced Filter Button -->
    <button
      onclick={onopenfilter}
      class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded border transition-all cursor-pointer {
        hasActiveFilters
          ? 'bg-theme-primary/10 border-theme-primary/15 text-theme-accent font-bold shadow-none'
          : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
      }"
      title={t('filterModal.buttonTooltip')}
    >
      <SlidersHorizontal class="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
      <span class="hidden md:inline">
        {t('filterModal.title')}
      </span>
      {#if hasActiveFilters}
        <span
          class="ml-0.5 px-1 bg-theme-primary text-white text-[9px] font-bold rounded-full min-w-[14px] text-center"
        >
          !
        </span>
      {/if}
    </button>

    <!-- View Mode Toggle -->
    <div class="flex items-center bg-theme-column/25 rounded p-0.5 shrink-0 border border-transparent">
      <button
        onclick={() => onsetviewmode?.('board')}
        class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer {
          viewMode === 'board'
            ? 'bg-theme-primary text-white shadow-none'
            : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
        }"
      >
        <LayoutGrid class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{t('views.board')}</span>
      </button>
      <button
        onclick={() => onsetviewmode?.('list')}
        class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer {
          viewMode === 'list'
            ? 'bg-theme-primary text-white shadow-none'
            : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
        }"
      >
        <List class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{t('views.list')}</span>
      </button>
      <button
        onclick={() => onsetviewmode?.('matrix')}
        class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer {
          viewMode === 'matrix'
            ? 'bg-theme-primary text-white shadow-none'
            : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
        }"
      >
        <Grid class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{t('views.matrix')}</span>
      </button>
      <button
        onclick={() => onsetviewmode?.('time')}
        class="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer {
          viewMode === 'time'
            ? 'bg-theme-primary text-white shadow-none'
            : 'text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column/40'
        }"
      >
        <Clock class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{t('views.time')}</span>
      </button>
    </div>

    <!-- New Task Button -->
    <button
      onclick={() => oncreatetask?.(defaultBucketName)}
      class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded transition-all cursor-pointer shrink-0"
      title={t('shortcuts.createTask')}
    >
      <Plus class="w-3.5 h-3.5 shrink-0" />
      <span class="hidden sm:inline">{t('addTaskButton')}</span>
    </button>
  </div>
</header>
