<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { settingsStore, type ViewMode } from '@/stores/settings';
  import type { Task, BucketName } from '@/types';
  import { getTasks, syncSystem } from '@/api';
  import TaskDetailModal from '@/components/modals/TaskDetailModal.svelte';
  import TaskCreateModal from '@/components/modals/TaskCreateModal.svelte';
  import ProjectEditModal from '@/components/modals/ProjectEditModal.svelte';
  import FilterModal from '@/components/modals/FilterModal.svelte';
  import NavigationBar from '@/components/layout/NavigationBar.svelte';
  import BoardView from '@/components/views/BoardView.svelte';
  import ListView from '@/components/views/ListView.svelte';
  import MatrixView from '@/components/views/MatrixView.svelte';
  import TimeView from '@/components/views/TimeView.svelte';
  import SettingsView from '@/components/views/SettingsView.svelte';
  import ProjectSidebar from '@/components/layout/ProjectSidebar.svelte';
  import { useI18n } from '@/composables/useI18n';
  import { useDialog } from '@/composables/useDialog';
  import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
  import { X, ClipboardList } from '@lucide/svelte';
  import { useTaskFilters } from '@/composables/useTaskFilters';
  import { useProjects } from '@/composables/useProjects';
  import { useBuckets } from '@/composables/useBuckets';
  import { useTaskMutations } from '@/composables/useTaskMutations';
  import { router } from '@/router';

  const { t } = useI18n();
  const dialog = useDialog();

  // Sync initial route params to store if present
  if (router.current.projectId) {
    settingsStore.setActiveProjectId(router.current.projectId);
  }
  if (router.current.viewMode) {
    settingsStore.setViewMode(router.current.viewMode as ViewMode);
  }

  let tasks = $state<Task[]>([]);
  let loading = $state(false);
  let syncLoading = $state(false);
  let syncSuccess = $state(false);
  let localError = $state<string | null>(null);

  // Routing & View Mode
  const selectProject = (projectId: string) => {
    const targetMode = settingsStore.viewMode === 'settings' ? 'board' : settingsStore.viewMode;
    router.push({
      name: 'project-view',
      params: { projectId, viewMode: targetMode },
    });
  };

  const setViewMode = (mode: ViewMode) => {
    settingsStore.setViewMode(mode);
    router.push({
      name: 'project-view',
      params: { projectId: settingsStore.activeProjectId, viewMode: mode },
      query: router.current.query,
    });
  };

  const toggleSidebar = () => {
    settingsStore.toggleSidebar();
  };

  const setTheme = (theme: string) => {
    settingsStore.setTheme(theme);
    const docClasses = document.documentElement.classList;
    // Remove existing themes
    docClasses.forEach((c) => {
      if (c.startsWith('theme-')) {
        docClasses.remove(c);
      }
    });
    if (theme !== 'nordic-light') {
      docClasses.add('theme-' + theme);
    }
  };

  // Composable: Projects Management
  const projectsState = useProjects(selectProject);

  // Composable: Buckets/Columns Management
  const bucketsState = useBuckets();

  // Filter state & logic
  let isFilterModalOpen = $state(false);
  const taskFiltersState = useTaskFilters(() => tasks);

  // Fetch all tasks using getTasks
  const fetchAllTasks = async () => {
    try {
      tasks = await getTasks(settingsStore.activeProjectId, { exclude_bucket: settingsStore.hideDoneColumn ? 'done' : undefined });
    } catch (err: any) {
      localError = t('errors.fetchTasks', { message: err.message || err });
    }
  };

  // Composable: Tasks Mutations
  const taskMutationsState = useTaskMutations(
    () => tasks,
    bucketsState.fetchBuckets,
    fetchAllTasks
  );

  // Synchronized error across all composables and local errors
  const error = $derived(
    localError ||
    projectsState.error ||
    bucketsState.error ||
    taskMutationsState.error
  );

  const clearAllErrors = () => {
    localError = null;
    projectsState.error = null;
    bucketsState.error = null;
    taskMutationsState.error = null;
  };

  // Sync taskFilters.show_done and hideDoneColumn
  $effect(() => {
    const showDone = taskFiltersState.taskFilters.show_done;
    const shouldHide = !showDone;
    if (settingsStore.hideDoneColumn !== shouldHide) {
      settingsStore.hideDoneColumn = shouldHide;
    }
  });

  $effect(() => {
    const hideDone = settingsStore.hideDoneColumn;
    const showDoneTarget = hideDone ? undefined : true;
    if (taskFiltersState.taskFilters.show_done !== showDoneTarget) {
      taskFiltersState.taskFilters.show_done = showDoneTarget;
    }
    fetchAllTasks();
  });

  // Modal state
  let selectedTaskId = $state<string | null>(router.current.taskId ? String(router.current.taskId) : null);
  let isDetailOpen = $state(!!router.current.taskId);
  let isCreateOpen = $state(false);
  let createDefaultBucket = $state<BucketName>('todo');

  // Update document title dynamically based on active project
  $effect(() => {
    const currentProj = projectsState.projects.find((p) => p.id === settingsStore.activeProjectId);
    if (currentProj) {
      document.title = `Jotter / ${currentProj.title}`;
    } else {
      document.title = 'Jotter';
    }
  });

  const fetchAllData = async () => {
    loading = true;
    localError = null;
    try {
      await bucketsState.fetchBuckets();
      await fetchAllTasks();
    } catch (err: any) {
      localError = t('errors.fetchData', { message: err.message || err });
    } finally {
      loading = false;
    }
  };

  onMount(async () => {
    await projectsState.fetchProjects();
    await fetchAllData();
    setTheme(settingsStore.currentTheme);
  });

  // Compute unique list of tags across all tasks (case-insensitively grouped as lowercase)
  const allTags = $derived.by(() => {
    const tagsSet = new Set<string>();
    tasks.forEach((t) => {
      if (t.tags) {
        t.tags.forEach((tag) => tagsSet.add(tag.toLowerCase()));
      }
    });
    return Array.from(tagsSet).sort();
  });

  // Group tasks by bucket name
  const tasksByBucket = $derived.by(() => {
    const groups: Record<string, Task[]> = {};
    bucketsState.buckets.forEach((b) => {
      groups[b.name] = [];
    });

    taskFiltersState.filteredTasks.forEach((task) => {
      const b = task.bucket;
      if (groups[b] === undefined) {
        groups[b] = [];
      }
      groups[b].push(task);
    });

    // Sort each bucket by position ascending
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.position - b.position);
    });

    return groups;
  });

  const openDetailModal = (task: Task) => {
    router.push({
      name: 'task-detail',
      params: { projectId: settingsStore.activeProjectId, viewMode: settingsStore.viewMode, taskId: String(task.id) },
      query: router.current.query,
    });
  };

  const closeDetailModal = () => {
    router.push({
      name: 'project-view',
      params: { projectId: settingsStore.activeProjectId, viewMode: settingsStore.viewMode },
      query: router.current.query,
    });
  };

  // Sync route parameters with component state dynamically
  let prevProjectId = $state(settingsStore.activeProjectId);
  let prevViewMode = $state(settingsStore.viewMode);

  $effect(() => {
    const newProjectId = router.current.projectId;
    const newViewMode = router.current.viewMode as ViewMode;
    const newTaskId = router.current.taskId;

    // 1. Project ID Sync
    if (newProjectId && newProjectId !== prevProjectId) {
      prevProjectId = newProjectId;
      settingsStore.activeProjectId = newProjectId;
      localError = null;
      taskFiltersState.clearFilters();
      fetchAllData();
    }

    // 2. View Mode Sync
    if (newViewMode && newViewMode !== prevViewMode) {
      prevViewMode = newViewMode;
      settingsStore.viewMode = newViewMode;
    }

    // 3. Task ID Sync
    if (newTaskId) {
      selectedTaskId = String(newTaskId);
      isDetailOpen = true;
    } else {
      isDetailOpen = false;
      selectedTaskId = null;
    }
  });

  const defaultBucketName = $derived.by(() => {
    const defCol = bucketsState.buckets.find((b) => b.is_default);
    return defCol?.name || bucketsState.buckets[0]?.name || 'todo';
  });

  const openCreateModal = (bucket: BucketName) => {
    createDefaultBucket = bucket;
    isCreateOpen = true;
  };

  useKeyboardShortcuts([
    {
      key: 'q',
      callback: () => {
        if (!isCreateOpen && !isDetailOpen && !dialog.isOpen) {
          openCreateModal(defaultBucketName);
        }
      },
    },
  ]);

  const handleDetailMarkTaskDone = async (task: Task) => {
    await taskMutationsState.handleMarkTaskDone(task);
    closeDetailModal();
  };

  const triggerSync = async () => {
    syncLoading = true;
    syncSuccess = false;
    localError = null;
    try {
      await syncSystem();
      syncSuccess = true;
      setTimeout(() => {
        syncSuccess = false;
      }, 2000);
      await projectsState.fetchProjects();
      await fetchAllData();
    } catch (err: any) {
      const msg = err.message || err;
      localError = t('sync.error', { message: msg });
      await dialog.showDialog({
        title: t('sync.button'),
        message: t('sync.error', { message: msg }),
        type: 'error',
      });
    } finally {
      syncLoading = false;
    }
  };
</script>

<div class="h-screen w-full flex flex-col overflow-hidden bg-theme-base">
  <NavigationBar
    bind:searchQuery={taskFiltersState.searchQuery}
    isSidebarOpen={settingsStore.isSidebarOpen}
    projects={projectsState.projects}
    activeProjectId={settingsStore.activeProjectId}
    hasActiveFilters={taskFiltersState.hasActiveFilters}
    viewMode={settingsStore.viewMode}
    defaultBucketName={defaultBucketName}
    ontogglesidebar={toggleSidebar}
    onopenfilter={() => isFilterModalOpen = true}
    onsetviewmode={setViewMode}
    oncreatetask={openCreateModal}
  />

  <!-- Main Layout Area (Below Header) -->
  <div class="flex-grow flex overflow-hidden w-full relative">
    <!-- Left Projects Sidebar (with sliding transition) -->
    {#if settingsStore.isSidebarOpen}
      <div transition:fly={{ x: -256, duration: 220 }} class="h-full flex shrink-0">
        <ProjectSidebar
          projects={projectsState.projects}
          activeProjectId={settingsStore.activeProjectId}
          syncLoading={syncLoading}
          syncSuccess={syncSuccess}
          viewMode={settingsStore.viewMode}
          onselectproject={selectProject}
          oncreateproject={projectsState.handleCreateProject}
          oneditproject={projectsState.handleEditProject}
          onsync={triggerSync}
          onselectview={setViewMode}
        />
      </div>
    {/if}

    <!-- Main Content Area -->
    <div class="flex-grow flex flex-col p-3 overflow-hidden">
      <!-- Error Banner -->
      {#if error}
        <div
          class="mt-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded flex justify-between items-center shrink-0"
        >
          <span>{error}</span>
          <button onclick={clearAllErrors} class="hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>
      {/if}

      <!-- Main Content Panel (Responsive Layout Flex) -->
      <div class="flex-grow overflow-hidden mt-2.5 relative">
        <!-- Loading Board state -->
        {#if loading && !tasks.length}
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div class="w-10 h-10 border-4 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
            <span class="text-theme-text-muted text-xs">{t('loadingBoard')}</span>
          </div>

        <!-- Empty Board state -->
        {:else}
          {#if !tasks.length}
            <div
              class="h-full flex flex-col items-center justify-center text-center bg-theme-column/10 border border-dashed border-theme-border rounded p-6"
            >
              <div class="p-3 bg-theme-card/50 rounded border border-theme-border mb-3 text-theme-accent">
                <ClipboardList class="w-6 h-6" />
              </div>
              <h3 class="font-bold text-theme-text-main text-sm">{t('emptyStateTitle')}</h3>
              <p class="text-theme-text-muted text-xs max-w-sm mt-0.5">
                {t('emptyStateText')}
              </p>
              <button
                onclick={() => openCreateModal(defaultBucketName)}
                class="mt-4 text-xs font-semibold px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded shadow transition-all cursor-pointer"
              >
                {t('createFirstTaskButton')}
              </button>
            </div>
          {:else}
            <!-- Board View Columns (Horizontal Scrolling Flex) -->
            {#if settingsStore.viewMode === 'board'}
              <BoardView
                buckets={bucketsState.displayedBuckets}
                tasksByBucket={tasksByBucket}
                ontaskclick={openDetailModal}
                onaddtaskclick={openCreateModal}
                oncarddropped={taskMutationsState.handleCardDropped}
                onrenamecolumn={bucketsState.handleRenameColumn}
                ondeletecolumn={bucketsState.handleDeleteColumn}
                oncreatecolumn={bucketsState.handleCreateColumn}
                onmarkdone={taskMutationsState.handleMarkTaskDone}
                oncolumnreordered={bucketsState.handleColumnReordered}
              />

            <!-- List View Mode (Data dense Table View) -->
            {:else if settingsStore.viewMode === 'list'}
              <ListView
                buckets={bucketsState.displayedBuckets}
                tasksByBucket={tasksByBucket}
                ontaskclick={openDetailModal}
              />

            <!-- Matrix View Mode (Eisenhower 2x2 Matrix) -->
            {:else if settingsStore.viewMode === 'matrix'}
              <MatrixView tasks={taskFiltersState.filteredTasks} ontaskclick={openDetailModal} />

            <!-- Time View Mode (Deadline-based columns) -->
            {:else if settingsStore.viewMode === 'time'}
              <TimeView
                tasks={taskFiltersState.filteredTasks}
                ontaskclick={openDetailModal}
                onmarkdone={taskMutationsState.handleMarkTaskDone}
                onupdateduedate={taskMutationsState.handleTimeViewDueDateUpdate}
              />

            <!-- Settings View Mode -->
            {:else if settingsStore.viewMode === 'settings'}
              <SettingsView />
            {/if}
          {/if}
        {/if}
      </div>

      <!-- Task Detail Modal -->
      <TaskDetailModal
        isOpen={isDetailOpen}
        projectId={settingsStore.activeProjectId}
        taskId={selectedTaskId}
        buckets={bucketsState.buckets}
        existingTags={allTags}
        onclose={closeDetailModal}
        onupdated={fetchAllTasks}
        ondeleted={fetchAllTasks}
        onmarkdone={handleDetailMarkTaskDone}
      />

      <!-- Task Create Modal -->
      <TaskCreateModal
        isOpen={isCreateOpen}
        projectId={settingsStore.activeProjectId}
        defaultBucket={createDefaultBucket}
        buckets={bucketsState.buckets}
        existingTags={allTags}
        onclose={() => isCreateOpen = false}
        oncreated={fetchAllTasks}
      />

      <!-- Project Edit Modal -->
      <ProjectEditModal
        isOpen={projectsState.isProjectEditModalOpen}
        project={projectsState.editingProject}
        onclose={() => projectsState.isProjectEditModalOpen = false}
        onsave={projectsState.handleSaveProject}
        ondeleteproject={() => projectsState.handleDeleteProject(projectsState.editingProject)}
      />

      <!-- Filter Modal -->
      <FilterModal
        isOpen={isFilterModalOpen}
        buckets={bucketsState.buckets}
        allTags={allTags}
        currentFilters={taskFiltersState.taskFilters}
        onclose={() => isFilterModalOpen = false}
        onapply={taskFiltersState.applyFilters}
      />
    </div>
  </div>
</div>
