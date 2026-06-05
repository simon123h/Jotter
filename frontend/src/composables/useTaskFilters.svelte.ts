import { router } from '@/router';
import type { Task, TaskFilterParams } from '@/types';

export function useTaskFilters(getTasks: () => Task[]) {
  let searchQueryVal = $state('');
  let selectedTagsVal = $state<string[]>([]);
  let taskFiltersVal = $state<TaskFilterParams>({});

  const hasActiveFilters = $derived.by(() => {
    const f = taskFiltersVal;
    return !!(
      f.buckets ||
      f.priorities ||
      f.tags ||
      f.search ||
      f.due_after ||
      f.due_before ||
      (f.has_due_date !== undefined && f.has_due_date !== null)
    );
  });

  const applyFilters = (filters: TaskFilterParams) => {
    taskFiltersVal = filters;
    searchQueryVal = filters.search || '';
    selectedTagsVal = filters.tags
      ? filters.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  };

  const clearFilters = () => {
    taskFiltersVal = {};
    searchQueryVal = '';
    selectedTagsVal = [];
  };

  const parseFiltersFromQuery = (q: Record<string, string>) => {
    let has_due_date: boolean | null = null;
    if (q.has_due_date === 'true') has_due_date = true;
    else if (q.has_due_date === 'false') has_due_date = false;

    const filters: TaskFilterParams = {
      search: q.search || undefined,
      buckets: q.buckets || undefined,
      priorities: q.priorities || undefined,
      tags: q.tags || undefined,
      tag_mode: (q.tag_mode as 'any' | 'all') || undefined,
      show_done: q.show_done === 'true' ? true : undefined,
      has_due_date,
      due_after: q.due_after || undefined,
      due_before: q.due_before || undefined,
    };

    if (JSON.stringify(taskFiltersVal) !== JSON.stringify(filters)) {
      taskFiltersVal = filters;
      searchQueryVal = filters.search || '';
      selectedTagsVal = filters.tags
        ? filters.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    }
  };

  $effect(() => {
    parseFiltersFromQuery(router.current.query);
  });

  $effect(() => {
    taskFiltersVal.search = searchQueryVal.trim() || undefined;
  });

  $effect(() => {
    taskFiltersVal.tags = selectedTagsVal.length ? selectedTagsVal.join(',') : undefined;
  });

  $effect(() => {
    const query = { ...router.current.query };
    const newFilters = taskFiltersVal;

    if (newFilters.search) query.search = newFilters.search;
    else delete query.search;

    if (newFilters.buckets) query.buckets = newFilters.buckets;
    else delete query.buckets;

    if (newFilters.priorities) query.priorities = newFilters.priorities;
    else delete query.priorities;

    if (newFilters.tags) query.tags = newFilters.tags;
    else delete query.tags;

    if (newFilters.tag_mode) query.tag_mode = newFilters.tag_mode;
    else delete query.tag_mode;

    if (newFilters.show_done) query.show_done = 'true';
    else delete query.show_done;

    if (newFilters.has_due_date !== undefined && newFilters.has_due_date !== null) {
      query.has_due_date = String(newFilters.has_due_date);
    } else {
      delete query.has_due_date;
    }

    if (newFilters.due_after) query.due_after = newFilters.due_after;
    else delete query.due_after;

    if (newFilters.due_before) query.due_before = newFilters.due_before;
    else delete query.due_before;

    if (JSON.stringify(router.current.query) !== JSON.stringify(query)) {
      router.replace({ query });
    }
  });

  const filteredTasks = $derived.by(() => {
    let list = getTasks();

    const searchVal = (taskFiltersVal.search || searchQueryVal || '').trim().toLowerCase();
    if (searchVal) {
      list = list.filter((task) => {
        return task.title.toLowerCase().includes(searchVal) || (task.body && task.body.toLowerCase().includes(searchVal));
      });
    }

    if (taskFiltersVal.buckets) {
      const bucketList = taskFiltersVal.buckets
        .split(',')
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean);
      if (bucketList.length) {
        list = list.filter((t) => bucketList.includes(t.bucket.toLowerCase()));
      }
    }

    if (taskFiltersVal.priorities) {
      const priorityList = taskFiltersVal.priorities
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      if (priorityList.length) {
        list = list.filter((t) => {
          const priority = (t.priority || 'none').toLowerCase();
          return priorityList.includes(priority);
        });
      }
    }

    const modalTags = taskFiltersVal.tags
      ? taskFiltersVal.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const combinedTags = Array.from(new Set([...selectedTagsVal.map((t) => t.toLowerCase()), ...modalTags]));

    if (combinedTags.length > 0) {
      const mode = taskFiltersVal.tag_mode || 'any';
      if (mode === 'all') {
        list = list.filter((t) => combinedTags.every((ft) => t.tags.some((tg) => tg.toLowerCase() === ft)));
      } else {
        list = list.filter((t) => combinedTags.some((ft) => t.tags.some((tg) => tg.toLowerCase() === ft)));
      }
    }

    if (taskFiltersVal.has_due_date !== undefined && taskFiltersVal.has_due_date !== null) {
      if (taskFiltersVal.has_due_date) {
        list = list.filter((t) => !!t.due_date);
      } else {
        list = list.filter((t) => !t.due_date);
      }
    }

    if (taskFiltersVal.due_before) {
      list = list.filter((t) => !!t.due_date && t.due_date <= taskFiltersVal.due_before!);
    }
    if (taskFiltersVal.due_after) {
      list = list.filter((t) => !!t.due_date && t.due_date >= taskFiltersVal.due_after!);
    }

    return list;
  });

  return {
    get searchQuery() { return searchQueryVal; },
    set searchQuery(v) { searchQueryVal = v; },

    get selectedTags() { return selectedTagsVal; },
    set selectedTags(v) { selectedTagsVal = v; },

    get taskFilters() { return taskFiltersVal; },
    set taskFilters(v) { taskFiltersVal = v; },

    get hasActiveFilters() { return hasActiveFilters; },
    get filteredTasks() { return filteredTasks; },

    applyFilters,
    clearFilters,
  };
}
