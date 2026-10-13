import { locale, t } from '@/i18n';

export type DueTone = 'overdue' | 'today' | 'tomorrow' | 'later';

/** A due date as Todoist shows it: Today, Tomorrow, Yesterday, or a short date; with a tone for the colour. */
export function dueInfo(iso: string, now: Date = new Date()): { text: string; tone: DueTone } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return { text: iso, tone: 'later' };
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const due = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return { text: t('date.today'), tone: 'today' };
  if (days === 1) return { text: t('date.tomorrow'), tone: 'tomorrow' };
  if (days === -1) return { text: t('date.yesterday'), tone: 'overdue' };
  const text = due.toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    ...(year !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
  return { text, tone: days < 0 ? 'overdue' : 'later' };
}
