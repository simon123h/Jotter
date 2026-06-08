import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Project, Task, Bucket, TaskQuery } from '@/types';
import { getProjects, getBuckets, getTasks, getAllTasks, syncSystem } from '@/api';
import { useSettingsStore } from '@/stores/settings';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const buckets = ref<Bucket[]>([]);
  const tasks = ref<Task[]>([]);

  const loading = ref(false);
  const syncLoading = ref(false);
  const syncSuccess = ref(false);
  const error = ref<string | null>(null);
  const projectsLoaded = ref(false);

  const currentQuery = ref<TaskQuery | null>(null);
  const cachedQueryKey = ref<string | null>(null);

  const fetchProjects = async () => {
    try {
      projects.value = await getProjects();
      projectsLoaded.value = true;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch projects';
    }
  };

  const fetchBuckets = async (projectId: string) => {
    if (!projectId || projectId === '') {
      buckets.value = [];
      return;
    }
    try {
      buckets.value = await getBuckets(projectId);
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch columns';
    }
  };

  const resolveExcludeBuckets = (query: TaskQuery): string => {
    if (query.excludeBuckets !== undefined) {
      return query.excludeBuckets;
    }
    const settingsStore = useSettingsStore();
    const excludeList = [];
    if (settingsStore.hideDoneColumn) excludeList.push('done');
    if (settingsStore.hideArchiveColumn) excludeList.push('archive');
    return excludeList.join(',');
  };

  const serializeQuery = (query: TaskQuery): string => {
    return JSON.stringify({
      projectId: query.projectId || '',
      isGlobal: !!query.isGlobal,
      excludeBuckets: resolveExcludeBuckets(query),
    });
  };

  const fetchTasks = async (query: TaskQuery, forceRefresh = false) => {
    const queryKey = serializeQuery(query);
    if (!forceRefresh && cachedQueryKey.value === queryKey) {
      return;
    }

    currentQuery.value = query;
    cachedQueryKey.value = queryKey;

    const resolvedExclude = resolveExcludeBuckets(query);

    loading.value = true;
    try {
      if (query.isGlobal) {
        tasks.value = await getAllTasks({
          exclude_buckets: resolvedExclude || undefined,
        });
      } else {
        const projectId = query.projectId || '';
        if (!projectId || projectId === '') {
          tasks.value = [];
          return;
        }
        tasks.value = await getTasks(projectId, {
          exclude_buckets: resolvedExclude || undefined,
        });
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch tasks';
    } finally {
      loading.value = false;
    }
  };

  const invalidate = async () => {
    if (currentQuery.value) {
      await fetchTasks(currentQuery.value, true);
    }
  };

  const triggerSync = async () => {
    syncLoading.value = true;
    syncSuccess.value = false;
    error.value = null;
    try {
      await syncSystem();
      syncSuccess.value = true;
      setTimeout(() => {
        syncSuccess.value = false;
      }, 2000);
      await fetchProjects();
      if (currentQuery.value) {
        if (currentQuery.value.projectId) {
          await fetchBuckets(currentQuery.value.projectId);
        }
        await invalidate();
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to synchronize';
      throw err;
    } finally {
      syncLoading.value = false;
    }
  };

  return {
    projects,
    buckets,
    tasks,
    loading,
    syncLoading,
    syncSuccess,
    error,
    projectsLoaded,
    currentQuery,
    cachedQueryKey,
    fetchProjects,
    fetchBuckets,
    fetchTasks,
    invalidate,
    triggerSync,
  };
});
