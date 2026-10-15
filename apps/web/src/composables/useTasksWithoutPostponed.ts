import { computed, type Ref } from 'vue';
import { isPostponed } from '@jotter/task-filter';
import type { Task } from '@/types';
import { useSettingsStore } from '@/stores/settings';

/**
 * The tasks of a view that is about what to do now (board, list, tags, matrix): the postponed ones are left out while
 * the setting hides them. The planning views do not use this, they place a postponed task by its date.
 */
export function useTasksWithoutPostponed(tasks: () => Task[]): Ref<Task[]> {
  const settingsStore = useSettingsStore();
  return computed(() => (settingsStore.hidePostponedColumn ? tasks().filter((task) => !isPostponed(task)) : tasks()));
}
