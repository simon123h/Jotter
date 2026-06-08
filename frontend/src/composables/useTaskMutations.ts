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
    selectedIds,
  }: {
    taskId: string;
    toBucket: BucketName;
    prevTaskId: string | null;
    nextTaskId: string | null;
    selectedIds?: Set<string>;
  }) => {
    const primaryTask = tasks.value.find((t) => t.id === taskId);
    if (!primaryTask) return;

    // In multi-selection mode, drag&dropping from and to the same column should result in a no-op.
    if (selectedIds && selectedIds.has(taskId) && selectedIds.size > 1 && primaryTask.bucket === toBucket) {
      return;
    }

    // Determine the list of tasks to move, sorted by their current positions
    let movingTasks: Task[] = [];
    if (selectedIds && selectedIds.has(taskId)) {
      const selectedSet = new Set(selectedIds);
      movingTasks = tasks.value
        .filter((t) => selectedSet.has(t.id))
        .sort((a, b) => a.position - b.position);
    } else {
      movingTasks = [primaryTask];
    }

    // Filter out all moving tasks from the target bucket to find other tasks
    const otherTasksInBucket = tasks.value
      .filter((t) => t.bucket === toBucket && !movingTasks.some((mt) => mt.id === t.id))
      .sort((a, b) => a.position - b.position);

    const k = movingTasks.length;
    const newPositions: { task: Task; position: number }[] = [];

    if (prevTaskId === null && nextTaskId === null) {
      if (otherTasksInBucket.length === 0) {
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: 1000.0 * (i + 1) });
        }
      } else {
        const lastPosition = otherTasksInBucket[otherTasksInBucket.length - 1].position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: lastPosition + 1000.0 * (i + 1) });
        }
      }
    } else if (prevTaskId === null) {
      // Placed at the very top of the column
      const nextTask = otherTasksInBucket.find((t) => t.id === nextTaskId);
      if (nextTask) {
        const nextPosition = nextTask.position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: nextPosition - 1000.0 * (k - i) });
        }
      } else if (otherTasksInBucket.length > 0) {
        const firstPosition = otherTasksInBucket[0].position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: firstPosition - 1000.0 * (k - i) });
        }
      } else {
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: 1000.0 * (i + 1) });
        }
      }
    } else if (nextTaskId === null) {
      // Placed at the very bottom of the column
      const prevTask = otherTasksInBucket.find((t) => t.id === prevTaskId);
      if (prevTask) {
        const prevPosition = prevTask.position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: prevPosition + 1000.0 * (i + 1) });
        }
      } else if (otherTasksInBucket.length > 0) {
        const lastPosition = otherTasksInBucket[otherTasksInBucket.length - 1].position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: lastPosition + 1000.0 * (i + 1) });
        }
      } else {
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: 1000.0 * (i + 1) });
        }
      }
    } else {
      // Inserted between two tasks
      const prevTask = otherTasksInBucket.find((t) => t.id === prevTaskId);
      const nextTask = otherTasksInBucket.find((t) => t.id === nextTaskId);

      if (prevTask && nextTask) {
        const prevPos = prevTask.position;
        const nextPos = nextTask.position;
        const step = (nextPos - prevPos) / (k + 1);
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: prevPos + step * (i + 1) });
        }
      } else if (prevTask) {
        const prevPos = prevTask.position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: prevPos + 1000.0 * (i + 1) });
        }
      } else if (nextTask) {
        const nextPos = nextTask.position;
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: nextPos - 1000.0 * (k - i) });
        }
      } else {
        for (let i = 0; i < k; i++) {
          newPositions.push({ task: movingTasks[i], position: 1000.0 * (i + 1) });
        }
      }
    }

    // Save original state for potential rollback
    const originalStates = newPositions.map(({ task }) => ({
      task,
      bucket: task.bucket,
      position: task.position,
    }));

    // Optimistically update
    newPositions.forEach(({ task, position }) => {
      task.bucket = toBucket;
      task.position = position;
    });

    try {
      await Promise.all(
        newPositions.map(({ task, position }) =>
          moveTask(activeProjectId.value, task.id, toBucket, position)
        )
      );
    } catch {
      // Revert if API call fails
      originalStates.forEach(({ task, bucket, position }) => {
        task.bucket = bucket;
        task.position = position;
      });
      error.value = t('errors.moveTask');
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
