import type { Ref } from 'vue';
import { createTask, deleteTask } from '@/api';
import { useI18n } from '@/composables/useI18n';
import { useDialog } from '@/composables/useDialog';
import { extractAllChecklistItems } from '@/utils/markdown';
import type { Task, Bucket } from '@/types';

interface Options {
  task: Ref<Task | null>;
  buckets: Ref<Bucket[]>;
  actualProjectId: Ref<string>;
  patchTask: (task: Task, data: Partial<Task>) => Promise<Task>;
  /** The edit form; its body is kept in sync after splitting subtasks. */
  editForm: { body: string };
  loading: Ref<boolean>;
  error: Ref<string | null>;
  closeModal: () => void;
  refreshBoard: () => void;
}

/** Task-level actions available from the detail modal: checklist toggles, split, delete, done, archive. */
export function useTaskDetailActions({
  task,
  buckets,
  actualProjectId,
  patchTask,
  editForm,
  loading,
  error,
  closeModal,
  refreshBoard,
}: Options) {
  const { t } = useI18n();
  const { showDialog } = useDialog();

  /** Persist a body that changed because a checkbox was toggled in the rendered markdown. */
  const toggleCheckboxInBody = async (newBody: string) => {
    if (!task.value) return;
    try {
      task.value = await patchTask(task.value, { body: newBody });
    } catch (err: any) {
      error.value = t('errors.updateTask', { message: err.message || err });
    }
  };

  /** Turn every checklist item into its own task card in the same bucket and strip them from the body. */
  const splitAllSubtasks = async () => {
    if (!task.value || !task.value.body) return;

    const { items, cleanedBody } = extractAllChecklistItems(task.value.body);
    if (items.length === 0) return;

    const confirmed = await showDialog({
      title: t('form.splitSubtasks'),
      message: t('form.splitSubtasksConfirm', { count: items.length }),
      type: 'info',
      showCancel: true,
      confirmText: t('form.splitSubtasks'),
      cancelText: t('buttons.cancel'),
    });
    if (!confirmed) return;

    loading.value = true;
    error.value = null;

    try {
      for (const item of items) {
        await createTask(actualProjectId.value, {
          title: item.title,
          bucket: task.value.bucket,
          tags: [...(task.value.tags || [])],
          priority: task.value.priority || undefined,
        });
      }

      task.value = await patchTask(task.value, { body: cleanedBody });
      editForm.body = cleanedBody;

      refreshBoard();
    } catch (err: any) {
      error.value = t('errors.createTask', { message: err.message || err });
    } finally {
      loading.value = false;
    }
  };

  const deleteCurrentTask = async () => {
    if (!task.value) return;
    const confirmed = await showDialog({
      title: t('buttons.deleteTask'),
      message: t('deleteConfirm'),
      type: 'warning',
      showCancel: true,
      confirmText: t('buttons.delete'),
      cancelText: t('buttons.cancel'),
    });
    if (!confirmed) return;

    loading.value = true;
    error.value = null;
    try {
      await deleteTask(actualProjectId.value, task.value.id);
      refreshBoard();
      closeModal();
    } catch (err: any) {
      error.value = t('errors.deleteTask', { message: err.message || err });
      loading.value = false;
    }
  };

  /** Patch the bucket, then close the modal. */
  const moveAndClose = async (patch: Partial<Task>) => {
    if (!task.value) return;
    try {
      task.value = await patchTask(task.value, patch);
      closeModal();
    } catch (err: any) {
      error.value = t('errors.updateTask', { message: err.message || err });
    }
  };

  const markDone = () => moveAndClose({ bucket: 'done', position: 1000000.0 });
  const archive = () => moveAndClose({ bucket: 'archive' });
  const unarchive = () => {
    const target = buckets.value.find((b) => b.name === 'todo')?.name || buckets.value[0]?.name || 'todo';
    return moveAndClose({ bucket: target });
  };

  return { toggleCheckboxInBody, splitAllSubtasks, deleteCurrentTask, markDone, archive, unarchive };
}
