import type { RepeatRule } from '@/types';

export const REPEAT_UNITS: RepeatRule['unit'][] = ['day', 'week', 'month', 'year'];

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** "Weekly", "Every 3 days". */
export const repeatLabel = (rule: RepeatRule, t: Translate): string =>
  rule.every === 1 ? t(`repeat.once.${rule.unit}`) : t('repeat.many', { n: rule.every, units: t(`repeat.units.${rule.unit}`) });
