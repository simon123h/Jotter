import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTaskMutations } from '../useTaskMutations';
import { moveTask, updateTask } from '@/api';
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

describe('useTaskMutations: where a dropped card lands', () => {
  const activeProjectId = ref('test-project');
  const fetchBuckets = vi.fn().mockResolvedValue(undefined);
  const fetchAllTasks = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(moveTask).mockResolvedValue({} as never);
  });

  /** A board with a dragged card in 'todo' and two cards (positions 1000 and 3000) in 'doing', or an empty 'doing'. */
  const board = (target: 'full' | 'empty' = 'full') =>
    ref<Task[]>([
      createMockTask({ id: 'drag', bucket: 'todo', position: 500 }),
      ...(target === 'full'
        ? [
            createMockTask({ id: 'first', bucket: 'doing', position: 1000 }),
            createMockTask({ id: 'last', bucket: 'doing', position: 3000 }),
          ]
        : []),
    ]);
  const drop = async (tasks: ReturnType<typeof board>, prevTaskId: string | null, nextTaskId: string | null) => {
    await useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks).handleCardDropped({
      taskId: 'drag',
      toBucket: 'doing',
      prevTaskId,
      nextTaskId,
    });
    return tasks.value.find((t) => t.id === 'drag')!;
  };

  it('puts a card dropped on an empty column at the first position', async () => {
    expect((await drop(board('empty'), null, null)).position).toBe(1000);
  });

  it('puts a card without neighbours after the last one', async () => {
    expect((await drop(board(), null, null)).position).toBe(4000);
  });

  it('puts a card at the top above the card named, or above the first when that one is gone', async () => {
    expect((await drop(board(), null, 'last')).position).toBe(2000);
    expect((await drop(board(), null, 'gone')).position).toBe(0);
    expect((await drop(board('empty'), null, 'gone')).position).toBe(1000);
  });

  it('puts a card at the bottom below the card named, or below the last when that one is gone', async () => {
    expect((await drop(board(), 'first', null)).position).toBe(2000);
    expect((await drop(board(), 'gone', null)).position).toBe(4000);
    expect((await drop(board('empty'), 'gone', null)).position).toBe(1000);
  });

  it('puts a card between two cards in the middle, or next to the one that is still there', async () => {
    expect((await drop(board(), 'first', 'last')).position).toBe(2000);
    expect((await drop(board(), 'first', 'gone')).position).toBe(2000);
    expect((await drop(board(), 'gone', 'last')).position).toBe(2000);
    expect((await drop(board('empty'), 'gone', 'gone')).position).toBe(1000);
  });

  it('ignores a drop of a card that is not there', async () => {
    const tasks = board();
    await useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks).handleCardDropped({
      taskId: 'nope',
      toBucket: 'doing',
      prevTaskId: null,
      nextTaskId: null,
    });
    expect(moveTask).not.toHaveBeenCalled();
  });

  it('reloads the tasks when the backend put a task elsewhere, as it does for a recurring task moved to done', async () => {
    vi.mocked(moveTask).mockResolvedValueOnce({ bucket: 'todo' } as never);
    await drop(board(), null, null);
    expect(fetchAllTasks).toHaveBeenCalled();

    fetchAllTasks.mockClear();
    vi.mocked(moveTask).mockResolvedValueOnce({ bucket: 'doing' } as never);
    await drop(board(), null, null);
    expect(fetchAllTasks).not.toHaveBeenCalled();
  });
});

describe('useTaskMutations: changes to one task', () => {
  const activeProjectId = ref('test-project');
  const fetchBuckets = vi.fn().mockResolvedValue(undefined);
  const fetchAllTasks = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(moveTask).mockResolvedValue({} as never);
    vi.mocked(updateTask).mockResolvedValue({} as never);
  });

  const mutations = (list: Task[]) => {
    const tasks = ref<Task[]>(list);
    return { tasks, ...useTaskMutations(tasks, activeProjectId, fetchBuckets, fetchAllTasks) };
  };

  it('marks a task done below the done tasks of its own project, and reloads', async () => {
    const { handleMarkTaskDone, tasks } = mutations([
      createMockTask({ id: 'a', project_id: 'work', bucket: 'todo' }),
      createMockTask({ id: 'd1', project_id: 'work', bucket: 'done', position: 4000 }),
      createMockTask({ id: 'd2', project_id: 'home', bucket: 'done', position: 9000 }),
    ]);
    await handleMarkTaskDone(tasks.value[0]);
    expect(moveTask).toHaveBeenCalledWith('work', 'a', 'done', 5000);
    expect(fetchBuckets).toHaveBeenCalled();
    expect(fetchAllTasks).toHaveBeenCalled();
  });

  it('starts the done column at 1000, and reports a failure', async () => {
    const { handleMarkTaskDone, tasks, error } = mutations([createMockTask({ id: 'a', project_id: 'work' })]);
    await handleMarkTaskDone(tasks.value[0]);
    expect(moveTask).toHaveBeenCalledWith('work', 'a', 'done', 1000);

    vi.mocked(moveTask).mockRejectedValueOnce(new Error('offline'));
    await handleMarkTaskDone(tasks.value[0]);
    expect(error.value).toBe('offline');
  });

  it('changes the planned date at once, and takes it back when the backend refuses', async () => {
    const { handleTimeViewPlannedDateUpdate, tasks, error } = mutations([createMockTask({ id: 'a', planned_date: 'today' })]);
    await handleTimeViewPlannedDateUpdate({ taskId: 'a', plannedDate: 'tomorrow', projectId: 'work' });
    expect(tasks.value[0].planned_date).toBe('tomorrow');
    expect(updateTask).toHaveBeenCalledWith('work', 'a', { planned_date: 'tomorrow' });

    vi.mocked(updateTask).mockRejectedValueOnce(new Error('no'));
    await handleTimeViewPlannedDateUpdate({ taskId: 'a', plannedDate: 'thisWeek' });
    expect(tasks.value[0].planned_date).toBe('tomorrow');
    expect(updateTask).toHaveBeenLastCalledWith('test-project', 'a', { planned_date: 'thisWeek' });
    expect(error.value).toBe('no');

    await handleTimeViewPlannedDateUpdate({ taskId: 'missing', plannedDate: 'today' });
    expect(updateTask).toHaveBeenCalledTimes(2);
  });

  it('changes the tags at once, and takes them back when the backend refuses', async () => {
    const { handleTagUpdate, tasks, error } = mutations([createMockTask({ id: 'a', project_id: 'work', tags: ['x'] })]);
    await handleTagUpdate({ taskId: 'a', tags: ['y', 'z'] });
    expect(tasks.value[0].tags).toEqual(['y', 'z']);
    expect(updateTask).toHaveBeenCalledWith('work', 'a', { tags: ['y', 'z'] });

    vi.mocked(updateTask).mockRejectedValueOnce(new Error('no'));
    await handleTagUpdate({ taskId: 'a', tags: ['q'] });
    expect(tasks.value[0].tags).toEqual(['y', 'z']);
    expect(error.value).toBe('no');

    await handleTagUpdate({ taskId: 'missing', tags: [] });
    expect(updateTask).toHaveBeenCalledTimes(2);
  });

  it('patches a task, takes what the backend answers and reloads', async () => {
    const { patchTask, tasks } = mutations([createMockTask({ id: 'a', project_id: 'work', title: 'Old' })]);
    vi.mocked(updateTask).mockResolvedValueOnce({ title: 'From backend' } as never);

    const updated = await patchTask(tasks.value[0], { title: 'New' });

    expect(updated).toEqual({ title: 'From backend' });
    expect(tasks.value[0].title).toBe('From backend');
    expect(fetchBuckets).toHaveBeenCalled();
    expect(fetchAllTasks).toHaveBeenCalled();
  });

  it('shows a patch before the backend answers, or only after it when asked', async () => {
    const { patchTask, tasks } = mutations([createMockTask({ id: 'a', title: 'Old' })]);
    let during = '';
    vi.mocked(updateTask).mockImplementationOnce(async () => {
      during = tasks.value[0].title;
      return {} as never;
    });
    await patchTask(tasks.value[0], { title: 'New' });
    expect(during).toBe('New');

    vi.mocked(updateTask).mockImplementationOnce(async () => {
      during = tasks.value[0].title;
      return {} as never;
    });
    await patchTask(tasks.value[0], { title: 'Newer' }, false);
    expect(during).toBe('New');
  });

  it('puts the task back and passes the error on when a patch fails', async () => {
    const { patchTask, tasks, error } = mutations([createMockTask({ id: 'a', title: 'Old' })]);
    vi.mocked(updateTask).mockRejectedValueOnce(new Error('refused'));

    await expect(patchTask(tasks.value[0], { title: 'New' })).rejects.toThrow('refused');

    expect(tasks.value[0].title).toBe('Old');
    expect(error.value).toBe('refused');
  });
});
