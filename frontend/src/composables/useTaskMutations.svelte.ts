import type { Task, BucketName } from '@/types';
import { moveTask, updateTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { settingsStore } from '@/stores/settings';

export function useTaskMutations(
  getTasks: () => Task[],
  fetchBuckets: () => Promise<void>,
  fetchAllTasks: () => Promise<void>
) {
  const { t } = useI18n();
  let errorVal = $state<string | null>(null);

  const handleCardDropped = async ({
    taskId,
    toBucket,
    prevTaskId,
    nextTaskId,
  }: {
    taskId: string;
    toBucket: BucketName;
    prevTaskId: string | null;
    nextTaskId: string | null;
  }) => {
    const tasksList = getTasks();
    let newPosition: number;

    if (prevTaskId === null && nextTaskId === null) {
      const targetBucketTasks = tasksList.filter((t) => t.bucket === toBucket).sort((a, b) => a.position - b.position);
      const otherTasks = targetBucketTasks.filter((t) => t.id !== taskId);
      if (otherTasks.length === 0) {
        newPosition = 1000.0;
      } else {
        newPosition = otherTasks[otherTasks.length - 1].position + 1000.0;
      }
    } else if (prevTaskId === null) {
      const nextTask = tasksList.find((t) => t.id === nextTaskId);
      newPosition = nextTask ? nextTask.position - 1000.0 : 1000.0;
    } else if (nextTaskId === null) {
      const prevTask = tasksList.find((t) => t.id === prevTaskId);
      newPosition = prevTask ? prevTask.position + 1000.0 : 1000.0;
    } else {
      const prevTask = tasksList.find((t) => t.id === prevTaskId);
      const nextTask = tasksList.find((t) => t.id === nextTaskId);
      if (prevTask && nextTask) {
        newPosition = (prevTask.position + nextTask.position) / 2.0;
      } else if (prevTask) {
        newPosition = prevTask.position + 1000.0;
      } else if (nextTask) {
        newPosition = nextTask.position - 1000.0;
      } else {
        newPosition = 1000.0;
      }
    }

    const movedTask = tasksList.find((t) => t.id === taskId);
    if (movedTask) {
      const originalBucket = movedTask.bucket;
      const originalPosition = movedTask.position;

      movedTask.bucket = toBucket;
      movedTask.position = newPosition;

      try {
        await moveTask(settingsStore.activeProjectId, taskId, toBucket, newPosition);
      } catch {
        movedTask.bucket = originalBucket;
        movedTask.position = originalPosition;
        errorVal = t('errors.moveTask');
      }
    }
  };

  const handleMarkTaskDone = async (task: Task) => {
    try {
      const tasksList = getTasks();
      const targetBucketTasks = tasksList.filter((t) => t.bucket === 'done').sort((a, b) => a.position - b.position);
      const newPosition = targetBucketTasks.length > 0 ? targetBucketTasks[targetBucketTasks.length - 1].position + 1000.0 : 1000.0;

      await moveTask(settingsStore.activeProjectId, task.id, 'done', newPosition);
      await fetchBuckets();
      await fetchAllTasks();
    } catch (err: any) {
      errorVal = err.message || 'Failed to mark task as done';
    }
  };

  const handleTimeViewDueDateUpdate = async ({ taskId, columnId }: { taskId: string; columnId: string }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newDueDate: string | null;

    switch (columnId) {
      case 'today':
        newDueDate = formatDateISO(today);
        break;
      case 'tomorrow': {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        newDueDate = formatDateISO(d);
        break;
      }
      case 'thisWeek': {
        const d = new Date(today);
        const dayOfWeek = d.getDay();
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        d.setDate(d.getDate() + daysUntilSunday);
        newDueDate = formatDateISO(d);
        break;
      }
      case 'thisMonth': {
        const d = new Date(today);
        d.setDate(d.getDate() + 30);
        newDueDate = formatDateISO(d);
        break;
      }
      case 'thisYear': {
        const d = new Date(today.getFullYear(), 11, 31);
        newDueDate = formatDateISO(d);
        break;
      }
      case 'noDate':
      default:
        newDueDate = null;
        break;
    }

    const tasksList = getTasks();
    const task = tasksList.find((t) => t.id === taskId);
    if (!task) return;

    const originalDueDate = task.due_date;
    task.due_date = newDueDate ?? undefined;

    try {
      await updateTask(settingsStore.activeProjectId, taskId, { due_date: newDueDate as any });
    } catch (err: any) {
      task.due_date = originalDueDate;
      errorVal = err.message || 'Failed to update due date';
    }
  };

  const formatDateISO = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    get error() { return errorVal; },
    set error(v) { errorVal = v; },
    handleCardDropped,
    handleMarkTaskDone,
    handleTimeViewDueDateUpdate,
  };
}
