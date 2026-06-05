<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import Sortable from 'sortablejs';
  import type { Task, BucketName } from '@/types';
  import TaskCard from '@/components/ui/TaskCard.svelte';
  import ColumnEditModal from '@/components/modals/ColumnEditModal.svelte';
  import { useI18n } from '@/composables/useI18n';
  import { settingsStore } from '@/stores/settings';
  import { MoreHorizontal, Plus } from '@lucide/svelte';

  let {
    bucketName,
    title,
    subtitle,
    color = null,
    layout = 'list',
    maxTasks = null,
    isDefault = false,
    tasks = [],
    isFirst,
    isLast,
    ontaskclick,
    onaddtaskclick,
    oncarddropped,
    onrenamecolumn,
    ondeletecolumn,
    onmarkdone
  } = $props<{
    bucketName: BucketName;
    title: string;
    subtitle: string;
    color?: string | null;
    layout?: 'list' | 'grid-2' | 'grid-3';
    maxTasks?: number | null;
    isDefault?: boolean;
    tasks: Task[];
    isFirst: boolean;
    isLast: boolean;
    ontaskclick?: (task: Task) => void;
    onaddtaskclick?: (bucket: BucketName) => void;
    oncarddropped?: (payload: { taskId: string; toBucket: BucketName; prevTaskId: string | null; nextTaskId: string | null }) => void;
    onrenamecolumn?: (payload: {
      bucketName: string;
      newTitle: string;
      newSubtitle: string;
      newColor?: string | null;
      newLayout?: 'list' | 'grid-2' | 'grid-3';
      newMaxTasks?: number | null;
      newIsDefault?: boolean;
    }) => void;
    ondeletecolumn?: (bucketName: string) => void;
    onmarkdone?: (task: Task) => void;
  }>();

  const { t } = useI18n();

  let isEditModalOpen = $state(false);

  const isLimitExceeded = $derived(
    maxTasks !== null && maxTasks !== undefined && maxTasks > 0 && tasks.length > maxTasks
  );

  let cardsContainer = $state<HTMLElement | null>(null);
  let leftContainer = $state<HTMLElement | null>(null);
  let rightContainer = $state<HTMLElement | null>(null);
  let col1Container = $state<HTMLElement | null>(null);
  let col2Container = $state<HTMLElement | null>(null);
  let col3Container = $state<HTMLElement | null>(null);

  const displayTitle = $derived.by(() => {
    const translated = t('buckets.' + bucketName);
    return translated !== 'buckets.' + bucketName ? translated : title;
  });

  const leftTasks = $derived(tasks.filter((_, idx) => idx % 2 === 0));
  const rightTasks = $derived(tasks.filter((_, idx) => idx % 2 === 1));

  const col1Tasks = $derived(tasks.filter((_, idx) => idx % 3 === 0));
  const col2Tasks = $derived(tasks.filter((_, idx) => idx % 3 === 1));
  const col3Tasks = $derived(tasks.filter((_, idx) => idx % 3 === 2));

  const colorMap: Record<string, string> = {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
  };

  const columnStyle = $derived.by(() => {
    let styles = '';
    if (isLimitExceeded) {
      styles += `--column-tint: #ef4444; `;
      styles += 'background-color: color-mix(in srgb, #ef4444 8%, var(--theme-bg-column)); ';
      styles += 'border-color: color-mix(in srgb, #ef4444 50%, var(--theme-border)); ';
      styles += 'box-shadow: 0 0 12px rgba(239, 68, 68, 0.15);';
    } else if (color && colorMap[color]) {
      const hexColor = colorMap[color];
      styles += `--column-tint: ${hexColor}; `;
      styles += `background-color: color-mix(in srgb, ${hexColor} 3%, var(--theme-bg-column)); `;
      styles += `border-color: color-mix(in srgb, ${hexColor} 25%, var(--theme-border));`;
    }
    return styles;
  });

  const onSaveColumn = (payload: {
    bucketName: string;
    title: string;
    subtitle: string;
    color: string | null;
    layout: 'list' | 'grid-2' | 'grid-3';
    max_tasks: number | null;
    is_default: boolean;
  }) => {
    if (
      payload.title &&
      (payload.title !== title ||
        payload.subtitle !== subtitle ||
        payload.color !== color ||
        payload.layout !== layout ||
        payload.max_tasks !== maxTasks ||
        payload.is_default !== isDefault)
    ) {
      onrenamecolumn?.({
        bucketName,
        newTitle: payload.title,
        newSubtitle: payload.subtitle,
        newColor: payload.color,
        newLayout: payload.layout,
        newMaxTasks: payload.max_tasks,
        newIsDefault: payload.is_default,
      });
    }
  };

  const onContainerDblClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.task-card') || target.closest('button') || target.closest('a')) {
      return;
    }
    onaddtaskclick?.(bucketName);
  };

  let sortableInstances: Sortable[] = [];

  const destroySortables = () => {
    sortableInstances.forEach((inst) => inst.destroy());
    sortableInstances = [];
  };

  const setupSortables = async () => {
    destroySortables();
    await tick();

    const createSortableOptions = () => ({
      group: 'kanban-board',
      animation: 180,
      delay: 0,
      ghostClass: 'opacity-40',
      chosenClass: 'scale-[1.02]',
      dragClass: 'rotate-1',
      draggable: '.task-card',
      filter: '.add-task-btn',
      preventOnFilter: true,
      onStart: () => {
        document.body.classList.add('dragging-active');
      },
      onEnd: (evt: any) => {
        document.body.classList.remove('dragging-active');
        const { item, to } = evt;
        const taskId = item.getAttribute('data-task-id') || '';
        const toBucket = to.getAttribute('data-bucket-name') as BucketName;

        let prevEl = item.previousElementSibling;
        let nextEl = item.nextElementSibling;

        while (prevEl && !prevEl.classList.contains('task-card')) {
          prevEl = prevEl.previousElementSibling;
        }
        while (nextEl && !nextEl.classList.contains('task-card')) {
          nextEl = nextEl.nextElementSibling;
        }

        const prevTaskId = prevEl ? prevEl.getAttribute('data-task-id') : null;
        const nextTaskId = nextEl ? nextEl.getAttribute('data-task-id') : null;

        oncarddropped?.({
          taskId,
          toBucket,
          prevTaskId,
          nextTaskId,
        });
      },
    });

    if (layout === 'grid-3') {
      if (col1Container) sortableInstances.push(Sortable.create(col1Container, createSortableOptions()));
      if (col2Container) sortableInstances.push(Sortable.create(col2Container, createSortableOptions()));
      if (col3Container) sortableInstances.push(Sortable.create(col3Container, createSortableOptions()));
    } else if (layout === 'grid-2') {
      if (leftContainer) sortableInstances.push(Sortable.create(leftContainer, createSortableOptions()));
      if (rightContainer) sortableInstances.push(Sortable.create(rightContainer, createSortableOptions()));
    } else {
      if (cardsContainer) sortableInstances.push(Sortable.create(cardsContainer, createSortableOptions()));
    }
  };

  onMount(() => {
    setupSortables();
  });

  onDestroy(() => {
    destroySortables();
  });

  $effect(() => {
    layout;
    setupSortables();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_dblclick_drag_drop -->
<div
  style={columnStyle}
  class="kanban-column flex flex-col bg-theme-column border border-theme-border rounded h-fit max-h-full shrink-0 group/col relative overflow-hidden transition-all duration-300 {
    layout === 'grid-3'
      ? 'min-w-[840px] w-[864px] md:w-[960px]'
      : layout === 'grid-2'
        ? 'min-w-[560px] w-[576px] md:w-[640px]'
        : 'min-w-[280px] w-72 md:w-80'
  }"
>
  <!-- Column Header -->
  <div
    class="px-3 py-2 flex justify-between items-center border-b border-theme-border bg-theme-card/30 rounded-t shrink-0 min-h-[48px] cursor-grab active:cursor-grabbing column-drag-handle"
  >
    <!-- Title Area -->
    <div class="flex-grow flex flex-col justify-center overflow-hidden mr-1">
      <div class="flex flex-col gap-0.5 overflow-hidden">
        <div class="flex items-center gap-1.5 overflow-hidden">
          <h3
            class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate max-w-[130px] md:max-w-[160px] cursor-pointer hover:text-theme-accent transition-colors"
            ondblclick={() => isEditModalOpen = true}
            title={t('doubleClickToRename')}
          >
            {displayTitle}
          </h3>
          <span
            class="text-xs px-1.5 py-0.25 font-bold rounded shrink-0 transition-all duration-300 {
              isLimitExceeded
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400 animate-pulse'
                : 'bg-theme-card border border-theme-border/60 text-theme-text-muted'
            }"
          >
            {maxTasks ? `${tasks.length}/${maxTasks}` : tasks.length}
          </span>
        </div>
        <!-- Subtitle / Description -->
        {#if subtitle}
          <span
            class="text-xs text-theme-text-muted truncate cursor-pointer font-sans italic hover:text-theme-accent leading-normal"
            ondblclick={() => isEditModalOpen = true}
            title={t('doubleClickToRename')}
          >
            {subtitle}
          </span>
        {/if}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center shrink-0 gap-1">
      <!-- Quick Add Task -->
      {#if settingsStore.hideAddTaskButton}
        <button
          onclick={() => onaddtaskclick?.(bucketName)}
          class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
          title={t('addTaskButton')}
        >
          <Plus class="w-4 h-4 shrink-0" />
        </button>
      {/if}
      <!-- Edit Column Details -->
      <button
        onclick={() => isEditModalOpen = true}
        class="text-theme-text-muted hover:text-theme-text-main p-1 hover:bg-theme-card/50 rounded transition-colors cursor-pointer"
        title={t('renameColumnTooltip')}
      >
        <MoreHorizontal class="w-4 h-4 shrink-0" />
      </button>
    </div>
  </div>

  <!-- Cards Container -->
  <div ondblclick={onContainerDblClick} class="flex-grow flex flex-col p-2.5 overflow-y-auto scroller-thin animate-fade-in">
    <!-- "+ Add Task" Card-style Button at the top of the column -->
    {#if !settingsStore.hideAddTaskButton}
      <button
        onclick={() => onaddtaskclick?.(bucketName)}
        class="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 mb-2.5 bg-theme-card/35 hover:bg-theme-accent/10 text-theme-text-muted hover:text-theme-accent border border-transparent rounded transition-all cursor-pointer group/btn shrink-0"
      >
        <Plus class="w-3.5 h-3.5 shrink-0 transition-transform group-hover/btn:scale-110" />
        <span class="text-sm font-semibold">{t('addTaskButton')}</span>
      </button>
    {/if}

    {#if layout === 'grid-3'}
      <!-- Grid 3x Masonry-style subcolumns -->
      <div class="subcolumn-wrap flex gap-2.5 items-stretch flex-grow pb-6">
        <!-- Col 1 -->
        <div bind:this={col1Container} data-bucket-name={bucketName} class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow">
          {#each col1Tasks as task (task.id)}
            <div class="task-card" data-task-id={task.id}>
              <TaskCard
                {task}
                onclick={ontaskclick}
                onmarkdone={onmarkdone}
              />
            </div>
          {/each}
        </div>

        <!-- Col 2 -->
        <div bind:this={col2Container} data-bucket-name={bucketName} class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow">
          {#each col2Tasks as task (task.id)}
            <div class="task-card" data-task-id={task.id}>
              <TaskCard
                {task}
                onclick={ontaskclick}
                onmarkdone={onmarkdone}
              />
            </div>
          {/each}
        </div>

        <!-- Col 3 -->
        <div bind:this={col3Container} data-bucket-name={bucketName} class="subcolumn flex flex-col gap-2.5 w-1/3 flex-grow">
          {#each col3Tasks as task (task.id)}
            <div class="task-card" data-task-id={task.id}>
              <TaskCard
                {task}
                onclick={ontaskclick}
                onmarkdone={onmarkdone}
              />
            </div>
          {/each}
        </div>
      </div>
    {:else if layout === 'grid-2'}
      <!-- Grid 2x Masonry-style subcolumns -->
      <div class="subcolumn-wrap flex gap-2.5 items-stretch flex-grow pb-6">
        <!-- Left Subcolumn -->
        <div bind:this={leftContainer} data-bucket-name={bucketName} class="subcolumn flex flex-col gap-2.5 w-1/2 flex-grow">
          {#each leftTasks as task (task.id)}
            <div class="task-card" data-task-id={task.id}>
              <TaskCard
                {task}
                onclick={ontaskclick}
                onmarkdone={onmarkdone}
              />
            </div>
          {/each}
        </div>

        <!-- Right Subcolumn -->
        <div bind:this={rightContainer} data-bucket-name={bucketName} class="subcolumn flex flex-col gap-2.5 w-1/2 flex-grow">
          {#each rightTasks as task (task.id)}
            <div class="task-card" data-task-id={task.id}>
              <TaskCard
                {task}
                onclick={ontaskclick}
                onmarkdone={onmarkdone}
              />
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Single Column List -->
      <div bind:this={cardsContainer} data-bucket-name={bucketName} class="cards-container-list flex flex-col gap-2.5 flex-grow pb-6">
        {#each tasks as task (task.id)}
          <div class="task-card" data-task-id={task.id}>
            <TaskCard
              {task}
              onclick={ontaskclick}
              onmarkdone={onmarkdone}
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Edit Column Details Modal -->
  <ColumnEditModal
    isOpen={isEditModalOpen}
    {bucketName}
    initialTitle={title}
    initialSubtitle={subtitle}
    initialColor={color}
    initialLayout={layout}
    initialMaxTasks={maxTasks}
    initialIsDefault={isDefault}
    tasksCount={tasks.length}
    onclose={() => isEditModalOpen = false}
    onsave={onSaveColumn}
    ondeletecolumn={() => ondeletecolumn?.(bucketName)}
  />
</div>

<style>
/* Make subcolumns and lists fill the vertical space to serve as reliable drop zones */
.subcolumn-wrap,
.subcolumn,
.cards-container-list {
  flex-grow: 1;
  min-height: 120px;
}
</style>
