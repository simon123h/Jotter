import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTriageSession } from '../useTriageSession';
import { deleteTask, updateTask } from '@/api';
import { createMockTask } from '@/__tests__/factories';
import { TRIAGE_COLORS } from '@/utils/constants';

vi.mock('@/api', () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockImplementation(async (_p, _id, payload) => ({ ...payload })),
}));

const makeTasks = () => [
  createMockTask({ id: 'a', project_id: 'p', created_at: '2026-01-01T00:00:00Z', color: null }),
  createMockTask({ id: 'b', project_id: 'p', created_at: '2026-01-02T00:00:00Z' }),
  createMockTask({ id: 'c', project_id: 'p', created_at: '2026-01-03T00:00:00Z' }),
];

describe('useTriageSession', () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('starts on the oldest task', () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    expect(s.currentTask.value?.id).toBe('a');
    expect(s.currentTaskIndex.value).toBe(0);
  });

  it('re-sorts when the sort order changes', () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    s.sortOrder.value = 'created-desc';
    expect(s.currentTask.value?.id).toBe('c');
  });

  it('moves through the queue and shows the congratulations state at the end', () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    s.next();
    s.next();
    expect(s.currentTask.value?.id).toBe('c');
    expect(s.isCongratsState.value).toBe(false);

    s.next();
    expect(s.isCongratsState.value).toBe(true);
    expect(s.currentTaskIndex.value).toBe(2);
  });

  it('does not go before the first task', () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    s.prev();
    expect(s.currentTaskIndex.value).toBe(0);
    s.next();
    s.prev();
    expect(s.currentTaskIndex.value).toBe(0);
  });

  it('pulls the index back in range when the queue shrinks', async () => {
    const tasks = ref(makeTasks());
    const s = useTriageSession(tasks, onRefresh);
    s.next();
    s.next();
    tasks.value = tasks.value.slice(0, 1);
    await nextTick();
    expect(s.currentTaskIndex.value).toBe(0);

    tasks.value = [];
    await nextTick();
    expect(s.currentTask.value).toBeNull();
  });

  it('counts edits and persists the patch', async () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    await s.patchCurrentTask({ priority: 'high' });
    expect(updateTask).toHaveBeenCalledWith('p', 'a', expect.objectContaining({ priority: 'high' }));
    expect(s.editedCount.value).toBe(1);
  });

  it('cycles through the color palette and wraps around', async () => {
    const tasks = ref(makeTasks());
    const s = useTriageSession(tasks, onRefresh);
    s.cycleColor();
    await vi.waitFor(() => expect(updateTask).toHaveBeenCalled());
    expect(vi.mocked(updateTask).mock.calls[0][2]).toEqual(expect.objectContaining({ color: TRIAGE_COLORS[1].id }));

    tasks.value[0].color = TRIAGE_COLORS[TRIAGE_COLORS.length - 1].id;
    vi.mocked(updateTask).mockClear();
    s.cycleColor();
    await vi.waitFor(() => expect(updateTask).toHaveBeenCalled());
    expect(vi.mocked(updateTask).mock.calls[0][2]).toEqual(expect.objectContaining({ color: TRIAGE_COLORS[0].id }));
  });

  it('marks a task done, counts it and advances', async () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    await s.markTaskDone();
    expect(updateTask).toHaveBeenCalledWith('p', 'a', expect.objectContaining({ bucket: 'done' }));
    expect(s.completedCount.value).toBe(1);
    expect(s.currentTaskIndex.value).toBe(1);
  });

  it('deletes after confirmation, counts it and refreshes', async () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    await s.removeCurrentTask();
    expect(deleteTask).toHaveBeenCalledWith('p', 'a');
    expect(s.deletedCount.value).toBe(1);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('keeps the task when deletion is declined', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    await s.removeCurrentTask();
    expect(deleteTask).not.toHaveBeenCalled();
    expect(s.deletedCount.value).toBe(0);
  });

  it('resets the whole session', async () => {
    const s = useTriageSession(ref(makeTasks()), onRefresh);
    await s.markTaskDone();
    s.next();
    s.next();
    expect(s.isCongratsState.value).toBe(true);

    s.resetSession();
    expect(s.isCongratsState.value).toBe(false);
    expect(s.currentTaskIndex.value).toBe(0);
    expect(s.completedCount.value).toBe(0);
    expect(s.editedCount.value).toBe(0);
    expect(s.deletedCount.value).toBe(0);
  });
});
