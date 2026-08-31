import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Timebox } from '@/types';
import {
  getTimeboxes,
  createTimebox as apiCreateTimebox,
  updateTimebox as apiUpdateTimebox,
  deleteTimebox as apiDeleteTimebox,
  allocateTaskToTimebox as apiAllocateTask,
} from '@/api';
import { useToast } from '@/composables/useToast';

export const useTimeboxStore = defineStore('timebox', () => {
  const timeboxes = ref<Timebox[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const toast = useToast();

  const timeboxForTask = computed(() => {
    return (taskId: string): Timebox | undefined => {
      return timeboxes.value.find((tb) => tb.taskIds && tb.taskIds.includes(taskId));
    };
  });

  const timeboxesByDate = computed(() => {
    return (dateStr: string): Timebox[] => {
      return timeboxes.value.filter((tb) => tb.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
    };
  });

  const fetchTimeboxes = async (startDate?: string, endDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      timeboxes.value = await getTimeboxes({ startDate, endDate });
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch timeboxes';
      toast.error(error.value || 'Failed to fetch timeboxes');
    } finally {
      loading.value = false;
    }
  };

  const createTimebox = async (data: Omit<Timebox, 'id'>): Promise<Timebox> => {
    try {
      const created = await apiCreateTimebox(data);
      timeboxes.value.push(created);
      return created;
    } catch (err: any) {
      const msg = err.message || 'Failed to create timebox';
      toast.error(msg);
      throw err;
    }
  };

  const updateTimebox = async (id: string, updates: Partial<Timebox>): Promise<Timebox> => {
    try {
      const updated = await apiUpdateTimebox(id, updates);
      const idx = timeboxes.value.findIndex((tb) => tb.id === id);
      if (idx !== -1) {
        timeboxes.value[idx] = updated;
      }
      return updated;
    } catch (err: any) {
      const msg = err.message || 'Failed to update timebox';
      toast.error(msg);
      throw err;
    }
  };

  const deleteTimebox = async (id: string): Promise<void> => {
    try {
      await apiDeleteTimebox(id);
      timeboxes.value = timeboxes.value.filter((tb) => tb.id !== id);
    } catch (err: any) {
      const msg = err.message || 'Failed to delete timebox';
      toast.error(msg);
      throw err;
    }
  };

  const allocateTask = async (timeboxId: string, taskId: string): Promise<void> => {
    try {
      // Optimistic update
      timeboxes.value.forEach((tb) => {
        if (tb.id !== timeboxId && tb.taskIds) {
          tb.taskIds = tb.taskIds.filter((t) => t !== taskId);
        }
      });
      const target = timeboxes.value.find((tb) => tb.id === timeboxId);
      if (target) {
        if (!target.taskIds) target.taskIds = [];
        if (!target.taskIds.includes(taskId)) {
          target.taskIds.push(taskId);
        }
      }

      const updated = await apiAllocateTask(timeboxId, taskId, 'add');
      const idx = timeboxes.value.findIndex((tb) => tb.id === timeboxId);
      if (idx !== -1) {
        timeboxes.value[idx] = updated;
      }
    } catch (err: any) {
      // Refresh on error
      await fetchTimeboxes();
      const msg = err.message || 'Failed to allocate task';
      toast.error(msg);
      throw err;
    }
  };

  const unallocateTask = async (timeboxId: string, taskId: string): Promise<void> => {
    try {
      const target = timeboxes.value.find((tb) => tb.id === timeboxId);
      if (target && target.taskIds) {
        target.taskIds = target.taskIds.filter((t) => t !== taskId);
      }

      const updated = await apiAllocateTask(timeboxId, taskId, 'remove');
      const idx = timeboxes.value.findIndex((tb) => tb.id === timeboxId);
      if (idx !== -1) {
        timeboxes.value[idx] = updated;
      }
    } catch (err: any) {
      await fetchTimeboxes();
      const msg = err.message || 'Failed to unallocate task';
      toast.error(msg);
      throw err;
    }
  };

  return {
    timeboxes,
    loading,
    error,
    timeboxForTask,
    timeboxesByDate,
    fetchTimeboxes,
    createTimebox,
    updateTimebox,
    deleteTimebox,
    allocateTask,
    unallocateTask,
  };
});
