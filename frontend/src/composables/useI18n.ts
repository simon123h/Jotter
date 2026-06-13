import { ref, computed, watch } from 'vue';
import { en } from '@/locales/en';
import { de } from '@/locales/de';
import { useSettingsStore } from '@/stores/settings';

export type Locale = 'en' | 'de';

const messages = { en, de };

// Detect default locale
const getBrowserLocale = (): Locale => {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || (navigator as any).userLanguage || 'en';
  return lang.toLowerCase().startsWith('de') ? 'de' : 'en';
};

const savedLocale = typeof localStorage !== 'undefined' ? (localStorage.getItem('jotter-lang') as Locale | null) : null;
const currentLocale = ref<Locale>(savedLocale && (savedLocale === 'en' || savedLocale === 'de') ? savedLocale : getBrowserLocale());

export function useI18n() {
  let settingsStore: any = null;
  try {
    settingsStore = useSettingsStore();
  } catch {
    // Pinia not yet initialized or in a non-component test context
  }

  const locale = computed({
    get: () => {
      if (settingsStore && settingsStore.language && (settingsStore.language === 'en' || settingsStore.language === 'de')) {
        return settingsStore.language as Locale;
      }
      return currentLocale.value;
    },
    set: (value: Locale) => {
      currentLocale.value = value;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('jotter-lang', value);
      }
      if (settingsStore) {
        settingsStore.language = value;
      }
    },
  });

  if (settingsStore) {
    watch(
      () => settingsStore.language,
      (newLang) => {
        if (newLang === 'en' || newLang === 'de') {
          if (currentLocale.value !== newLang) {
            currentLocale.value = newLang;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('jotter-lang', newLang);
            }
          }
        }
      },
      { immediate: true }
    );
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = messages[currentLocale.value];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English
        let fallbackValue: any = messages['en'];
        for (const fk of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && fk in fallbackValue) {
            fallbackValue = fallbackValue[fk];
          } else {
            fallbackValue = null;
            break;
          }
        }
        return typeof fallbackValue === 'string' ? interpolate(fallbackValue, params) : key;
      }
    }

    if (typeof value === 'string') {
      return interpolate(value, params);
    }
    return key;
  };

  const interpolate = (text: string, params?: Record<string, string | number>): string => {
    if (!params) return text;
    return text.replace(/{(\w+)}/g, (_, name) => {
      return params[name] !== undefined ? String(params[name]) : `{${name}}`;
    });
  };

  const tBucket = (name: string, fallback?: string): string => {
    const key = 'buckets.' + name;
    const translated = t(key);
    return translated !== key ? translated : fallback || name;
  };

  return {
    locale,
    t,
    tBucket,
  };
}
export type TranslateFn = ReturnType<typeof useI18n>['t'];
export type LocaleRef = ReturnType<typeof useI18n>['locale'];
export { messages };
