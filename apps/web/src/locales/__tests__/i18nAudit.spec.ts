import { describe, it, expect } from 'vitest';
import { en } from '@/locales/en';
import { de } from '@/locales/de';

const sources = import.meta.glob(['/src/**/*.vue', '/src/**/*.ts', '!/src/**/__tests__/**', '!/src/locales/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const flatten = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> =>
  Object.entries(obj).reduce<Record<string, unknown>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(acc, flatten(v as Record<string, unknown>, key));
    else acc[key] = v;
    return acc;
  }, {});

const enFlat = flatten(en as unknown as Record<string, unknown>);
const deFlat = flatten(de as unknown as Record<string, unknown>);

const hasPrefix = (prefix: string) => Object.keys(enFlat).some((k) => k.startsWith(prefix));

// Matches t('a.b'), t("a.b") and t('a.b.' + x) / t(`a.b.${x}`)
const CALL = /(?<![\w.])t\(\s*(['"`])([\w.-]+)(?:\1|\$\{)/g;

describe('i18n audit', () => {
  it('has the same keys in en and de', () => {
    const missingInDe = Object.keys(enFlat).filter((k) => !(k in deFlat));
    const missingInEn = Object.keys(deFlat).filter((k) => !(k in enFlat));
    expect({ missingInDe, missingInEn }).toEqual({ missingInDe: [], missingInEn: [] });
  });

  it('has no empty translations', () => {
    const empty = [...Object.entries(enFlat), ...Object.entries(deFlat)].filter(([, v]) => v === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('only uses translation keys that exist', () => {
    const missing: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const m of code.matchAll(CALL)) {
        const key = m[2];
        const dynamic = key.endsWith('.') || m[0].endsWith('${');
        const ok = dynamic ? hasPrefix(key) : key in enFlat;
        if (!ok) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
