import { computed, type Ref } from 'vue';
import { isBeyond, today } from '@jotter/task-filter';
import type { Task } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import { useHorizonApplies } from '@/composables/horizonContext';

/**
 * The tasks of a view that is about what to do now (board, list, tags, matrix): the ones planned further ahead than the
 * horizon are left out. The planning views do not use this, they place a task by its planned date.
 */
export function useTasksWithinHorizon(tasks: () => Task[]): Ref<Task[]> {
  const settingsStore = useSettingsStore();
  const applies = useHorizonApplies();
  return computed(() => {
    if (!applies.value) return tasks();
    const day = today();
    return tasks().filter((task) => !isBeyond(task.planned_date, settingsStore.planningHorizon, day));
  });
}
