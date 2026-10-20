import { PLANNED_PRESETS, plannedFor } from '@jotter/task-filter';
import type { TranslateFn } from '@/composables/useI18n';

/** The planned values a menu offers today: a day, a week or a month each (see packages/task-filter). */
export const plannedChoices = (now: Date = new Date()) => PLANNED_PRESETS.map((preset) => ({ preset, value: plannedFor(preset, now) }));

/** A readable label for a planned value: "This week" for the week that is on, a date, "Week 43" or the month's name. */
export function plannedLabel(value: string, t: TranslateFn, locale: string, now: Date = new Date()): string {
  const preset = PLANNED_PRESETS.find((p) => plannedFor(p, now) === value);
  if (preset) return t(`plannedDateOptions.${preset}`);

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(year !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
  }
  const week = /^(\d{4})-W(\d{2})$/.exec(value);
  if (week) return t('plannedDateOptions.week', { week: Number(week[2]) });
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    const year = Number(month[1]);
    return new Date(year, Number(month[2]) - 1, 1).toLocaleDateString(locale, {
      month: 'long',
      ...(year !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
  }
  return value;
}
