<script lang="ts">
  import { Folder, Hash, MoreHorizontal, Plus, Pin, RefreshCw, Settings, Check } from '@lucide/svelte';
  import { settingsStore, type ViewMode } from '@/stores/settings';
  import type { Project } from '@/types';
  import { useI18n } from '@/composables/useI18n';
  import { isServerOnline, checkServerStatus } from '@/api';
  import { onMount, onDestroy, tick } from 'svelte';

  let {
    projects = [],
    activeProjectId,
    syncLoading = false,
    syncSuccess = false,
    viewMode = 'board',
    onselectproject,
    oncreateproject,
    oneditproject,
    onsync,
    onselectview
  } = $props<{
    projects: Project[];
    activeProjectId: string;
    syncLoading?: boolean;
    syncSuccess?: boolean;
    viewMode?: ViewMode;
    onselectproject?: (id: string) => void;
    oncreateproject?: (title: string) => void;
    oneditproject?: (project: Project) => void;
    onsync?: () => void;
    onselectview?: (view: ViewMode) => void;
  }>();

  const { t } = useI18n();

  const togglePin = (projectId: string, event: Event) => {
    event.stopPropagation();
    if (settingsStore.pinnedProjectIds.includes(projectId)) {
      settingsStore.unpinProject(projectId);
    } else {
      settingsStore.pinProject(projectId);
    }
  };

  const toggleSortOrder = () => {
    settingsStore.sortBy = settingsStore.sortBy === 'alpha' ? 'mru' : 'alpha';
  };

  const updateMru = (id: string) => {
    if (id) {
      settingsStore.updateProjectMru(id);
    }
  };

  $effect(() => {
    updateMru(activeProjectId);
  });

  // Server Status Checking
  let pingInterval: any = null;

  const handleFocusOrVisible = () => {
    if (document.visibilityState === 'visible') {
      checkServerStatus();
    }
  };

  onMount(() => {
    updateMru(activeProjectId);
    checkServerStatus();
    pingInterval = setInterval(checkServerStatus, 30000);
    window.addEventListener('focus', checkServerStatus);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
  });

  onDestroy(() => {
    if (pingInterval) clearInterval(pingInterval);
    window.removeEventListener('focus', checkServerStatus);
    document.removeEventListener('visibilitychange', handleFocusOrVisible);
  });

  const sortedProjects = $derived.by(() => {
    return [...projects].sort((a, b) => {
      const aPinned = settingsStore.pinnedProjectIds.includes(a.id);
      const bPinned = settingsStore.pinnedProjectIds.includes(b.id);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (settingsStore.sortBy === 'mru') {
        const aMru = settingsStore.getProjectMru(a.id);
        const bMru = settingsStore.getProjectMru(b.id);
        if (aMru !== bMru) {
          return bMru - aMru;
        }
      }

      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
  });

  let showAddProjectInput = $state(false);
  let newProjectTitle = $state('');
  let addProjectInput = $state<HTMLInputElement | null>(null);

  const triggerAddProject = () => {
    showAddProjectInput = true;
    tick().then(() => {
      addProjectInput?.focus();
    });
  };

  const handleCreateProject = () => {
    const title = newProjectTitle.trim();
    if (!title) {
      showAddProjectInput = false;
      return;
    }
    oncreateproject?.(title);
    newProjectTitle = '';
    showAddProjectInput = false;
  };
</script>

<aside class="w-64 border-r border-theme-border flex flex-col shrink-0 bg-theme-card h-full">
  <!-- Server Status Indicator (Only visible when offline) -->
  {#if !isServerOnline.value}
    <div
      class="px-4 py-2.5 border-b border-red-500/20 flex items-center justify-between shrink-0 bg-red-500/10 text-red-400"
    >
      <span class="text-[10px] uppercase font-bold tracking-wider text-red-400/80">{t('projects.serverStatus')}</span>
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        <span class="text-[11px] font-semibold font-mono text-red-400"> {t('projects.offline')} </span>
      </div>
    </div>
  {/if}

  <!-- Sidebar Header -->
  <div class="p-4 border-b border-theme-border flex items-center justify-between shrink-0">
    <h2 class="text-sm font-bold uppercase tracking-wider text-theme-text-main flex items-center gap-1.5">
      <Folder class="w-4 h-4 text-theme-accent shrink-0" /> {t('projects.sidebarTitle')}
    </h2>

    <!-- Sort Order Toggle Badge Button -->
    <button
      onclick={toggleSortOrder}
      class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-theme-border/50 bg-theme-column/30 hover:bg-theme-column text-theme-text-muted hover:text-theme-text-main transition-colors cursor-pointer"
      title={settingsStore.sortBy === 'alpha' ? t('projects.sortTooltipAlpha') : t('projects.sortTooltipMru')}
    >
      {settingsStore.sortBy === 'alpha' ? 'A-Z' : 'MRU'}
    </button>
  </div>

  <!-- Projects List -->
  <div class="flex-grow overflow-y-auto p-2 space-y-1 scroller-thin">
    {#each sortedProjects as project (project.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="group relative flex items-center justify-between px-3 py-1.5 rounded text-sm transition-all cursor-pointer font-medium {
          project.id === activeProjectId
            ? 'bg-theme-primary/10 text-theme-accent border border-theme-primary/15'
            : 'text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main border border-transparent'
        }"
        onclick={() => onselectproject?.(project.id)}
      >
        <!-- Project Title -->
        <div class="flex items-center gap-2 overflow-hidden flex-grow mr-2">
          <Hash class="w-3.5 h-3.5 text-theme-text-muted shrink-0" />
          <span class="truncate font-sans">{project.title}</span>
        </div>

        <!-- Project Actions -->
        <div class="flex items-center gap-1 shrink-0">
          <!-- Pin Toggle Button -->
          <button
            onclick={(e) => togglePin(project.id, e)}
            class="p-0.5 rounded transition-all cursor-pointer {
              settingsStore.pinnedProjectIds.includes(project.id)
                ? 'text-theme-accent opacity-100'
                : 'text-theme-text-muted hover:text-theme-text-main opacity-0 group-hover:opacity-100'
            }"
            title={settingsStore.pinnedProjectIds.includes(project.id) ? t('projects.unpinProject') : t('projects.pinProject')}
          >
            <Pin class="w-3 h-3 {settingsStore.pinnedProjectIds.includes(project.id) ? 'fill-theme-accent' : ''}" />
          </button>

          <!-- Edit Icon -->
          <div class="flex items-center gap-1 shrink-0 transition-opacity">
            <!-- Edit Project Button -->
            <button
              onclick={(e) => { e.stopPropagation(); oneditproject?.(project); }}
              class="p-1.5 text-theme-text-muted hover:text-theme-text-main hover:bg-theme-column rounded transition-colors cursor-pointer"
              title={t('projects.editProject')}
            >
              <MoreHorizontal class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Add Project Action at Bottom of Sidebar -->
  <div class="p-3 shrink-0">
    {#if showAddProjectInput}
      <div class="flex flex-col gap-2">
        <input
          bind:value={newProjectTitle}
          bind:this={addProjectInput}
          type="text"
          placeholder={t('projects.newProjectPlaceholder')}
          class="w-full bg-theme-base border border-theme-border rounded px-2.5 py-1 text-sm text-theme-text-input focus:outline-none focus:border-theme-primary"
          onkeydown={(e) => e.key === 'Enter' && handleCreateProject()}
          onblur={handleCreateProject}
        />
      </div>
    {:else}
      <button
        onclick={triggerAddProject}
        class="w-full flex items-center justify-center gap-1.5 py-1.5 text-sm font-semibold border border-dashed border-theme-border text-theme-text-muted hover:text-theme-text-main hover:border-theme-primary hover:bg-theme-column/30 rounded transition-all cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5 shrink-0" /> {t('projects.newProject')}
      </button>
    {/if}
  </div>

  <!-- Sidebar Footer Actions -->
  <div class="p-3 border-t border-theme-border flex flex-col gap-1.5 shrink-0 bg-transparent">
    <!-- Sync Index Button -->
    <button
      onclick={onsync}
      class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded border transition-all duration-300 cursor-pointer {
        syncSuccess
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
          : syncLoading
            ? 'bg-theme-column/20 border-transparent text-theme-text-main'
            : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
      }"
      disabled={syncLoading}
    >
      {#if syncSuccess}
        <Check class="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-bounce" />
      {:else}
        <RefreshCw class="w-3.5 h-3.5 {syncLoading ? 'animate-spin' : ''}" />
      {/if}
      <span>
        {syncSuccess ? t('sync.synced') : syncLoading ? t('sync.syncing') : t('sync.button')}
      </span>
    </button>

    <!-- Settings Button -->
    <button
      onclick={() => onselectview?.('settings')}
      class="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded border transition-all cursor-pointer {
        viewMode === 'settings'
          ? 'bg-theme-primary/10 border-theme-primary/15 text-theme-accent'
          : 'bg-transparent border-transparent text-theme-text-muted hover:bg-theme-column/30 hover:text-theme-text-main'
      }"
    >
      <Settings class="w-3.5 h-3.5" />
      <span>{t('views.settings')}</span>
    </button>
  </div>
</aside>
