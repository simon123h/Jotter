import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Timeblock } from '@/types';
import {
  getTimeblocks,
  createTimeblock as apiCreateTimeblock,
  updateTimeblock as apiUpdateTimeblock,
  deleteTimeblock as apiDeleteTimeblock,
  allocateTaskToTimeblock as apiAllocateTask,
} from '@/api';
import { useToast } from '@/composables/useToast';

function matchesTimeblockDate(tb: Timeblock, targetDateStr: string): boolean {
  if (!tb.recurrence || tb.recurrence === 'none') {
    return tb.date === targetDateStr;
  }
  if (targetDateStr < tb.date) return false;
  const anchor = new Date(tb.date + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  const diffDays = Math.round((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  if (tb.recurrence === 'daily') return true;
  if (tb.recurrence === 'weekdays') {
    const day = target.getDay();
    return day >= 1 && day <= 5;
  }
  if (tb.recurrence === 'weekly') return diffDays % 7 === 0;
  if (tb.recurrence === 'bi-weekly') return diffDays % 14 === 0;
  return false;
}

export const useTimeblockStore = defineStore('timeblock', () => {
  const timeblocks = ref<Timeblock[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const toast = useToast();

  const timeblockForTask = computed(() => {
    return (taskId: string): Timeblock | undefined => {
      return timeblocks.value.find((tb) => tb.task_ids && tb.task_ids.includes(taskId));
    };
  });

  const timeblocksByDate = computed(() => {
    return (dateStr: string): Timeblock[] => {
      return timeblocks.value.filter((tb) => matchesTimeblockDate(tb, dateStr)).sort((a, b) => a.start_time.localeCompare(b.start_time));
    };
  });

  const fetchTimeblocks = async (startDate?: string, endDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      timeblocks.value = await getTimeblocks({ startDate, endDate });
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch time blocks';
      toast.error(error.value || 'Failed to fetch time blocks');
    } finally {
      loading.value = false;
    }
  };

  const createTimeblock = async (data: Omit<Timeblock, 'id'>): Promise<Timeblock> => {
    try {
      const created = await apiCreateTimeblock(data);
      timeblocks.value.push(created);
      return created;
    } catch (err: any) {
      const msg = err.message || 'Failed to create time block';
      toast.error(msg);
      throw err;
    }
  };

  const updateTimeblock = async (id: string, updates: Partial<Timeblock>): Promise<Timeblock> => {
    try {
      const updated = await apiUpdateTimeblock(id, updates);
      const idx = timeblocks.value.findIndex((tb) => tb.id === id);
      if (idx !== -1) {
        timeblocks.value[idx] = updated;
      }
      return updated;
    } catch (err: any) {
      const msg = err.message || 'Failed to update time block';
      toast.error(msg);
      throw err;
    }
  };

  const deleteTimeblock = async (id: string): Promise<void> => {
    try {
      await apiDeleteTimeblock(id);
      timeblocks.value = timeblocks.value.filter((tb) => tb.id !== id);
    } catch (err: any) {
      const msg = err.message || 'Failed to delete time block';
      toast.error(msg);
      throw err;
    }
  };

  const allocateTask = async (timeblockId: string, taskId: string): Promise<void> => {
    try {
      // Optimistic update
      timeblocks.value = timeblocks.value.map((tb) => {
        if (tb.id === timeblockId) {
          const currentIds = tb.task_ids ? [...tb.task_ids] : [];
          if (!currentIds.includes(taskId)) {
            currentIds.push(taskId);
          }
          return { ...tb, task_ids: currentIds };
        } else if (tb.task_ids && tb.task_ids.includes(taskId)) {
          return { ...tb, task_ids: tb.task_ids.filter((t) => t !== taskId) };
        }
        return tb;
      });

      const updated = await apiAllocateTask(timeblockId, taskId, 'add');
      const idx = timeblocks.value.findIndex((tb) => tb.id === timeblockId);
      if (idx !== -1) {
        timeblocks.value[idx] = updated;
        timeblocks.value = [...timeblocks.value];
      }
    } catch (err: any) {
      // Refresh on error
      await fetchTimeblocks();
      const msg = err.message || 'Failed to allocate task';
      toast.error(msg);
      throw err;
    }
  };

  const unallocateTask = async (timeblockId: string, taskId: string): Promise<void> => {
    try {
      timeblocks.value = timeblocks.value.map((tb) => {
        if (tb.id === timeblockId && tb.task_ids) {
          return { ...tb, task_ids: tb.task_ids.filter((t) => t !== taskId) };
        }
        return tb;
      });

      const updated = await apiAllocateTask(timeblockId, taskId, 'remove');
      const idx = timeblocks.value.findIndex((tb) => tb.id === timeblockId);
      if (idx !== -1) {
        timeblocks.value[idx] = updated;
        timeblocks.value = [...timeblocks.value];
      }
    } catch (err: any) {
      await fetchTimeblocks();
      const msg = err.message || 'Failed to unallocate task';
      toast.error(msg);
      throw err;
    }
  };

  return {
    timeblocks,
    loading,
    error,
    timeblockForTask,
    timeblocksByDate,
    fetchTimeblocks,
    createTimeblock,
    updateTimeblock,
    deleteTimeblock,
    allocateTask,
    unallocateTask,
  };
});
