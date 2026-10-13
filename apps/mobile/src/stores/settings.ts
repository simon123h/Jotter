import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { StatusBar, Style } from '@capacitor/status-bar';
import { THEMES, DEFAULT_THEME, type ThemeId } from '@jotter/themes';
import { capacitorKeyValue as preferences } from '@/data/keyValue';
import { locale, systemLocale } from '@/i18n';

/** One of the themes of the desktop app, or the one that matches the system's light or dark setting. */
export type ThemeChoice = 'system' | ThemeId;
export type LanguageChoice = 'system' | 'en' | 'de';

const DEFAULT_LIGHT: ThemeId = DEFAULT_THEME;
const DEFAULT_DARK: ThemeId = 'midnight';

const KEY = 'jotter_lite_settings';

interface Stored {
  theme: ThemeChoice;
  /** The themes "System" picks while the device is light or dark. */
  lightTheme: ThemeId;
  darkTheme: ThemeId;
  language: LanguageChoice;
}

/** Settings saved by earlier versions chose between light and dark. */
const LEGACY: Record<string, ThemeChoice> = { light: 'nordic-light', dark: 'midnight' };
const isTheme = (v: unknown): v is ThemeChoice => v === 'system' || THEMES.some((theme) => theme.id === v);
const toTheme = (v: unknown): ThemeChoice => (isTheme(v) ? v : (LEGACY[v as string] ?? 'system'));
const isThemeId = (v: unknown, dark: boolean): v is ThemeId => THEMES.some((theme) => theme.id === v && theme.dark === dark);
const isLanguage = (v: unknown): v is LanguageChoice => v === 'system' || v === 'en' || v === 'de';

/** Reads the saved settings from the device's preferences (not web storage, which Android may clear). */
async function load(): Promise<Stored> {
  try {
    const parsed = JSON.parse((await preferences.get(KEY)) ?? '{}');
    return {
      theme: toTheme(parsed.theme),
      lightTheme: isThemeId(parsed.lightTheme, false) ? parsed.lightTheme : DEFAULT_LIGHT,
      darkTheme: isThemeId(parsed.darkTheme, true) ? parsed.darkTheme : DEFAULT_DARK,
      language: isLanguage(parsed.language) ? parsed.language : 'system',
    };
  } catch {
    return { theme: 'system', lightTheme: DEFAULT_LIGHT, darkTheme: DEFAULT_DARK, language: 'system' };
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
  const theme = ref<ThemeChoice>('system');
  const lightTheme = ref<ThemeId>(DEFAULT_LIGHT);
  const darkTheme = ref<ThemeId>(DEFAULT_DARK);
  const language = ref<LanguageChoice>('system');
  /** The saved settings have been read. Until then nothing is written, or the defaults would replace them. */
  let loaded = false;

  /** Applies the saved settings. Call it once at start, before the first screen is shown. */
  async function restore() {
    const saved = await load();
    theme.value = saved.theme;
    lightTheme.value = saved.lightTheme;
    darkTheme.value = saved.darkTheme;
    language.value = saved.language;
    loaded = true;
    apply();
  }

  const prefersDark = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  function apply() {
    const root = document.documentElement;
    const id: ThemeId = theme.value === 'system' ? (prefersDark() ? darkTheme.value : lightTheme.value) : theme.value;
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
    [theme, lightTheme, darkTheme, language],
    () => {
      apply();
      // Not persisted when the preferences cannot be written; the choice lasts until the app is closed
      if (loaded)
        void preferences
          .set(
            KEY,
            JSON.stringify({ theme: theme.value, lightTheme: lightTheme.value, darkTheme: darkTheme.value, language: language.value })
          )
          .catch(() => undefined);
    },
    { immediate: true }
  );

  return { theme, lightTheme, darkTheme, language, restore };
});
