import { ref, computed, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Task, TaskFilterParams } from '@/types';
import { filterTasks, parseTags } from '@jotter/task-filter';
import { parseDSL, stringifyDSL } from '@/utils/dsl';
import { useProjectStore } from '@/stores/project';
import { FILTER_QUERY_KEYS, filtersToRouteQuery, routeQueryToFilters } from '@/utils/filterRoute';

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
      f.planned_date ||
      f.planned_before ||
      f.planned_after ||
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

  // The filters changed because the field was typed in: what is typed stays as it is. An unfinished criterion
  // (`created:after:`) has no filter yet, and writing the filters back would empty the field under the cursor.
  let changedByTyping = false;

  // Parse searchQuery into taskFilters
  watch(searchQuery, (newVal) => {
    const parsed = parseDSL(newVal);
    // Only update taskFilters if parsed values actually differ to avoid infinite cycles
    if (JSON.stringify(taskFilters.value) !== JSON.stringify(parsed)) {
      changedByTyping = true;
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

  // A filter belongs to the project it was typed in (its columns and tags): leaving for another project clears the search
  // field. Only the instance that owns the field and the address does this, the one of the page would clear its own copy.
  if (syncRoute) {
    watch(
      () => route?.params?.projectId,
      (now, before) => {
        if (now && before && now !== before) clearFilters();
      }
    );
  }

  // Parse URL query parameters to taskFilters
  const parseFiltersFromQuery = (q: any) => {
    const filters = routeQueryToFilters(q);

    // The address is the filters written down: when it says what the field already says, the field is left as typed
    if (stringifyDSL(taskFilters.value) !== stringifyDSL(filters)) {
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
      const query: Record<string, any> = { ...(route?.query || {}) };
      for (const key of FILTER_QUERY_KEYS) delete query[key];
      Object.assign(query, filtersToRouteQuery(newFilters));

      if (syncRoute && route && JSON.stringify(route.query) !== JSON.stringify(query)) {
        router.replace({ query });
      }

      // Sync stringified dsl back to searchQuery if they differ (the cards' tags, the dialog), unless it was typed
      const typed = changedByTyping;
      changedByTyping = false;
      const stringified = stringifyDSL(newFilters);
      if (!typed && searchQuery.value !== stringified) {
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
