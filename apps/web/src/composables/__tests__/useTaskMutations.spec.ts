import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTaskMutations } from '../useTaskMutations';
import { moveTask } from '@/api';
import type { Task } from '@/types';

// Mock the API layer
vi.mock('@/api', () => ({
  moveTask: vi.fn().mockResolvedValue({}),
  updateTask: vi.fn().mockResolvedValue({}),
}));

function createMockTask(overrides: Partial<Task>): Task {
  return {
    id: 'test-id',
    project_id: 'test-project',
    title: 'Test Task',
    body: '',
    bucket: 'todo',
    position: 1000.0,
    tags: [],
    attachments: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Task;
}

describe('useTaskMutations handleCardDropped with multi-selection', () => {
  const activeProjectId = ref('test-project');
  const fetchBuckets = vi.fn().mockResolvedValue(undefined);
  const fetchAllTasks = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves a single task when it is not part of the selection', async () => {
    const tasks = ref<Task[]>([
      createMockTask({ id: '1', title: 'Task 1', bucket: 'todo', position: 1000.0 }),
      createMockTask({ id: '2', title: 'Task 2', bucket: 'todo', position: 2000.0 }),
      createMockTask({ id: '3', title: 'Task 3', bucket: 'in-progress', position: 1000.0 }),
    ]);

    const { handleCardDropped } = useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks);

    await handleCardDropped({
      taskId: '2',
      toBucket: 'in-progress',
      prevTaskId: '3',
      nextTaskId: null,
      selectedIds: new Set<string>(['1']), // '2' is not selected
    });

    // Only '2' should be moved to 'in-progress'
    const movedTask = tasks.value.find((t) => t.id === '2');
    expect(movedTask?.bucket).toBe('in-progress');
    expect(movedTask?.position).toBe(2000.0); // 1000.0 + 1000.0

    expect(moveTask).toHaveBeenCalledTimes(1);
    expect(moveTask).toHaveBeenCalledWith('test-project', '2', 'in-progress', 2000.0);
  });

  it('moves multiple selected tasks together, preserving their relative order', async () => {
    const tasks = ref<Task[]>([
      createMockTask({ id: '1', title: 'Task 1', bucket: 'todo', position: 1000.0 }),
      createMockTask({ id: '2', title: 'Task 2', bucket: 'todo', position: 2000.0 }),
      createMockTask({ id: '3', title: 'Task 3', bucket: 'in-progress', position: 5000.0 }),
    ]);

    const { handleCardDropped } = useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks);

    const selectedIds = new Set<string>(['1', '2']); // '1' and '2' are selected

    await handleCardDropped({
      taskId: '1', // Dragged '1'
      toBucket: 'in-progress',
      prevTaskId: null,
      nextTaskId: '3',
      selectedIds,
    });

    // Both selected tasks should have been moved before '3' (position 5000.0)
    // Order: '1' then '2' before '3'.
    const task1 = tasks.value.find((t) => t.id === '1');
    const task2 = tasks.value.find((t) => t.id === '2');

    expect(task1?.bucket).toBe('in-progress');
    expect(task1?.position).toBe(3000.0);

    expect(task2?.bucket).toBe('in-progress');
    expect(task2?.position).toBe(4000.0);

    expect(moveTask).toHaveBeenCalledTimes(2);
    expect(moveTask).toHaveBeenCalledWith('test-project', '1', 'in-progress', 3000.0);
    expect(moveTask).toHaveBeenCalledWith('test-project', '2', 'in-progress', 4000.0);
  });

  it('correctly reverts all tasks to their original states if an API call fails', async () => {
    const tasks = ref<Task[]>([
      createMockTask({ id: '1', title: 'Task 1', bucket: 'todo', position: 1000.0 }),
      createMockTask({ id: '2', title: 'Task 2', bucket: 'todo', position: 2000.0 }),
    ]);

    // Force failure
    vi.mocked(moveTask).mockRejectedValueOnce(new Error('Network Error'));

    const { handleCardDropped, error } = useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks);

    const selectedIds = new Set<string>(['1', '2']);

    await handleCardDropped({
      taskId: '1',
      toBucket: 'in-progress',
      prevTaskId: null,
      nextTaskId: null,
      selectedIds,
    });

    // Positions should be reverted
    const task1 = tasks.value.find((t) => t.id === '1');
    const task2 = tasks.value.find((t) => t.id === '2');

    expect(task1?.bucket).toBe('todo');
    expect(task1?.position).toBe(1000.0);

    expect(task2?.bucket).toBe('todo');
    expect(task2?.position).toBe(2000.0);

    expect(error.value).toBe('Failed to persist card movement. Reverted change.');
  });

  it('treats multi-selection drop onto the original column of the dragged task as a no-op', async () => {
    const tasks = ref<Task[]>([
      createMockTask({ id: '1', title: 'Task 1', bucket: 'todo', position: 1000.0 }),
      createMockTask({ id: '2', title: 'Task 2', bucket: 'in-progress', position: 1000.0 }),
    ]);

    const { handleCardDropped } = useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks);

    const selectedIds = new Set<string>(['1', '2']); // Multi-selection

    await handleCardDropped({
      taskId: '1', // Dragged Task 1 (bucket 'todo')
      toBucket: 'todo', // Dropped in same bucket 'todo'
      prevTaskId: null,
      nextTaskId: null,
      selectedIds,
    });

    // Positions and buckets should remain untouched
    const task1 = tasks.value.find((t) => t.id === '1');
    const task2 = tasks.value.find((t) => t.id === '2');

    expect(task1?.bucket).toBe('todo');
    expect(task2?.bucket).toBe('in-progress');

    // No API calls should have been made
    expect(moveTask).not.toHaveBeenCalled();
  });

  it('does NOT treat single-task rearrangement within the same column as a no-op', async () => {
    const tasks = ref<Task[]>([
      createMockTask({ id: '1', title: 'Task 1', bucket: 'todo', position: 1000.0 }),
      createMockTask({ id: '2', title: 'Task 2', bucket: 'todo', position: 2000.0 }),
    ]);

    const { handleCardDropped } = useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks);

    await handleCardDropped({
      taskId: '1', // Dragged Task 1
      toBucket: 'todo', // Rearranged in same bucket 'todo'
      prevTaskId: '2', // Placed after Task 2
      nextTaskId: null,
    });

    // Task 1 should have been repositioned after Task 2 (2000.0 + 1000.0 = 3000.0)
    const task1 = tasks.value.find((t) => t.id === '1');
    expect(task1?.position).toBe(3000.0);

    // API should have been called
    expect(moveTask).toHaveBeenCalledTimes(1);
    expect(moveTask).toHaveBeenCalledWith('test-project', '1', 'todo', 3000.0);
  });
});
