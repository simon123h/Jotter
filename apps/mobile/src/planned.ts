import { t, locale } from '@/i18n';
import { dueInfo } from '@/dates';
import { horizonEnd, isoDay, monthOf, plannedSpan, today, weekOf } from '@jotter/task-filter';

/** What the planned date menu offers. Each stands for a day, a week or a month, written into the file when it is picked. */
export const PLANNED_PRESETS = ['today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth'] as const;
export type PlannedPreset = (typeof PLANNED_PRESETS)[number];

/** The planned value a preset stands for on a day: a day, an ISO week (`2026-W43`) or a month (`2026-10`). */
export function plannedFor(preset: PlannedPreset, now: Date = new Date()): string {
  const day = today(now);
  switch (preset) {
    case 'today':
      return day;
    case 'tomorrow':
      return isoDay(1, now);
    case 'thisWeek':
      return weekOf(day);
    case 'nextWeek':
      return weekOf(isoDay(7, now));
    case 'thisMonth':
      return monthOf(day);
    case 'nextMonth':
      return monthOf(isoDay(0, new Date(now.getFullYear(), now.getMonth() + 1, 1)));
  }
}

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

/** The tabs of the planning view, in order. */
export const PLAN_SLOTS = ['slipped', 'today', 'tomorrow', 'week', 'month', 'later', 'none'] as const;
export type PlanSlot = (typeof PLAN_SLOTS)[number];

/**
 * The tab a planned value belongs to, by the last day it covers: a day that has passed or a week or month that is over
 * has slipped, the current week is "this week", the current month "this month".
 */
export function plannedSlot(value: string | undefined, now: Date = new Date()): PlanSlot {
  const day = today(now);
  const span = value ? plannedSpan(value, day) : null;
  if (!span) return 'none';
  const [from, to] = span;
  if (to < day) return 'slipped';
  if (from === to && from === day) return 'today';
  if (from === to && from === isoDay(1, now)) return 'tomorrow';
  if (to <= horizonEnd('week', day)!) return 'week';
  if (to <= horizonEnd('month', day)!) return 'month';
  return 'later';
}

/** The planned value for a task made in a tab of the planning view. */
export function slotValue(slot: PlanSlot, now: Date = new Date()): string {
  const preset: Record<PlanSlot, PlannedPreset | null> = {
    slipped: 'today',
    today: 'today',
    tomorrow: 'tomorrow',
    week: 'thisWeek',
    month: 'thisMonth',
    later: 'nextMonth',
    none: null,
  };
  const found = preset[slot];
  return found ? plannedFor(found, now) : '';
}
