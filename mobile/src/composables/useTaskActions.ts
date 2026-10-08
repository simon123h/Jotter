import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

/** Marking a task done or archiving it, with a message that offers to undo the move. */
export function useTaskActions() {
  const app = useAppStore();
  const ui = useUiStore();

  const fail = (err: unknown) => ui.showToast(err instanceof Error ? err.message : String(err));

  async function run(id: string, kind: 'done' | 'archive') {
    try {
      const before = kind === 'done' ? await app.markDone(id) : await app.archiveTask(id);
      ui.showToast(t(kind === 'done' ? 'task.markedDone' : 'task.archived'), {
        label: t('common.undo'),
        run: () => {
          ui.dismissToast();
          app.restoreTask(id, before).catch(fail);
        },
      });
    } catch (err) {
      fail(err);
    }
  }

  return { markDone: (id: string) => run(id, 'done'), archive: (id: string) => run(id, 'archive') };
}
