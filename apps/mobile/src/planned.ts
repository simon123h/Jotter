import { t, locale } from '@/i18n';
import { dueInfo } from '@/dates';
import { PLANNED_PRESETS, plannedFor } from '@jotter/task-filter';

/** A readable label for a planned value: "This week" for the week that is on, a date, "Week 43" or the month's name. */
export function plannedLabel(value: string, now: Date = new Date()): string {
  const preset = PLANNED_PRESETS.find((p) => plannedFor(p, now) === value);
  if (preset) return t(`planned.${preset}`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dueInfo(value, now).text;
  const week = /^(\d{4})-W(\d{2})$/.exec(value);
  if (week) return t('planned.week', { week: Number(week[2]) });
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    const year = Number(month[1]);
    return new Date(year, Number(month[2]) - 1, 1).toLocaleDateString(locale.value, {
      month: 'long',
      ...(year !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
  }
  return value;
}
