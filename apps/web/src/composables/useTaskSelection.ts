import { ref, computed } from 'vue';
import type { Task } from '@/types';

export function useTaskSelection() {
  const selectedIds = ref<Set<string>>(new Set());

  const isSelected = (id: string) => selectedIds.value.has(id);

  const toggleSelection = (id: string) => {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id);
    } else {
      selectedIds.value.add(id);
    }
    // Trigger reactivity by reassignment
    selectedIds.value = new Set(selectedIds.value);
  };

  const selectAll = (tasks: Task[]) => {
    selectedIds.value = new Set(tasks.map((t) => t.id));
  };

  const clearSelection = () => {
    selectedIds.value = new Set();
  };

  const hasSelection = computed(() => selectedIds.value.size > 0);
  const selectionCount = computed(() => selectedIds.value.size);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    hasSelection,
    selectionCount,
  };
}
