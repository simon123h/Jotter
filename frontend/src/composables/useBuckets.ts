import { ref, computed, type Ref } from 'vue';
import type { Bucket } from '@/types';
import { getBuckets, createBucket, updateBucket, deleteBucket } from '@/api';

export function useBuckets(activeProjectId: Ref<string>, hideDoneColumn: Ref<boolean>) {
  const buckets = ref<Bucket[]>([]);
  const error = ref<string | null>(null);

  const fetchBuckets = async () => {
    try {
      buckets.value = await getBuckets(activeProjectId.value);
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch columns';
    }
  };

  const displayedBuckets = computed(() => {
    if (hideDoneColumn.value) {
      return buckets.value.filter((b) => b.name !== 'done');
    }
    return buckets.value;
  });

  const handleCreateColumn = async (title: string, subtitle: string) => {
    try {
      await createBucket(activeProjectId.value, title, subtitle);
      await fetchBuckets();
    } catch (err: any) {
      error.value = err.message || 'Failed to create column';
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
      await updateBucket(activeProjectId.value, bucketName, {
        title: newTitle.trim(),
        subtitle: newSubtitle,
        color: newColor,
        layout: newLayout,
        max_tasks: newMaxTasks,
        is_default: newIsDefault,
      });
      await fetchBuckets();
    } catch (err: any) {
      error.value = err.message || 'Failed to rename column';
    }
  };

  const handleDeleteColumn = async (bucketName: string) => {
    try {
      await deleteBucket(activeProjectId.value, bucketName);
      await fetchBuckets();
    } catch (err: any) {
      error.value = err.message || 'Failed to delete column';
    }
  };

  const handleColumnReordered = async ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
    const visibleCols = [...displayedBuckets.value];
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
    buckets.value.sort((a, b) => a.position - b.position);

    try {
      await updateBucket(activeProjectId.value, draggedCol.name, { position: newPosition });
    } catch {
      error.value = 'Failed to reorder columns. Reverting changes.';
      draggedCol.position = originalPosition;
      buckets.value.sort((a, b) => a.position - b.position);
      await fetchBuckets();
    }
  };

  return {
    buckets,
    displayedBuckets,
    error,
    fetchBuckets,
    handleCreateColumn,
    handleRenameColumn,
    handleDeleteColumn,
    handleColumnReordered,
  };
}
