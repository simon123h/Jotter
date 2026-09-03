import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { Project, Task, Bucket, TaskQuery } from '@/types';
import { getProjects, getBuckets, getTasks, getAllTasks, syncSystem, updateTask, restoreCommit } from '@/api';
import { useSettingsStore } from '@/stores/settings';
import { useTimeblockStore } from '@/stores/timeblock';

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
      if (error.value && error.value.includes('project')) {
        error.value = null;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch projects';
    }
  };

  const fetchBuckets = async (projectId: string) => {
    if (!projectId || projectId === '' || projectId === 'null' || projectId === 'undefined') {
      buckets.value = [];
      return;
    }
    // If projects are already loaded and the project doesn't exist, don't spam 404 errors
    if (projectsLoaded.value && projectId !== 'all' && projects.value.length > 0 && !projects.value.some((p) => p.id === projectId)) {
      buckets.value = [];
      return;
    }
    if (projectId === 'all') {
      try {
        if (projects.value.length === 0) {
          await fetchProjects();
        }
        const allBucketsPromises = projects.value.map((p) => getBuckets(p.id).catch(() => [] as Bucket[]));
        const allBucketsLists = await Promise.all(allBucketsPromises);

        const aggregatedMap = new Map<string, Bucket>();
        allBucketsLists.forEach((bucketsList) => {
          bucketsList.forEach((b) => {
            if (!aggregatedMap.has(b.name)) {
              aggregatedMap.set(b.name, { ...b });
            }
          });
        });

        buckets.value = Array.from(aggregatedMap.values()).sort((a, b) => a.position - b.position);
      } catch (err: any) {
        error.value = err.message || 'Failed to aggregate columns';
      }
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
    if (settingsStore.hidePostponedColumn) excludeList.push('postponed');
    return excludeList.join(',');
  };

  const serializeQuery = (query: TaskQuery): string => {
    return JSON.stringify({
      projectId: query.projectId || '',
      isGlobal: !!query.isGlobal || query.projectId === 'all',
      excludeBuckets: resolveExcludeBuckets(query),
    });
  };

  const fetchTasks = async (query: TaskQuery, forceRefresh = false) => {
    if (!query.projectId || query.projectId === 'null' || query.projectId === 'undefined') {
      tasks.value = [];
      loading.value = false;
      return;
    }

    // If projects are already loaded and the queried project doesn't exist, don't spam 404 errors
    if (
      projectsLoaded.value &&
      query.projectId !== 'all' &&
      projects.value.length > 0 &&
      !projects.value.some((p) => p.id === query.projectId)
    ) {
      tasks.value = [];
      loading.value = false;
      return;
    }

    const queryKey = serializeQuery(query);
    if (!forceRefresh && cachedQueryKey.value === queryKey) {
      return;
    }

    currentQuery.value = query;
    cachedQueryKey.value = queryKey;

    const resolvedExclude = resolveExcludeBuckets(query);

    loading.value = true;
    try {
      if (query.projectId === 'all' || query.isGlobal) {
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
    const promises: Promise<any>[] = [];
    if (currentQuery.value) {
      promises.push(fetchTasks(currentQuery.value, true));
    }
    const timeblockStore = useTimeblockStore();
    promises.push(timeblockStore.fetchTimeblocks().catch(() => {}));
    await Promise.all(promises);
  };

  const triggerSync = async () => {
    if (syncLoading.value) return;
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

  const restoreToCommit = async (commitHash: string, projectId?: string) => {
    syncLoading.value = true;
    syncSuccess.value = false;
    error.value = null;
    try {
      await restoreCommit(commitHash, projectId);
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
      error.value = err.message || 'Failed to restore commit';
      throw err;
    } finally {
      syncLoading.value = false;
    }
  };

  const moveTasksToProject = async (
    taskIds: string[],
    targetProjectId: string,
    options?: { resetToDefaultBucket?: boolean; currentProjectId?: string }
  ) => {
    let targetBucket: string | undefined = undefined;

    if (options?.resetToDefaultBucket) {
      const targetBuckets = await getBuckets(targetProjectId);
      const defCol = targetBuckets.find((b) => b.is_default);
      targetBucket = defCol?.name || targetBuckets[0]?.name || 'todo';
    }

    for (const taskId of taskIds) {
      const task = tasks.value.find((t) => t.id === taskId);
      const currentProjId = task ? task.project_id : options?.currentProjectId || '';
      if (currentProjId && targetProjectId !== currentProjId) {
        const payload: any = { project_id: targetProjectId };
        if (targetBucket) {
          payload.bucket = targetBucket;
          payload.position = 1000.0;
        }
        await updateTask(currentProjId, taskId, payload);
      }
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
    restoreToCommit,
    moveTasksToProject,
  };
});
