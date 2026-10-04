import { ref, computed, watch, type Ref } from 'vue';
import { deleteTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useTaskMutations } from '@/composables/useTaskMutations';
import { TRIAGE_COLORS } from '@/utils/constants';
import type { Task } from '@/types';
import { sortTriageTasks, type TriageSortOrder } from '../utils/triageSort';

/** The triage queue: ordering, the current position, session stats and the actions on the current task. */
export function useTriageSession(tasks: Ref<Task[]>, onRefresh: () => void) {
  const { t } = useI18n();

  const sortOrder = ref<TriageSortOrder>('created-asc');
  const currentTaskIndex = ref(0);
  const isCongratsState = ref(false);

  const editedCount = ref(0);
  const completedCount = ref(0);
  const deletedCount = ref(0);

  const sortedTasks = computed(() => sortTriageTasks(tasks.value, sortOrder.value));

  const currentTask = computed<Task | null>(() => {
    if (sortedTasks.value.length === 0 || currentTaskIndex.value < 0) return null;
    return sortedTasks.value[currentTaskIndex.value] ?? null;
  });

  // Keep the index within bounds when the queue shrinks
  watch(sortedTasks, (newTasks) => {
    if (newTasks.length === 0) {
      currentTaskIndex.value = 0;
    } else if (currentTaskIndex.value >= newTasks.length) {
      currentTaskIndex.value = Math.max(0, newTasks.length - 1);
    }
  });

  const activeProjectId = computed(() => currentTask.value?.project_id || '');
  const { patchTask } = useTaskMutations(
    tasks,
    activeProjectId,
    async () => {},
    async () => onRefresh()
  );

  const next = () => {
    if (sortedTasks.value.length === 0) return;
    if (currentTaskIndex.value < sortedTasks.value.length - 1) {
      currentTaskIndex.value++;
    } else {
      // Reached the end of the queue
      isCongratsState.value = true;
    }
  };

  const prev = () => {
    if (currentTaskIndex.value > 0) {
      currentTaskIndex.value--;
    }
  };

  const patchCurrentTask = async (payload: Partial<Task>) => {
    if (!currentTask.value) return;
    try {
      await patchTask(currentTask.value, payload);
      editedCount.value++;
    } catch (err) {
      console.error('Triage save failed', err);
    }
  };

  const cycleColor = () => {
    if (!currentTask.value) return;
    const idx = TRIAGE_COLORS.findIndex((c) => c.id === currentTask.value!.color);
    patchCurrentTask({ color: TRIAGE_COLORS[(idx + 1) % TRIAGE_COLORS.length].id });
  };

  const markTaskDone = async () => {
    if (!currentTask.value) return;
    try {
      await patchTask(currentTask.value, { bucket: 'done' });
      completedCount.value++;
      next();
    } catch (err) {
      console.error('Failed to mark task done', err);
    }
  };

  const removeCurrentTask = async () => {
    if (!currentTask.value) return;
    const taskToDelete = currentTask.value;
    if (confirm(t('buttons.deleteTask') + '?')) {
      try {
        await deleteTask(taskToDelete.project_id, taskToDelete.id);
        deletedCount.value++;
        onRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const resetSession = () => {
    editedCount.value = 0;
    completedCount.value = 0;
    deletedCount.value = 0;
    isCongratsState.value = false;
    currentTaskIndex.value = 0;
  };

  return {
    sortOrder,
    sortedTasks,
    currentTask,
    currentTaskIndex,
    isCongratsState,
    editedCount,
    completedCount,
    deletedCount,
    next,
    prev,
    patchCurrentTask,
    cycleColor,
    markTaskDone,
    removeCurrentTask,
    resetSession,
  };
}
