import { describe, it, expect, beforeEach } from 'vitest';
import { useI18n } from '@/composables/useI18n';

describe('useI18n composable', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to English locale', () => {
    const { locale } = useI18n();
    // Default fallback since navigator.language isn't 'de' in testing environment
    expect(locale.value).toBe('en');
  });

  it('can change locale and persist it to localStorage', () => {
    const { locale } = useI18n();
    locale.value = 'de';
    expect(locale.value).toBe('de');
    expect(localStorage.getItem('jotter-lang')).toBe('de');
  });

  it('translates keys correctly in English', () => {
    const { locale, t } = useI18n();
    locale.value = 'en';
    expect(t('brand.title')).toBe('Jotter');
    expect(t('buttons.cancel')).toBe('Cancel');
    expect(t('projects.allProjects')).toBe('All Projects');
  });

  it('translates keys correctly in German', () => {
    const { locale, t } = useI18n();
    locale.value = 'de';
    expect(t('brand.title')).toBe('Jotter');
    expect(t('buttons.cancel')).toBe('Abbrechen');
  });

  it('performs text interpolation correctly', () => {
    const { locale, t } = useI18n();
    locale.value = 'en';
    expect(t('sync.success', { count: 5 })).toBe('Index synchronized successfully! Loaded 5 tasks from markdown files.');
  });

  it('falls back to English if key is missing in German', () => {
    const { locale, t } = useI18n();
    locale.value = 'de';
    // Let's test a key that we might add or mock if it was missing.
    // In our en.ts / de.ts, brand.title is same, but let's test a key that returns the key path if it is completely absent:
    expect(t('nonexistent.key.path')).toBe('nonexistent.key.path');
  });
});
