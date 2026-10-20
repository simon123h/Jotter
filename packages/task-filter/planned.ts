/**
 * The planned date: a day, an ISO week or a month (spec/FORMAT.md, "Dates and times"). It is always absolute. The legacy
 * values of older files (a planning keyword, `postponed_until`) are resolved against today when a file is read, so
 * nothing else has to know about them. Days are `YYYY-MM-DD` strings, calculated in UTC so that no time zone shifts them.
 */

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);
const formatDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

/** The ISO week a day lies in, as `YYYY-Www`. */
export function weekOf(day: string): string {
  const date = parseDay(day);
  const thursday = addDays(date, 3 - ((date.getUTCDay() + 6) % 7));
  const year = thursday.getUTCFullYear();
  const ordinal = Math.round((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
  return `${year}-W${pad(Math.ceil(ordinal / 7))}`;
}

/** The month a day lies in, as `YYYY-MM`. */
export const monthOf = (day: string) => day.slice(0, 7);

/** The Monday of an ISO week, or null when the year has no such week. */
function weekStart(year: number, week: number): string | null {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = addDays(jan4, -((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const start = formatDay(monday);
  return week >= 1 && weekOf(start) === `${year}-W${pad(week)}` ? start : null;
}

function validDay(text: string): string | null {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(text)) return null;
  const date = parseDay(text);
  return !Number.isNaN(date.getTime()) && formatDay(date) === text ? text : null;
}

/** The day, week or month `raw` stands for, in its written form. Null when it is none of them. */
export function canonicalPlanned(raw: string): string | null {
  const text = raw.trim();
  const day = /^([1-9]\d{3}-\d{2}-\d{2})(?:[T ].*)?$/.exec(text);
  if (day) return validDay(day[1]);
  const week = /^([1-9]\d{3})-[Ww](\d{2})$/.exec(text);
  if (week) return weekStart(Number(week[1]), Number(week[2])) ? `${week[1]}-W${week[2]}` : null;
  const month = /^([1-9]\d{3})-(\d{2})$/.exec(text);
  if (month) return Number(month[2]) >= 1 && Number(month[2]) <= 12 ? text : null;
  return null;
}

/** The first day of a planned value (a day is its own first day). Null when it is not a planned value. */
export function plannedStart(value: string): string | null {
  const canonical = canonicalPlanned(value);
  if (!canonical) return null;
  const week = /^(\d{4})-W(\d{2})$/.exec(canonical);
  if (week) return weekStart(Number(week[1]), Number(week[2]));
  if (/^\d{4}-\d{2}$/.test(canonical)) return `${canonical}-01`;
  return canonical;
}

// Legacy planning keywords, compared ignoring case and hyphens (`this-week` is `thisWeek`)
const KEYWORDS = new Set(['today', 'tomorrow', 'thisweek', 'nextweek', 'thismonth', 'nextmonth', 'thisyear', 'nextyear', 'someday', 'sometime']);
const keyword = (text: string) => text.trim().toLowerCase().replace(/-/g, '');

/** True for a legacy planning keyword (`today`, `thisWeek`, `someday`, ...). */
export const isPlanningKeyword = (text: string) => KEYWORDS.has(keyword(text));

/** The planned date a legacy keyword stands for on `today`. Null for those without a date. */
export function resolveKeyword(text: string, today: string): string | null {
  const now = parseDay(today);
  switch (keyword(text)) {
    case 'today':
      return today;
    case 'tomorrow':
      return formatDay(addDays(now, 1));
    case 'thisweek':
      return weekOf(today);
    case 'nextweek':
      return weekOf(formatDay(addDays(now, 7)));
    case 'thismonth':
      return monthOf(today);
    case 'nextmonth':
      return monthOf(formatDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))));
    default:
      return null;
  }
}

/** A planned date as found in a file: a canonical value, a legacy keyword resolved, anything else dropped. */
export function readPlanned(raw: unknown, today: string): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const text = String(raw).trim();
  return isPlanningKeyword(text) ? resolveKeyword(text, today) : canonicalPlanned(text);
}

/**
 * True when a file holds a planning keyword or a postponement that is still ahead. Such a file is read again on every scan
 * until it is saved, so that the day it stands for follows the calendar the way it always did, on every device.
 */
export function isLegacyPlanned(plannedRaw: unknown, postponedRaw: unknown, today: string): boolean {
  if (plannedRaw && isPlanningKeyword(String(plannedRaw))) return true;
  const match = postponedRaw ? /^([1-9]\d{3}-\d{2}-\d{2})(?:[T ].*)?$/.exec(String(postponedRaw).trim()) : null;
  return !!match && !!validDay(match[1]) && match[1] > today;
}

/** Folds a legacy `postponed_until` into the planned date: it wins when it lies after today and the planned date
 * starts before it. */
export function mergePostponed(planned: string | null, postponedRaw: unknown, today: string): string | null {
  if (postponedRaw === undefined || postponedRaw === null || postponedRaw === '') return planned;
  const match = /^([1-9]\d{3}-\d{2}-\d{2})(?:[T ].*)?$/.exec(String(postponedRaw).trim());
  const postponed = match ? validDay(match[1]) : null;
  if (!postponed || postponed <= today) return planned;
  if (planned !== null) {
    const start = plannedStart(planned);
    if (start !== null && start >= postponed) return planned;
  }
  return postponed;
}

/** The first and last day a search for `value` covers: a day, a week, a month, or a legacy keyword for one. */
export function plannedSpan(value: string, today: string): [string, string] | null {
  const text = isPlanningKeyword(value) ? resolveKeyword(value, today) : canonicalPlanned(value);
  const start = text ? plannedStart(text) : null;
  if (!text || !start) return null;
  if (text.length === 10) return [start, start];
  if (text.includes('W')) return [start, formatDay(addDays(parseDay(start), 6))];
  const [year, month] = start.split('-').map(Number);
  return [start, formatDay(new Date(Date.UTC(year, month, 0)))];
}

/** How far ahead an app shows planned tasks. A task planned beyond it is kept out of the way. */
export type Horizon = 'today' | 'tomorrow' | 'week' | 'month' | 'all';

export const HORIZONS: Horizon[] = ['today', 'tomorrow', 'week', 'month', 'all'];

/** The last day a horizon covers (null for no limit). A week is an ISO week, Monday to Sunday. */
export function horizonEnd(horizon: Horizon, today: string): string | null {
  switch (horizon) {
    case 'today':
      return today;
    case 'tomorrow':
      return formatDay(addDays(parseDay(today), 1));
    case 'week':
      return plannedSpan(weekOf(today), today)![1];
    case 'month':
      return plannedSpan(monthOf(today), today)![1];
    default:
      return null;
  }
}

/** Whether a planned value starts after the horizon: the task is planned further ahead than the app shows. */
export function isBeyond(planned: string | null | undefined, horizon: Horizon, today: string): boolean {
  const end = horizonEnd(horizon, today);
  const start = planned ? plannedStart(planned) : null;
  return end !== null && start !== null && start > end;
}

/** What the planned date menus offer. Each stands for a day, a week or a month, written into the file when it is picked. */
export const PLANNED_PRESETS = ['today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth'] as const;
export type PlannedPreset = (typeof PLANNED_PRESETS)[number];

const localDay = (now: Date, offset = 0) =>
  formatDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset)));

/** The planned value a preset stands for on a day: a day, an ISO week (`2026-W43`) or a month (`2026-10`). */
export function plannedFor(preset: PlannedPreset, now: Date = new Date()): string {
  const day = localDay(now);
  switch (preset) {
    case 'today':
      return day;
    case 'tomorrow':
      return localDay(now, 1);
    case 'thisWeek':
      return weekOf(day);
    case 'nextWeek':
      return weekOf(localDay(now, 7));
    case 'thisMonth':
      return monthOf(day);
    case 'nextMonth':
      return monthOf(formatDay(new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))));
  }
}

/** The stretches of time a planning view groups by, in order. */
export const PLAN_SLOTS = ['slipped', 'today', 'tomorrow', 'week', 'month', 'later', 'none'] as const;
export type PlanSlot = (typeof PLAN_SLOTS)[number];

/**
 * The stretch of time a planned value belongs to, by the last day it covers: a day that has passed or a week or month
 * that is over has slipped, the current week is "week", the current month "month".
 */
export function plannedSlot(value: string | null | undefined, now: Date = new Date()): PlanSlot {
  const day = localDay(now);
  const span = value ? plannedSpan(value, day) : null;
  if (!span) return 'none';
  const [from, to] = span;
  if (to < day) return 'slipped';
  if (from === to && from === day) return 'today';
  if (from === to && from === localDay(now, 1)) return 'tomorrow';
  // A month plan is "some day this month" even in the last days of it, when the week reaches past the end of the month
  const isMonth = canonicalPlanned(value!)?.length === 7;
  if (!isMonth && to <= horizonEnd('week', day)!) return 'week';
  if (to <= horizonEnd('month', day)!) return 'month';
  return 'later';
}

/** The planned value for a task made or dropped in a stretch of time. Empty for none. */
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
