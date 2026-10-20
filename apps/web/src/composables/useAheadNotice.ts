import { isBeyond, today } from '@jotter/task-filter';
import { useI18n } from '@/composables/useI18n';
import { useSettingsStore } from '@/stores/settings';
import { useToast } from '@/composables/useToast';
import { plannedLabel } from '@/utils/planned';

/**
 * Says so when a task has just been planned beyond the horizon of the views: it is hidden until then, and without a word it
 * would look as if it had vanished.
 */
export function useAheadNotice() {
  const { t, locale } = useI18n();
  const settingsStore = useSettingsStore();
  const toast = useToast();

  return (planned: string | null | undefined) => {
    if (!planned || !isBeyond(planned, settingsStore.planningHorizon, today())) return;
    toast.info(t('toasts.plannedAhead', { when: plannedLabel(planned, t, locale.value) }));
  };
}
