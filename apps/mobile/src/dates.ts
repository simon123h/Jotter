import { locale, t } from '@/i18n';

/** A day as YYYY-MM-DD in the local calendar, `offset` days from today. */
export function isoDay(offset = 0, now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Postponed to a day after today: the task is out of the way until then. */
export const isPostponed = (task: { postponed_until?: string | null }, now: Date = new Date()) =>
  !!task.postponed_until && task.postponed_until > isoDay(0, now);

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
