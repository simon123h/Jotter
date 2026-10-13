import { ref, computed, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Task, TaskFilterParams } from '@/types';
import { filterTasks, parseTags } from '@jotter/task-filter';
import { parseDSL, stringifyDSL } from '@/utils/dsl';
import { useProjectStore } from '@/stores/project';

export function useTaskFilters(tasks: Ref<Task[]>, options: { syncRoute?: boolean } = {}) {
  const syncRoute = options.syncRoute ?? true;
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
      f.created_after ||
      f.created_before ||
      f.updated_after ||
      f.updated_before ||
      f.project ||
      (f.has_due_date !== undefined && f.has_due_date !== null)
    );
  });

  const applyFilters = (filters: TaskFilterParams) => {
    taskFilters.value = filters;
    searchQuery.value = stringifyDSL(filters);
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

  // Parse searchQuery into taskFilters
  watch(searchQuery, (newVal) => {
    const parsed = parseDSL(newVal);
    // Only update taskFilters if parsed values actually differ to avoid infinite cycles
    if (JSON.stringify(taskFilters.value) !== JSON.stringify(parsed)) {
      taskFilters.value = parsed;
    }
  });

  // Sync selectedTags to taskFilters
  watch(
    selectedTags,
    (newVal) => {
      const tagsStr = newVal.length ? newVal.join(',') : undefined;
      if (taskFilters.value.tags !== tagsStr) {
        taskFilters.value.tags = tagsStr;
      }
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
      has_due_date,
      due_after: (q.due_after as string) || undefined,
      due_before: (q.due_before as string) || undefined,
      project: (q.project as string) || undefined,
    };

    if (JSON.stringify(taskFilters.value) !== JSON.stringify(filters)) {
      taskFilters.value = filters;
      searchQuery.value = stringifyDSL(filters);
      selectedTags.value = filters.tags
        ? filters.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    }
  };

  watch(
    () => route?.query,
    (newQuery) => {
      if (newQuery) {
        parseFiltersFromQuery(newQuery);
      }
    },
    { immediate: true }
  );

  // Sync taskFilters back to URL query parameters
  watch(
    taskFilters,
    (newFilters) => {
      const query = { ...(route?.query || {}) };

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

      if (newFilters.has_due_date !== undefined && newFilters.has_due_date !== null) {
        query.has_due_date = String(newFilters.has_due_date);
      } else {
        delete query.has_due_date;
      }

      if (newFilters.due_after) query.due_after = newFilters.due_after;
      else delete query.due_after;

      if (newFilters.due_before) query.due_before = newFilters.due_before;
      else delete query.due_before;

      if (newFilters.project) query.project = newFilters.project;
      else delete query.project;

      if (syncRoute && route && JSON.stringify(route.query) !== JSON.stringify(query)) {
        router.replace({ query });
      }

      // Sync stringified dsl back to searchQuery if they differ
      const stringified = stringifyDSL(newFilters);
      if (searchQuery.value !== stringified) {
        searchQuery.value = stringified;
      }
    },
    { deep: true }
  );

  // The tasks that match: the matching itself is the shared one (packages/task-filter), as on the phone and in the
  // backend. It cannot tell a project from a task alone, so the tasks are narrowed to the project here.
  const filteredTasks = computed(() => {
    let list = tasks.value;

    const projectQuery = (taskFilters.value.project || '').toLowerCase();
    if (projectQuery) {
      let projectStore;
      try {
        projectStore = useProjectStore();
      } catch {
        // Safe fallback if called outside pinia context
      }
      const projectsList = projectStore?.projects || [];

      list = list.filter((task) => {
        // 1. Direct match on ID
        if (task.project_id.toLowerCase() === projectQuery) return true;

        // 2. Fuzzy match on title
        const proj = projectsList.find((p) => p.id === task.project_id);
        return (proj?.title || '').toLowerCase().includes(projectQuery);
      });
    }

    // The tags of the dialog and the ones chosen on the cards count together
    const tags = parseTags([...selectedTags.value, taskFilters.value.tags ?? '']).join(',');
    return filterTasks(list, { ...taskFilters.value, project: undefined, tags: tags || undefined });
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
