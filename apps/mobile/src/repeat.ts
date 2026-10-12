import type { RepeatRule } from '@jotter/vault-format';
import { t, type MessageKey } from '@/i18n';

export const REPEAT_UNITS: RepeatRule['unit'][] = ['day', 'week', 'month', 'year'];

/** "Weekly", "Every 3 days". */
export const repeatLabel = (rule: RepeatRule): string =>
  rule.every === 1
    ? t(`repeat.once.${rule.unit}` as MessageKey)
    : t('repeat.many', { n: rule.every, units: t(`repeat.unit.${rule.unit}` as MessageKey) });
