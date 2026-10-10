import { t, type MessageKey } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

/** Where a task was, so that a move can be undone. */
interface Placement {
  bucket: string;
  position: number;
  postponed?: string;
}

const list = (ids: string | string[]) => (Array.isArray(ids) ? ids : [ids]);

/**
 * What can be done to one task or to several at once: finish, reopen, archive, move, edit fields, delete. Each says
 * what it did in the message bar, with an Undo where the change can be reversed. Tasks that are moved or deleted
 * leave the selection; edits keep it, so that several can be applied in a row.
 */
export function useTaskActions() {
  const app = useAppStore();
  const ui = useUiStore();

  const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));

  function offerUndo(message: string, undo: () => Promise<void>) {
    ui.showToast(message, {
      label: t('common.undo'),
      run: () => {
        ui.dismissToast();
        undo().catch(fail);
      },
    });
  }

  /** One message for one task, another (with the count) for several. */
  const say = (count: number, one: MessageKey, many: MessageKey, params: Record<string, string | number> = {}) =>
    count === 1 ? t(one, params) : t(many, { count, ...params });

  async function moveMany(ids: string[], bucket: string, title: string | undefined, one: MessageKey, many: MessageKey, params = {}) {
    try {
      const before = await app.moveManyToBucket(ids, bucket, title);
      app.deselect(ids);
      if (before.length) offerUndo(say(before.length, one, many, params), () => app.restoreMany(before));
    } catch (err) {
      fail(err);
    }
  }

  const markDone = (ids: string | string[]) => moveMany(list(ids), 'done', 'Done', 'task.markedDone', 'tasks.markedDone');
  const archive = (ids: string | string[]) => moveMany(list(ids), 'archive', 'Archive', 'task.archived', 'tasks.archived');

  /** Moves tasks to the end of a bucket of their project. */
  function moveTo(ids: string | string[], bucket: string) {
    const title = app.buckets.find((b) => b.name === bucket)?.title ?? bucket;
    return moveMany(list(ids), bucket, undefined, 'task.movedTo', 'tasks.movedTo', { bucket: title });
  }

  /** Takes done tasks back into the first bucket that is still open, the inbox. */
  function reopen(ids: string | string[]) {
    const open = app.buckets.filter((b) => b.name !== 'done' && b.name !== 'archive');
    const target = open.find((b) => b.is_default) ?? open[0];
    const done = list(ids).filter((id) => app.taskById(id)?.bucket === 'done');
    if (!target || !done.length) return Promise.resolve();
    return moveMany(done, target.name, undefined, 'task.reopened', 'tasks.reopened');
  }

  /** Tells the user a dragged or single task changed bucket, if it did, and lets them undo it. */
  function announceMove(id: string, before: Placement, bucket: string) {
    if (before.bucket === bucket && before.postponed === undefined) return;
    const title = app.buckets.find((b) => b.name === bucket)?.title ?? (bucket === 'postponed' ? t('postponed.title') : bucket);
    offerUndo(t('task.movedTo', { bucket: title }), () => app.restoreMany([{ id, ...before }]));
  }

  // ---------- editing fields of several tasks ----------

  async function edit(ids: string[], changes: Parameters<typeof app.editMany>[1], one: MessageKey, many: MessageKey) {
    try {
      const before = await app.editMany(ids, changes);
      if (before.length) offerUndo(say(before.length, one, many), () => app.restoreFields(before));
    } catch (err) {
      fail(err);
    }
  }

  const setPriority = (ids: string[], priority: string) =>
    edit(ids, () => ({ priority: priority || undefined }), 'task.edited', 'tasks.priorityChanged');
  const setColor = (ids: string[], color: string) => edit(ids, () => ({ color: color || null }), 'task.edited', 'tasks.colorChanged');
  const setDue = (ids: string[], date: string) => edit(ids, () => ({ due_date: date || undefined }), 'task.edited', 'tasks.dueChanged');
  const setPlanned = (ids: string[], planned: string) =>
    edit(ids, () => ({ planned_date: planned || undefined }), 'task.edited', 'tasks.plannedChanged');
  const setPostponed = (ids: string[], date: string) =>
    edit(ids, () => ({ postponed_until: date || undefined }), 'task.edited', 'tasks.postponedChanged');
  const addTags = (ids: string[], tags: string[]) =>
    edit(ids, (task) => ({ tags: [...new Set([...task.tags, ...tags])] }), 'task.edited', 'tasks.tagAdded');
  const removeTag = (ids: string[], tag: string) =>
    edit(ids, (task) => ({ tags: task.tags.filter((x) => x !== tag) }), 'task.edited', 'tasks.tagRemoved');

  async function moveToProject(ids: string[], projectId: string) {
    const title = app.projects.find((p) => p.id === projectId)?.title ?? projectId;
    try {
      await app.moveManyToProject(ids, projectId);
      app.deselect(ids);
      ui.showToast(say(ids.length, 'task.movedToProject', 'tasks.movedToProject', { project: title }));
    } catch (err) {
      fail(err);
    }
  }

  async function remove(ids: string[]) {
    try {
      await app.removeMany(ids);
      app.deselect(ids);
      ui.showToast(say(ids.length, 'task.deleted', 'tasks.deleted'));
    } catch (err) {
      fail(err);
    }
  }

  return {
    markDone,
    archive,
    moveTo,
    reopen,
    announceMove,
    setPriority,
    setColor,
    setDue,
    setPlanned,
    setPostponed,
    addTags,
    removeTag,
    moveToProject,
    remove,
  };
}
