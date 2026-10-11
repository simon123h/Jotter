import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { updateTask } from '@/api';
import { triggerDoneParticleBurst } from '@/utils/effects';
import type { Task, Timeblock } from '@/types';
import { isTaskDone } from '../utils/timeGrid';

/** Task-level actions available from inside a timeblock box. */
export function useTimeblockTasks(activeProjectId: Ref<string>) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const timeblockStore = useTimeblockStore();
  const projectStore = useProjectStore();
  const selectionStore = useSelectionStore();

  /** Open tasks allocated to a block, resolved reactively against the project store. */
  const getTasksForBlock = (tb: Timeblock): Task[] => {
    const ids = tb.task_ids || (tb.tasks ? tb.tasks.map((t) => t.id) : []);
    if (ids.length === 0) return [];

    return ids
      .map((id) => projectStore.tasks.find((t) => t.id === id) || tb.tasks?.find((t) => t.id === id))
      .filter((t): t is Task => !!t && !isTaskDone(t));
  };

  const toggleTaskDone = async (task: Task, timeblockId: string, e: Event) => {
    e.stopPropagation();
    const currentlyDone = isTaskDone(task);
    const targetBucket = currentlyDone ? 'todo' : 'done';

    if (targetBucket === 'done') {
      const mouseEvent = e as MouseEvent;
      const target = (e.currentTarget as HTMLElement) || (e.target as HTMLElement);
      if (target && target.getBoundingClientRect) {
        const rect = target.getBoundingClientRect();
        triggerDoneParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      } else if (mouseEvent.clientX && mouseEvent.clientY) {
        triggerDoneParticleBurst(mouseEvent.clientX, mouseEvent.clientY);
      }
    }

    try {
      const updated = await updateTask(task.project_id || activeProjectId.value, task.id, {
        bucket: targetBucket,
        position: targetBucket === 'done' ? 1000000.0 : 1000.0,
      });
      task.bucket = targetBucket;

      // Marked done: unallocate so recurring or standard blocks stay clean
      if (targetBucket === 'done') {
        await timeblockStore.unallocateTask(timeblockId, task.id);
      }

      // Keep projectStore in sync so board/list/matrix views reflect the change immediately
      const storeTask = projectStore.tasks.find((t) => t.id === task.id);
      if (storeTask) {
        Object.assign(storeTask, updated);
      }
      await projectStore.invalidate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task');
    }
  };

  const unallocateTask = async (timeblockId: string, taskId: string, e: Event) => {
    e.stopPropagation();
    await timeblockStore.unallocateTask(timeblockId, taskId);
  };

  /** Allocate the currently selected tasks into a timeblock. */
  const addSelectedTasksToBox = async (timeblockId: string, e: Event) => {
    e.stopPropagation();
    if (selectionStore.hasSelection && selectionStore.selectedIds.size > 0) {
      for (const id of Array.from(selectionStore.selectedIds)) {
        await timeblockStore.allocateTask(timeblockId, id);
      }
      toast.success(t('timeblock.addSelectedTooltip'));
      selectionStore.clearSelection();
    } else {
      toast.info(t('timeblock.noTasksSelectedHelper'));
    }
  };

  const openTaskDetail = (task: Task) => {
    router.push({
      name: 'board-task',
      params: { projectId: task.project_id || activeProjectId.value, taskId: task.id },
    });
  };

  return { getTasksForBlock, toggleTaskDone, unallocateTask, addSelectedTasksToBox, openTaskDetail };
}
