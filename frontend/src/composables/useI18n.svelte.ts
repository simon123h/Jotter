import { en } from '@/locales/en';
import { de } from '@/locales/de';

export type Locale = 'en' | 'de';

const messages = { en, de };

// Detect default locale
const getBrowserLocale = (): Locale => {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || (navigator as any).userLanguage || 'en';
  return lang.toLowerCase().startsWith('de') ? 'de' : 'en';
};

const savedLocale = typeof localStorage !== 'undefined' ? (localStorage.getItem('jotter-lang') as Locale | null) : null;
let currentLocaleVal = $state<Locale>(savedLocale && (savedLocale === 'en' || savedLocale === 'de') ? savedLocale : getBrowserLocale());

const localeObj = {
  get value(): Locale {
    return currentLocaleVal;
  },
  set value(v: Locale) {
    currentLocaleVal = v;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('jotter-lang', v);
    }
  }
};

export function useI18n() {
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = messages[currentLocaleVal];

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

  return {
    locale: localeObj,
    t,
  };
}
export type TranslateFn = ReturnType<typeof useI18n>['t'];
export type LocaleRef = ReturnType<typeof useI18n>['locale'];
export { messages };
