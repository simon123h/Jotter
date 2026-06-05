<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Plus } from '@lucide/svelte';
  import Sortable from 'sortablejs';
  import type { Task, Bucket, BucketName } from '@/types';
  import KanbanColumn from '@/components/ui/KanbanColumn.svelte';
  import { useI18n } from '@/composables/useI18n';

  let {
    buckets = [],
    tasksByBucket = {},
    ontaskclick,
    onaddtaskclick,
    oncarddropped,
    onrenamecolumn,
    ondeletecolumn,
    oncreatecolumn,
    onmarkdone,
    oncolumnreordered
  } = $props<{
    buckets: Bucket[];
    tasksByBucket: Record<string, Task[]>;
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
    oncreatecolumn?: (title: string, subtitle: string) => void;
    onmarkdone?: (task: Task) => void;
    oncolumnreordered?: (payload: { oldIndex: number; newIndex: number }) => void;
  }>();

  const { t } = useI18n();

  let isAddingColumn = $state(false);
  let newColumnTitle = $state('');
  let newColumnSubtitle = $state('');

  let columnsContainer = $state<HTMLElement | null>(null);
  let sortableInstance: Sortable | null = null;

  onMount(() => {
    if (columnsContainer) {
      sortableInstance = Sortable.create(columnsContainer, {
        animation: 180,
        draggable: '.kanban-column',
        handle: '.column-drag-handle',
        filter: 'button, input, select, textarea',
        onEnd: (evt) => {
          const { oldIndex, newIndex } = evt;
          if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
          oncolumnreordered?.({ oldIndex, newIndex });
        },
      });
    }
  });

  onDestroy(() => {
    sortableInstance?.destroy();
  });

  const handleAddColumn = () => {
    const title = newColumnTitle.trim();
    const subtitle = newColumnSubtitle.trim();
    if (!title) return;
    oncreatecolumn?.(title, subtitle);
    newColumnTitle = '';
    newColumnSubtitle = '';
    isAddingColumn = false;
  };

  const handleCancelAddColumn = () => {
    newColumnTitle = '';
    newColumnSubtitle = '';
    isAddingColumn = false;
  };
</script>

<div bind:this={columnsContainer} class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
  {#each buckets as b, idx (b.name)}
    <KanbanColumn
      bucketName={b.name}
      title={b.title}
      subtitle={b.subtitle}
      color={b.color}
      layout={b.layout}
      maxTasks={b.max_tasks}
      isDefault={b.is_default}
      tasks={tasksByBucket[b.name] || []}
      isFirst={idx === 0}
      isLast={idx === buckets.length - 1}
      ontaskclick={ontaskclick}
      onaddtaskclick={onaddtaskclick}
      oncarddropped={oncarddropped}
      onrenamecolumn={onrenamecolumn}
      ondeletecolumn={ondeletecolumn}
      onmarkdone={onmarkdone}
    />
  {/each}

  <!-- Add Column Card -->
  {#if !isAddingColumn}
    <button
      onclick={() => isAddingColumn = true}
      class="flex items-center justify-center gap-2 bg-theme-column/20 hover:bg-theme-column/40 border border-dashed border-theme-border/60 hover:border-theme-accent text-theme-text-muted hover:text-theme-text-main font-semibold text-sm cursor-pointer w-72 shrink-0 h-[48px] rounded transition-all shadow-sm"
    >
      <Plus class="w-4 h-4 shrink-0" />
      {t('buttons.addColumn')}
    </button>
  {:else}
    <div
      class="flex flex-col bg-theme-column/20 border border-dashed border-theme-border/60 rounded w-72 shrink-0 p-3 h-fit space-y-2.5"
    >
      <h4 class="font-bold text-xs uppercase tracking-wider text-theme-text-muted">{t('newColumnTitle')}</h4>
      <input
        bind:value={newColumnTitle}
        type="text"
        placeholder={t('columnTitlePlaceholder')}
        class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-sm text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary"
        onkeydown={(e) => {
          if (e.key === 'Enter') handleAddColumn();
          if (e.key === 'Escape') handleCancelAddColumn();
        }}
        autofocus
      />
      <input
        bind:value={newColumnSubtitle}
        type="text"
        placeholder="Column description/subtitle (optional)"
        class="w-full bg-theme-card border border-theme-border/60 rounded px-2.5 py-1.5 text-sm text-theme-text-input placeholder-theme-text-muted/50 focus:outline-none focus:border-theme-primary font-sans italic"
        onkeydown={(e) => {
          if (e.key === 'Enter') handleAddColumn();
          if (e.key === 'Escape') handleCancelAddColumn();
        }}
      />
      <div class="flex gap-1.5 justify-end">
        <button
          onclick={handleCancelAddColumn}
          class="text-xs font-semibold px-2 py-1 bg-theme-card hover:bg-theme-column/80 text-slate-200 border border-theme-border rounded cursor-pointer"
        >
          {t('buttons.cancel')}
        </button>
        <button
          onclick={handleAddColumn}
          class="text-xs font-semibold px-2 py-1 bg-theme-primary hover:bg-theme-primary-hover text-white rounded cursor-pointer"
        >
          {t('buttons.add')}
        </button>
      </div>
    </div>
  {/if}
</div>
