import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { StatusBar, Style } from '@capacitor/status-bar';
import { THEMES, DEFAULT_THEME, type ThemeId } from '@jotter/themes';
import { locale, systemLocale } from '@/i18n';

/** One of the themes of the desktop app, or the one that matches the system's light or dark setting. */
export type ThemeChoice = 'system' | ThemeId;
export type LanguageChoice = 'system' | 'en' | 'de';

const KEY = 'jotter_lite_settings';

interface Stored {
  theme: ThemeChoice;
  language: LanguageChoice;
}

/** Settings saved by earlier versions chose between light and dark. */
const LEGACY: Record<string, ThemeChoice> = { light: 'nordic-light', dark: 'midnight' };
const isTheme = (v: unknown): v is ThemeChoice => v === 'system' || THEMES.some((theme) => theme.id === v);
const toTheme = (v: unknown): ThemeChoice => (isTheme(v) ? v : (LEGACY[v as string] ?? 'system'));
const isLanguage = (v: unknown): v is LanguageChoice => v === 'system' || v === 'en' || v === 'de';

function load(): Stored {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { theme: toTheme(parsed.theme), language: isLanguage(parsed.language) ? parsed.language : 'system' };
  } catch {
    return { theme: 'system', language: 'system' };
  }
}

/** Colours the system bar to match the page, where there is one (Android). */
async function styleStatusBar(dark: boolean, color: string) {
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (color) await StatusBar.setBackgroundColor({ color });
  } catch {
    // Browser or a platform without a status bar
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load();
  const theme = ref<ThemeChoice>(initial.theme);
  const language = ref<LanguageChoice>(initial.language);

  const prefersDark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  function apply() {
    const root = document.documentElement;
    const id: ThemeId = theme.value === 'system' ? (prefersDark() ? 'midnight' : DEFAULT_THEME) : theme.value;
    [...root.classList].filter((name) => name.startsWith('theme-')).forEach((name) => root.classList.remove(name));
    if (id !== DEFAULT_THEME) root.classList.add(`theme-${id}`);
    locale.value = language.value === 'system' ? systemLocale() : language.value;
    // The system bar takes the colours of the page
    const dark = THEMES.find((entry) => entry.id === id)?.dark ?? false;
    void styleStatusBar(dark, getComputedStyle(root).getPropertyValue('--theme-bg-base').trim());
  }

  // "System" follows the device while the app is open
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => theme.value === 'system' && apply());

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
