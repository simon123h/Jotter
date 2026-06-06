import { ref, type Ref } from 'vue';
import type { Task, BucketName } from '@/types';
import { moveTask, updateTask } from '@/api';
import { useI18n } from '@/composables/useI18n';

export function useTaskMutations(
  tasks: Ref<Task[]>,
  activeProjectId: Ref<string>,
  fetchBuckets: () => Promise<void>,
  fetchAllTasks: () => Promise<void>
) {
  const { t } = useI18n();
  const error = ref<string | null>(null);

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
    // Calculate new position using sibling tasks
    let newPosition: number;

    if (prevTaskId === null && nextTaskId === null) {
      const targetBucketTasks = tasks.value.filter((t) => t.bucket === toBucket).sort((a, b) => a.position - b.position);
      const otherTasks = targetBucketTasks.filter((t) => t.id !== taskId);
      if (otherTasks.length === 0) {
        newPosition = 1000.0;
      } else {
        newPosition = otherTasks[otherTasks.length - 1].position + 1000.0;
      }
    } else if (prevTaskId === null) {
      const nextTask = tasks.value.find((t) => t.id === nextTaskId);
      newPosition = nextTask ? nextTask.position - 1000.0 : 1000.0;
    } else if (nextTaskId === null) {
      const prevTask = tasks.value.find((t) => t.id === prevTaskId);
      newPosition = prevTask ? prevTask.position + 1000.0 : 1000.0;
    } else {
      const prevTask = tasks.value.find((t) => t.id === prevTaskId);
      const nextTask = tasks.value.find((t) => t.id === nextTaskId);
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

    // Optimistic UI updates
    const movedTask = tasks.value.find((t) => t.id === taskId);
    if (movedTask) {
      const originalBucket = movedTask.bucket;
      const originalPosition = movedTask.position;

      movedTask.bucket = toBucket;
      movedTask.position = newPosition;

      try {
        await moveTask(activeProjectId.value, taskId, toBucket, newPosition);
      } catch {
        // Revert if API call fails
        movedTask.bucket = originalBucket;
        movedTask.position = originalPosition;
        error.value = t('errors.moveTask');
      }
    }
  };

  const handleMarkTaskDone = async (task: Task) => {
    try {
      const targetBucketTasks = tasks.value
        .filter((t) => t.bucket === 'done' && t.project_id === task.project_id)
        .sort((a, b) => a.position - b.position);
      const newPosition = targetBucketTasks.length > 0 ? targetBucketTasks[targetBucketTasks.length - 1].position + 1000.0 : 1000.0;

      await moveTask(task.project_id, task.id, 'done', newPosition);
      await fetchBuckets();
      await fetchAllTasks();
    } catch (err: any) {
      error.value = err.message || 'Failed to mark task as done';
    }
  };

  const handleTimeViewPlannedDateUpdate = async ({
    taskId,
    plannedDate,
    projectId,
  }: {
    taskId: string;
    plannedDate: string;
    projectId?: string;
  }) => {
    // Optimistic local update
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;

    const originalPlannedDate = task.planned_date;
    task.planned_date = plannedDate;

    try {
      const pId = projectId || activeProjectId.value;
      await updateTask(pId, taskId, { planned_date: plannedDate });
    } catch (err: any) {
      task.planned_date = originalPlannedDate;
      error.value = err.message || 'Failed to update planned date';
    }
  };

  const handleTagUpdate = async ({ taskId, tags }: { taskId: string; tags: string[] }) => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;

    const originalTags = [...task.tags];
    task.tags = tags;

    try {
      const pId = task.project_id || activeProjectId.value;
      await updateTask(pId, taskId, { tags });
    } catch (err: any) {
      task.tags = originalTags;
      error.value = err.message || 'Failed to update tags';
    }
  };

  return {
    error,
    handleCardDropped,
    handleMarkTaskDone,
    handleTimeViewPlannedDateUpdate,
    handleTagUpdate,
  };
}
