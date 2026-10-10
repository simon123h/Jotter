import { ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBuckets } from '@/composables/useBuckets';
import * as api from '@/api';
import type { Bucket } from '@/types';

vi.mock('@/api', () => ({
  getBuckets: vi.fn(),
  createBucket: vi.fn(),
  updateBucket: vi.fn(),
  deleteBucket: vi.fn(),
}));

describe('useBuckets composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reorders columns correctly with externalBuckets ref provided', async () => {
    const activeProjectId = ref('proj-1');
    const hideDone = ref(false);
    const hideArchive = ref(false);
    const hidePostponed = ref(true);

    const initialBuckets: Bucket[] = [
      { name: 'backlog', title: 'Backlog', subtitle: '', position: 1000.0, is_default: false },
      { name: 'todo', title: 'To Do', subtitle: '', position: 2000.0, is_default: false },
      { name: 'in-progress', title: 'In Progress', subtitle: '', position: 3000.0, is_default: false },
      { name: 'done', title: 'Done', subtitle: '', position: 4000.0, is_default: false },
    ];
    const externalBuckets = ref<Bucket[]>([...initialBuckets]);

    const { handleColumnReordered } = useBuckets(activeProjectId, hideDone, hideArchive, hidePostponed, externalBuckets);

    // Move 'backlog' (index 0) to after 'in-progress' (index 2)
    await handleColumnReordered({ oldIndex: 0, newIndex: 2 });

    expect(api.updateBucket).toHaveBeenCalledWith('proj-1', 'backlog', expect.objectContaining({ position: 3500.0 }));
  });

  it('calculates position correctly when dragging to first column', async () => {
    const activeProjectId = ref('proj-1');
    const hideDone = ref(false);
    const hideArchive = ref(false);
    const hidePostponed = ref(true);

    const initialBuckets: Bucket[] = [
      { name: 'backlog', title: 'Backlog', subtitle: '', position: 1000.0, is_default: false },
      { name: 'todo', title: 'To Do', subtitle: '', position: 2000.0, is_default: false },
      { name: 'in-progress', title: 'In Progress', subtitle: '', position: 3000.0, is_default: false },
    ];
    const externalBuckets = ref<Bucket[]>([...initialBuckets]);

    const { handleColumnReordered } = useBuckets(activeProjectId, hideDone, hideArchive, hidePostponed, externalBuckets);

    // Move 'in-progress' (index 2) to first position (index 0)
    await handleColumnReordered({ oldIndex: 2, newIndex: 0 });

    expect(api.updateBucket).toHaveBeenCalledWith('proj-1', 'in-progress', expect.objectContaining({ position: 0.0 }));
  });
});
