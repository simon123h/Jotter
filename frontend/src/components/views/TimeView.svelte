<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import Sortable from 'sortablejs';
  import type { Task } from '@/types';
  import TaskCard from '@/components/ui/TaskCard.svelte';
  import { useI18n } from '@/composables/useI18n';

  let {
    tasks = [],
    ontaskclick,
    onmarkdone,
    onupdateduedate
  } = $props<{
    tasks: Task[];
    ontaskclick?: (task: Task) => void;
    onmarkdone?: (task: Task) => void;
    onupdateduedate?: (payload: { taskId: string; columnId: string }) => void;
  }>();

  const { t } = useI18n();

  export type TimeColumnId = 'noDate' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'thisYear';

  const timeColumns = $derived.by(() => {
    const groups: Record<TimeColumnId, Task[]> = {
      noDate: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      thisMonth: [],
      thisYear: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach((task) => {
      if (task.bucket === 'done') return;

      if (!task.due_date) {
        groups.noDate.push(task);
        return;
      }

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        groups.today.push(task);
      } else if (diffDays === 1) {
        groups.tomorrow.push(task);
      } else if (diffDays > 1 && diffDays <= 7) {
        groups.thisWeek.push(task);
      } else if (diffDays > 7 && diffDays <= 30) {
        groups.thisMonth.push(task);
      } else {
        groups.thisYear.push(task);
      }
    });

    return [
      { id: 'noDate' as TimeColumnId, title: t('timeView.noDate'), tasks: groups.noDate, bgClass: 'bg-slate-500/5' },
      { id: 'today' as TimeColumnId, title: t('timeView.today'), tasks: groups.today, bgClass: 'bg-red-500/5' },
      { id: 'tomorrow' as TimeColumnId, title: t('timeView.tomorrow'), tasks: groups.tomorrow, bgClass: 'bg-orange-500/5' },
      { id: 'thisWeek' as TimeColumnId, title: t('timeView.thisWeek'), tasks: groups.thisWeek, bgClass: 'bg-yellow-500/5' },
      { id: 'thisMonth' as TimeColumnId, title: t('timeView.thisMonth'), tasks: groups.thisMonth, bgClass: 'bg-blue-500/5' },
      { id: 'thisYear' as TimeColumnId, title: t('timeView.thisYear'), tasks: groups.thisYear, bgClass: 'bg-emerald-500/5' },
    ];
  });

  let columnsContainer = $state<HTMLElement | null>(null);
  let sortableInstances: Sortable[] = [];

  const destroySortables = () => {
    sortableInstances.forEach((s) => s.destroy());
    sortableInstances = [];
  };

  const initSortable = () => {
    destroySortables();
    if (!columnsContainer) return;

    const cardContainers = columnsContainer.querySelectorAll<HTMLElement>('[data-column-id]');
    cardContainers.forEach((container) => {
      const instance = Sortable.create(container, {
        group: 'time-view',
        animation: 180,
        delay: 0,
        ghostClass: 'opacity-40',
        chosenClass: 'scale-[1.02]',
        dragClass: 'rotate-1',
        onEnd: (evt) => {
          const { item, from, to, oldIndex } = evt;
          if (from === to) return;

          const taskId = item.getAttribute('data-task-id') || '';
          const columnId = to.getAttribute('data-column-id') as string;

          if (!taskId || !columnId) return;

          // Revert Sortable's DOM manipulation before emitting to let Svelte handle re-render
          to.removeChild(item);
          if (oldIndex != null && from.children[oldIndex]) {
            from.insertBefore(item, from.children[oldIndex]);
          } else {
            from.appendChild(item);
          }

          onupdateduedate?.({ taskId, columnId });
        },
      });
      sortableInstances.push(instance);
    });
  };

  onMount(() => {
    initSortable();
  });

  onDestroy(() => {
    destroySortables();
  });

  $effect(() => {
    timeColumns;
    tick().then(() => {
      initSortable();
    });
  });
</script>

<div bind:this={columnsContainer} class="flex gap-3.5 items-stretch overflow-x-auto pb-2 h-full select-none w-full scroller-thin">
  {#each timeColumns as col (col.id)}
    <div
      class="flex flex-col bg-theme-column border border-theme-border rounded w-72 shrink-0 md:w-80 group/col h-fit max-h-full"
    >
      <!-- Column Header -->
      <div
        class="px-3.5 py-2.5 flex justify-between items-center border-b border-theme-border rounded-t shrink-0 min-h-[48px] {col.bgClass}"
      >
        <div class="flex items-center gap-2 min-w-0">
          <h3 class="font-bold text-sm uppercase tracking-wider text-theme-text-main truncate">
            {col.title}
          </h3>
          <span class="text-xs px-1.5 py-0.25 bg-theme-card border border-theme-border/60 text-theme-text-muted font-bold rounded shrink-0">
            {col.tasks.length}
          </span>
        </div>
      </div>

      <div class="flex-grow relative flex flex-col min-h-0">
        <!-- Empty state overlay -->
        {#if !col.tasks.length}
          <div
            class="absolute inset-0 flex items-center justify-center text-theme-text-muted italic text-xs pointer-events-none z-0"
          >
            {t('timeView.emptyColumn')}
          </div>
        {/if}

        <!-- Sortable drop zone -->
        <div data-column-id={col.id} class="p-2.5 overflow-y-auto space-y-2.5 min-h-[150px] flex-grow scroller-thin relative z-10">
          {#each col.tasks as task (task.id)}
            <div data-task-id={task.id}>
              <TaskCard
                {task}
                onclick={ontaskclick}
                onmarkdone={onmarkdone}
              />
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/each}
</div>
