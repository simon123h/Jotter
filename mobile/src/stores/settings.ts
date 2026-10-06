import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { StatusBar, Style } from '@capacitor/status-bar';
import { locale, systemLocale } from '@/i18n';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type LanguageChoice = 'system' | 'en' | 'de';

const KEY = 'jotter_lite_settings';

interface Stored {
  theme: ThemeChoice;
  language: LanguageChoice;
}

const isTheme = (v: unknown): v is ThemeChoice => v === 'system' || v === 'light' || v === 'dark';
const isLanguage = (v: unknown): v is LanguageChoice => v === 'system' || v === 'en' || v === 'de';

function load(): Stored {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { theme: isTheme(parsed.theme) ? parsed.theme : 'system', language: isLanguage(parsed.language) ? parsed.language : 'system' };
  } catch {
    return { theme: 'system', language: 'system' };
  }
}

/** Colours the system bar to match the page, where there is one (Android). */
async function styleStatusBar(dark: boolean) {
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? '#131416' : '#f7f7f5' });
  } catch {
    // Browser or a platform without a status bar
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load();
  const theme = ref<ThemeChoice>(initial.theme);
  const language = ref<LanguageChoice>(initial.language);

  function apply() {
    const root = document.documentElement;
    if (theme.value === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme.value);
    locale.value = language.value === 'system' ? systemLocale() : language.value;
    const dark = theme.value === 'dark' || (theme.value === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    void styleStatusBar(dark);
  }

  watch(
    [theme, language],
    () => {
      apply();
      try {
        localStorage.setItem(KEY, JSON.stringify({ theme: theme.value, language: language.value }));
      } catch {
        // Not persisted; the choice lasts until the app is closed
      }
    },
    { immediate: true }
  );

  return { theme, language };
});
