import { isBeyond, today } from '@jotter/task-filter';
import { t } from '@/i18n';
import { plannedLabel } from '@/planned';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

/**
 * Says so when a task has just been planned beyond the horizon of the view: it is hidden until then, and without a word it
 * would look as if it had vanished.
 */
export function useAheadNotice() {
  const app = useAppStore();
  const ui = useUiStore();
  return (planned: string | null | undefined) => {
    if (!planned || !isBeyond(planned, app.horizon, today())) return;
    ui.showToast(t('tasks.plannedAhead', { when: plannedLabel(planned) }));
  };
}
