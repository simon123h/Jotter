import { t, type MessageKey } from '@/i18n';

/** What the planned date menu offers, as on the desktop. Other values found in files are still shown and kept. */
export const PLANNED_CHOICES = ['today', 'tomorrow', 'thisWeek', 'thisMonth', 'thisYear', 'sometime'] as const;

const KEYWORDS: Record<string, MessageKey> = {
  today: 'planned.today',
  tomorrow: 'planned.tomorrow',
  thisweek: 'planned.thisWeek',
  nextweek: 'planned.nextWeek',
  thismonth: 'planned.thisMonth',
  nextmonth: 'planned.nextMonth',
  thisyear: 'planned.thisYear',
  nextyear: 'planned.nextYear',
  someday: 'planned.sometime',
  sometime: 'planned.sometime',
};

/** A readable label for a stored planned date: a keyword in any spelling (`this-week`), or a date as it is. */
export function plannedLabel(value: string): string {
  const key = KEYWORDS[value.trim().toLowerCase().replace(/-/g, '')];
  return key ? t(key) : value;
}
