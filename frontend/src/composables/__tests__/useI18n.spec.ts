import { describe, it, expect, beforeEach } from 'vitest';
import { useI18n, messages } from '@/composables/useI18n';

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
    expect(t('common.save')).toBe('Save');
    expect(t('buttons.cancel')).toBe('Cancel');
    expect(t('projects.allProjects')).toBe('All Projects');
  });

  it('translates keys correctly in German', () => {
    const { locale, t } = useI18n();
    locale.value = 'de';
    expect(t('brand.title')).toBe('Jotter');
    expect(t('common.save')).toBe('Speichern');
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

    // Mock an English-only key in messages
    (messages.en as any).testMissingKey = { subKey: 'English Fallback Phrase' };
    delete (messages.de as any).testMissingKey;

    expect(t('testMissingKey.subKey')).toBe('English Fallback Phrase');

    // Completely absent keys in both return the key path
    expect(t('nonexistent.key.path')).toBe('nonexistent.key.path');
  });
});
