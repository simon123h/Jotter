import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { formatDateStr } from '../utils/timeGrid';

/** The day shown in the sidebar. Navigation is bounded to today and the future. */
export function useActiveDay() {
  const { t } = useI18n();

  const activeDate = ref<Date>(new Date());
  const activeDateStr = computed(() => formatDateStr(activeDate.value));
  const todayStr = computed(() => formatDateStr(new Date()));
  const isToday = computed(() => todayStr.value === activeDateStr.value);

  const activeDayTitle = computed(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = activeDate.value.toLocaleDateString(undefined, options);
    const todayLabel = t('timeblock.today') || 'Today';
    return isToday.value ? `${todayLabel}, ${formatted}` : formatted;
  });

  const prevDay = () => {
    if (isToday.value) return;
    const d = new Date(activeDate.value);
    d.setDate(d.getDate() - 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activeDate.value = d < today ? new Date() : d;
  };

  const nextDay = () => {
    const d = new Date(activeDate.value);
    d.setDate(d.getDate() + 1);
    activeDate.value = d;
  };

  const resetToToday = () => {
    activeDate.value = new Date();
  };

  /** Jump to a YYYY-MM-DD value from a date input; past dates clamp to today. */
  const setDateFromInput = (value: string) => {
    if (!value) return;
    const [y, m, d] = value.split('-').map(Number);
    const chosen = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activeDate.value = chosen < today ? new Date() : chosen;
  };

  return { activeDateStr, todayStr, isToday, activeDayTitle, prevDay, nextDay, resetToToday, setDateFromInput };
}
