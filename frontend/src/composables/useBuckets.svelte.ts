import type { Bucket } from '@/types';
import { getBuckets, createBucket, updateBucket, deleteBucket } from '@/api';
import { settingsStore } from '@/stores/settings';

export function useBuckets() {
  let bucketsVal = $state<Bucket[]>([]);
  let errorVal = $state<string | null>(null);

  const fetchBuckets = async () => {
    try {
      bucketsVal = await getBuckets(settingsStore.activeProjectId);
    } catch (err: any) {
      errorVal = err.message || 'Failed to fetch columns';
    }
  };

  const displayedBuckets = $derived.by(() => {
    if (settingsStore.hideDoneColumn) {
      return bucketsVal.filter((b) => b.name !== 'done');
    }
    return bucketsVal;
  });

  const handleCreateColumn = async (title: string, subtitle: string) => {
    try {
      await createBucket(settingsStore.activeProjectId, title, subtitle);
      await fetchBuckets();
    } catch (err: any) {
      errorVal = err.message || 'Failed to create column';
    }
  };

  const handleRenameColumn = async ({
    bucketName,
    newTitle,
    newSubtitle,
    newColor,
    newLayout,
    newMaxTasks,
    newIsDefault,
  }: {
    bucketName: string;
    newTitle: string;
    newSubtitle: string;
    newColor?: string | null;
    newLayout?: 'list' | 'grid-2' | 'grid-3';
    newMaxTasks?: number | null;
    newIsDefault?: boolean;
  }) => {
    if (!newTitle.trim()) return;
    try {
      await updateBucket(settingsStore.activeProjectId, bucketName, {
        title: newTitle.trim(),
        subtitle: newSubtitle,
        color: newColor,
        layout: newLayout,
        max_tasks: newMaxTasks,
        is_default: newIsDefault,
      });
      await fetchBuckets();
    } catch (err: any) {
      errorVal = err.message || 'Failed to rename column';
    }
  };

  const handleDeleteColumn = async (bucketName: string) => {
    try {
      await deleteBucket(settingsStore.activeProjectId, bucketName);
      await fetchBuckets();
    } catch (err: any) {
      errorVal = err.message || 'Failed to delete column';
    }
  };

  const handleColumnReordered = async ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
    const visibleCols = [...displayedBuckets];
    if (oldIndex < 0 || oldIndex >= visibleCols.length || newIndex < 0 || newIndex >= visibleCols.length) return;
    if (oldIndex === newIndex) return;

    const [draggedCol] = visibleCols.splice(oldIndex, 1);
    visibleCols.splice(newIndex, 0, draggedCol);

    let newPosition: number;
    if (newIndex === 0) {
      newPosition = visibleCols[1].position - 1000.0;
    } else if (newIndex === visibleCols.length - 1) {
      newPosition = visibleCols[visibleCols.length - 2].position + 1000.0;
    } else {
      const prevCol = visibleCols[newIndex - 1];
      const nextCol = visibleCols[newIndex + 1];
      newPosition = (prevCol.position + nextCol.position) / 2.0;
    }

    // Optimistic local update
    const originalPosition = draggedCol.position;
    draggedCol.position = newPosition;
    bucketsVal.sort((a, b) => a.position - b.position);

    try {
      await updateBucket(settingsStore.activeProjectId, draggedCol.name, { position: newPosition });
    } catch {
      errorVal = 'Failed to reorder columns. Reverting changes.';
      draggedCol.position = originalPosition;
      bucketsVal.sort((a, b) => a.position - b.position);
      await fetchBuckets();
    }
  };

  return {
    get buckets() { return bucketsVal; },
    set buckets(v) { bucketsVal = v; },

    get displayedBuckets() { return displayedBuckets; },

    get error() { return errorVal; },
    set error(v) { errorVal = v; },

    fetchBuckets,
    handleCreateColumn,
    handleRenameColumn,
    handleDeleteColumn,
    handleColumnReordered,
  };
}
