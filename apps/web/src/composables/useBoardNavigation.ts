import { nextTick, type ComputedRef } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSelectionStore } from '@/stores/selection';
import { useModalStore } from '@/stores/modal';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import type { Task, Bucket } from '@/types';

interface UseBoardNavigationOptions {
  visibleBuckets: ComputedRef<Bucket[]>;
  tasksByBucket: ComputedRef<Record<string, Task[]>>;
  tasks: ComputedRef<Task[]>;
}

export function useBoardNavigation({ visibleBuckets, tasksByBucket, tasks }: UseBoardNavigationOptions) {
  const router = useRouter();
  const route = useRoute();
  const selectionStore = useSelectionStore();
  const modalStore = useModalStore();

  const scrollTaskIntoView = (taskId: string) => {
    nextTick(() => {
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    });
  };

  const navigateBoard = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (modalStore.activeModal || route.params.taskId) return;
    if (selectionStore.selectionCount > 1) return;

    const buckets = visibleBuckets.value;
    if (buckets.length === 0) return;

    const currentSelection = Array.from(selectionStore.selectedIds);

    if (currentSelection.length === 0) {
      const firstBucketWithTasks = buckets.find((b) => (tasksByBucket.value[b.name] || []).length > 0);
      if (firstBucketWithTasks) {
        const firstTask = tasksByBucket.value[firstBucketWithTasks.name][0];
        selectionStore.clearSelection();
        selectionStore.toggleSelection(firstTask.id);
        scrollTaskIntoView(firstTask.id);
      }
      return;
    }

    const currentId = currentSelection[0];
    let currentBucketName = '';
    let currentTaskIndex = -1;

    for (const bucket of buckets) {
      const bucketTasks = tasksByBucket.value[bucket.name] || [];
      const idx = bucketTasks.findIndex((t) => t.id === currentId);
      if (idx !== -1) {
        currentBucketName = bucket.name;
        currentTaskIndex = idx;
        break;
      }
    }

    if (!currentBucketName || currentTaskIndex === -1) {
      selectionStore.clearSelection();
      return;
    }

    const currentBucketTasks = tasksByBucket.value[currentBucketName] || [];

    if (direction === 'up') {
      if (currentTaskIndex > 0) {
        const targetTask = currentBucketTasks[currentTaskIndex - 1];
        selectionStore.clearSelection();
        selectionStore.toggleSelection(targetTask.id);
        scrollTaskIntoView(targetTask.id);
      }
    } else if (direction === 'down') {
      if (currentTaskIndex < currentBucketTasks.length - 1) {
        const targetTask = currentBucketTasks[currentTaskIndex + 1];
        selectionStore.clearSelection();
        selectionStore.toggleSelection(targetTask.id);
        scrollTaskIntoView(targetTask.id);
      }
    } else if (direction === 'left' || direction === 'right') {
      const currentBucketIdx = buckets.findIndex((b) => b.name === currentBucketName);
      const targetBucketIdx = direction === 'left' ? currentBucketIdx - 1 : currentBucketIdx + 1;

      if (targetBucketIdx >= 0 && targetBucketIdx < buckets.length) {
        const targetBucket = buckets[targetBucketIdx];
        const targetBucketTasks = tasksByBucket.value[targetBucket.name] || [];
        if (targetBucketTasks.length > 0) {
          const targetIndex = Math.min(currentTaskIndex, targetBucketTasks.length - 1);
          const targetTask = targetBucketTasks[targetIndex];
          selectionStore.clearSelection();
          selectionStore.toggleSelection(targetTask.id);
          scrollTaskIntoView(targetTask.id);
        }
      }
    }
  };

  const handleEnterOnSelected = () => {
    if (modalStore.activeModal || route.params.taskId) return;
    if (selectionStore.selectionCount !== 1) return;

    const currentId = Array.from(selectionStore.selectedIds)[0];
    const selectedTask = tasks.value.find((t) => t.id === currentId);

    if (selectedTask) {
      router.push({
        name: `${String(route.name)}-task`,
        params: {
          projectId: route.params.projectId === 'all' ? 'all' : selectedTask.project_id,
          taskId: String(selectedTask.id),
        },
        query: route.query || {},
      });
    }
  };

  useKeyboardShortcuts([
    { key: 'ArrowUp', callback: () => navigateBoard('up') },
    { key: 'ArrowDown', callback: () => navigateBoard('down') },
    { key: 'ArrowLeft', callback: () => navigateBoard('left') },
    { key: 'ArrowRight', callback: () => navigateBoard('right') },
    { key: 'Enter', callback: handleEnterOnSelected },
    {
      key: 'Escape',
      callback: () => {
        if (!modalStore.activeModal && !route.params.taskId) {
          selectionStore.clearSelection();
        }
      },
    },
  ]);
}
