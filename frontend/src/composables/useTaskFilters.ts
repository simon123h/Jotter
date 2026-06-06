import { ref, computed, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Task, TaskFilterParams } from '@/types';

export function useTaskFilters(tasks: Ref<Task[]>) {
  const route = useRoute();
  const router = useRouter();

  const searchQuery = ref('');
  const selectedTags = ref<string[]>([]);
  const taskFilters = ref<TaskFilterParams>({});

  const hasActiveFilters = computed(() => {
    const f = taskFilters.value;
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
    taskFilters.value = filters;
    searchQuery.value = filters.search || '';
    selectedTags.value = filters.tags
      ? filters.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  };

  const clearFilters = () => {
    taskFilters.value = {};
    searchQuery.value = '';
    selectedTags.value = [];
  };

  // Sync searchQuery to taskFilters
  watch(searchQuery, (newVal) => {
    taskFilters.value.search = newVal.trim() || undefined;
  });

  // Sync selectedTags to taskFilters
  watch(
    selectedTags,
    (newVal) => {
      taskFilters.value.tags = newVal.length ? newVal.join(',') : undefined;
    },
    { deep: true }
  );

  // Parse URL query parameters to taskFilters
  const parseFiltersFromQuery = (q: any) => {
    let has_due_date: boolean | null = null;
    if (q.has_due_date === 'true') has_due_date = true;
    else if (q.has_due_date === 'false') has_due_date = false;

    const filters: TaskFilterParams = {
      search: (q.search as string) || undefined,
      buckets: (q.buckets as string) || undefined,
      priorities: (q.priorities as string) || undefined,
      tags: (q.tags as string) || undefined,
      tag_mode: (q.tag_mode as 'any' | 'all') || undefined,
      show_done: q.show_done === 'true' ? true : undefined,
      show_archived: q.show_archived === 'true' ? true : undefined,
      has_due_date,
      due_after: (q.due_after as string) || undefined,
      due_before: (q.due_before as string) || undefined,
    };

    if (JSON.stringify(taskFilters.value) !== JSON.stringify(filters)) {
      taskFilters.value = filters;
      searchQuery.value = filters.search || '';
      selectedTags.value = filters.tags
        ? filters.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    }
  };

  watch(
    () => route.query,
    (newQuery) => {
      parseFiltersFromQuery(newQuery);
    },
    { immediate: true }
  );

  // Sync taskFilters back to URL query parameters
  watch(
    taskFilters,
    (newFilters) => {
      const query = { ...route.query };

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

      if (newFilters.show_archived) query.show_archived = 'true';
      else delete query.show_archived;

      if (newFilters.has_due_date !== undefined && newFilters.has_due_date !== null) {
        query.has_due_date = String(newFilters.has_due_date);
      } else {
        delete query.has_due_date;
      }

      if (newFilters.due_after) query.due_after = newFilters.due_after;
      else delete query.due_after;

      if (newFilters.due_before) query.due_before = newFilters.due_before;
      else delete query.due_before;

      if (JSON.stringify(route.query) !== JSON.stringify(query)) {
        router.replace({ query });
      }
    },
    { deep: true }
  );

  // Compute the filtered task list
  const filteredTasks = computed(() => {
    let list = tasks.value;

    const searchVal = (taskFilters.value.search || searchQuery.value || '').trim().toLowerCase();
    if (searchVal) {
      list = list.filter((task) => {
        return task.title.toLowerCase().includes(searchVal) || (task.body && task.body.toLowerCase().includes(searchVal));
      });
    }

    if (taskFilters.value.buckets) {
      const bucketList = taskFilters.value.buckets
        .split(',')
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean);
      if (bucketList.length) {
        list = list.filter((t) => bucketList.includes(t.bucket.toLowerCase()));
      }
    }

    if (taskFilters.value.priorities) {
      const priorityList = taskFilters.value.priorities
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

    const modalTags = taskFilters.value.tags
      ? taskFilters.value.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const combinedTags = Array.from(new Set([...selectedTags.value.map((t) => t.toLowerCase()), ...modalTags]));

    if (combinedTags.length > 0) {
      const mode = taskFilters.value.tag_mode || 'any';
      if (mode === 'all') {
        list = list.filter((t) => combinedTags.every((ft) => (t.tags ?? []).some((tg) => tg.toLowerCase() === ft)));
      } else {
        list = list.filter((t) => combinedTags.some((ft) => (t.tags ?? []).some((tg) => tg.toLowerCase() === ft)));
      }
    }

    if (taskFilters.value.has_due_date !== undefined && taskFilters.value.has_due_date !== null) {
      if (taskFilters.value.has_due_date) {
        list = list.filter((t) => !!t.due_date);
      } else {
        list = list.filter((t) => !t.due_date);
      }
    }

    if (taskFilters.value.due_before) {
      list = list.filter((t) => !!t.due_date && t.due_date <= taskFilters.value.due_before!);
    }
    if (taskFilters.value.due_after) {
      list = list.filter((t) => !!t.due_date && t.due_date >= taskFilters.value.due_after!);
    }

    return list;
  });

  return {
    searchQuery,
    selectedTags,
    taskFilters,
    hasActiveFilters,
    filteredTasks,
    applyFilters,
    clearFilters,
  };
}
