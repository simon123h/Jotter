import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useTaskDetailActions } from '../useTaskDetailActions';
import { createTask, deleteTask } from '@/api';
import { createMockTask, createMockBucket } from '@/__tests__/factories';

const showDialog = vi.fn();

vi.mock('@/api', () => ({
  createTask: vi.fn().mockResolvedValue({}),
  deleteTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({ showDialog }),
}));

const setup = (overrides: Record<string, any> = {}) => {
  const task = ref(createMockTask({ id: 't1', bucket: 'todo', tags: ['a'], priority: 'high', body: '- [ ] one\n- [x] two\ntext' }));
  const loading = ref(false);
  const error = ref<string | null>(null);
  const patchTask = vi.fn(async (_t, patch) => ({ ...task.value, ...patch }));
  const editForm = { body: '' };
  const closeModal = vi.fn();
  const refreshBoard = vi.fn();
  const actions = useTaskDetailActions({
    task,
    buckets: ref([createMockBucket({ name: 'backlog' }), createMockBucket({ name: 'todo' })]),
    actualProjectId: ref('p1'),
    patchTask,
    editForm,
    loading,
    error,
    closeModal,
    refreshBoard,
    ...overrides,
  });
  return { task, loading, error, patchTask, editForm, closeModal, refreshBoard, ...actions };
};

describe('useTaskDetailActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showDialog.mockResolvedValue(true);
  });

  it('persists a toggled checkbox body', async () => {
    const { task, patchTask, toggleCheckboxInBody } = setup();
    await toggleCheckboxInBody('- [x] one');
    expect(patchTask).toHaveBeenCalledWith(expect.anything(), { body: '- [x] one' });
    expect(task.value?.body).toBe('- [x] one');
  });

  it('reports an error when persisting the body fails', async () => {
    const { error, toggleCheckboxInBody } = setup({ patchTask: vi.fn().mockRejectedValue(new Error('boom')) });
    await toggleCheckboxInBody('x');
    expect(error.value).toContain('boom');
  });

  describe('splitAllSubtasks', () => {
    it('creates a task per checklist item in the same bucket and strips them from the body', async () => {
      const { task, editForm, loading, refreshBoard, splitAllSubtasks } = setup();
      await splitAllSubtasks();

      expect(createTask).toHaveBeenCalledTimes(2);
      expect(createTask).toHaveBeenCalledWith('p1', expect.objectContaining({ bucket: 'todo', tags: ['a'], priority: 'high' }));
      expect(task.value?.body).not.toContain('- [');
      expect(editForm.body).toBe(task.value?.body);
      expect(refreshBoard).toHaveBeenCalled();
      expect(loading.value).toBe(false);
    });

    it('does nothing when the user cancels', async () => {
      showDialog.mockResolvedValue(false);
      const { patchTask, splitAllSubtasks } = setup();
      await splitAllSubtasks();
      expect(createTask).not.toHaveBeenCalled();
      expect(patchTask).not.toHaveBeenCalled();
    });

    it('does nothing when there are no checklist items', async () => {
      const task = ref(createMockTask({ body: 'just text' }));
      const { splitAllSubtasks } = setup({ task });
      await splitAllSubtasks();
      expect(showDialog).not.toHaveBeenCalled();
    });
  });

  describe('deleteCurrentTask', () => {
    it('deletes, refreshes and closes after confirmation', async () => {
      const { deleteCurrentTask, refreshBoard, closeModal } = setup();
      await deleteCurrentTask();
      expect(deleteTask).toHaveBeenCalledWith('p1', 't1');
      expect(refreshBoard).toHaveBeenCalled();
      expect(closeModal).toHaveBeenCalled();
    });

    it('keeps the modal open when cancelled', async () => {
      showDialog.mockResolvedValue(false);
      const { deleteCurrentTask, closeModal } = setup();
      await deleteCurrentTask();
      expect(deleteTask).not.toHaveBeenCalled();
      expect(closeModal).not.toHaveBeenCalled();
    });

    it('shows an error and stops loading when deletion fails', async () => {
      vi.mocked(deleteTask).mockRejectedValueOnce(new Error('nope'));
      const { deleteCurrentTask, error, loading, closeModal } = setup();
      await deleteCurrentTask();
      expect(error.value).toContain('nope');
      expect(loading.value).toBe(false);
      expect(closeModal).not.toHaveBeenCalled();
    });
  });

  describe('bucket moves', () => {
    it('marks done and closes', async () => {
      const { markDone, patchTask, closeModal } = setup();
      await markDone();
      expect(patchTask).toHaveBeenCalledWith(expect.anything(), { bucket: 'done', position: 1000000.0 });
      expect(closeModal).toHaveBeenCalled();
    });

    it('archives and closes', async () => {
      const { archive, patchTask, closeModal } = setup();
      await archive();
      expect(patchTask).toHaveBeenCalledWith(expect.anything(), { bucket: 'archive' });
      expect(closeModal).toHaveBeenCalled();
    });

    it('unarchives into todo, falling back to the first bucket', async () => {
      const first = setup();
      await first.unarchive();
      expect(first.patchTask).toHaveBeenCalledWith(expect.anything(), { bucket: 'todo' });

      const second = setup({ buckets: ref([createMockBucket({ name: 'backlog' })]) });
      await second.unarchive();
      expect(second.patchTask).toHaveBeenCalledWith(expect.anything(), { bucket: 'backlog' });
    });

    it('stays open and reports the error when the move fails', async () => {
      const { archive, error, closeModal } = setup({ patchTask: vi.fn().mockRejectedValue(new Error('denied')) });
      await archive();
      expect(error.value).toContain('denied');
      expect(closeModal).not.toHaveBeenCalled();
    });
  });
});
