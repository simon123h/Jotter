import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

/** Where a task was, so that a move can be undone. */
interface Placement {
  bucket: string;
  position: number;
}

/** Marking a task done, archiving or moving it, each with a message that offers to undo the move. */
export function useTaskActions() {
  const app = useAppStore();
  const ui = useUiStore();

  const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));

  function offerUndo(id: string, before: Placement, message: string) {
    ui.showToast(message, {
      label: t('common.undo'),
      run: () => {
        ui.dismissToast();
        app.restoreTask(id, before).catch(fail);
      },
    });
  }

  /** Tells the user a task changed bucket, if it did, and lets them undo it. */
  function announceMove(id: string, before: Placement, bucket: string) {
    if (before.bucket === bucket) return;
    const title = app.buckets.find((b) => b.name === bucket)?.title ?? bucket;
    offerUndo(id, before, t('task.movedTo', { bucket: title }));
  }

  async function run(id: string, kind: 'done' | 'archive') {
    try {
      const before = kind === 'done' ? await app.markDone(id) : await app.archiveTask(id);
      offerUndo(id, before, t(kind === 'done' ? 'task.markedDone' : 'task.archived'));
    } catch (err) {
      fail(err);
    }
  }

  /** Moves a task to the end of a bucket of its project. */
  async function moveTo(id: string, bucket: string) {
    const task = app.taskById(id);
    if (!task || task.bucket === bucket) return;
    const before = { bucket: task.bucket, position: task.position };
    try {
      await app.moveTask(id, bucket);
      announceMove(id, before, bucket);
    } catch (err) {
      fail(err);
    }
  }

  /** Takes a finished task back into the first bucket that is still open. */
  async function reopen(id: string) {
    const task = app.taskById(id);
    const open = app.buckets.filter((b) => b.name !== 'done' && b.name !== 'archive');
    const target = open.find((b) => b.is_default) ?? open[0];
    if (!task || !target) return;
    const before = { bucket: task.bucket, position: task.position };
    try {
      await app.moveTask(id, target.name);
      offerUndo(id, before, t('task.reopened'));
    } catch (err) {
      fail(err);
    }
  }

  return {
    markDone: (id: string) => run(id, 'done'),
    archive: (id: string) => run(id, 'archive'),
    moveTo,
    reopen,
    announceMove,
  };
}
