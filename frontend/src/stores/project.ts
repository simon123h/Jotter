import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Project, Task, Bucket } from '@/types';
import { getProjects, getBuckets, getTasks, getAllTasks, syncSystem } from '@/api';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const buckets = ref<Bucket[]>([]);
  const tasks = ref<Task[]>([]);

  const loading = ref(false);
  const syncLoading = ref(false);
  const syncSuccess = ref(false);
  const error = ref<string | null>(null);

  const fetchProjects = async () => {
    try {
      projects.value = await getProjects();
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

  const fetchTasks = async (projectId: string, viewMode: string, hideDone: boolean, hideArchive: boolean) => {
    if (viewMode === 'super-time') {
      loading.value = true;
      try {
        tasks.value = await getAllTasks({
          exclude_buckets: 'done,archive',
        });
      } catch (err: any) {
        error.value = err.message || 'Failed to fetch all tasks';
      } finally {
        loading.value = false;
      }
      return;
    }

    if (!projectId || projectId === '') {
      tasks.value = [];
      return;
    }

    loading.value = true;
    try {
      const excludeList = [];
      if (hideDone) excludeList.push('done');
      if (hideArchive) excludeList.push('archive');

      tasks.value = await getTasks(projectId, {
        exclude_buckets: excludeList.length > 0 ? excludeList.join(',') : undefined,
      });
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch tasks';
    } finally {
      loading.value = false;
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
    fetchProjects,
    fetchBuckets,
    fetchTasks,
    triggerSync,
  };
});
