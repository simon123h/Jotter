/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import { THEMES, DEFAULT_THEME } from '@jotter/themes';
import { capacitorKeyValue } from '@/data/keyValue';
import { useSettingsStore } from '@/stores/settings';

// Read as text: the bundler would turn the stylesheets into something else
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const themesCss = read('../../../packages/themes/themes.css');
const styleCss = read('./style.css');

const VARIABLES = ['bg-base', 'bg-card', 'border', 'accent', 'text-main', 'text-muted'];

/** The declarations of the rule with this selector in a stylesheet. */
const ruleOf = (css: string, selector: string) => new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('shared themes', () => {
  it('defines every listed theme with the variables the app uses', () => {
    for (const { id } of THEMES) {
      const rule = ruleOf(themesCss, id === DEFAULT_THEME ? ':root' : `.theme-${id}`);
      for (const name of VARIABLES) expect(rule, `${id} lacks --theme-${name}`).toContain(`--theme-${name}:`);
    }
  });

  it('defines no theme that is not listed', () => {
    const defined = [...themesCss.matchAll(/^\.theme-([a-z-]+)\s*\{/gm)].map((m) => m[1]);
    expect(defined.sort()).toEqual(THEMES.map((t) => t.id).sort());
  });

  it('tells the browser which themes are dark, as listed', () => {
    const darkBlock = /((?:\.theme-[a-z-]+,?\s*)+)\{[^}]*color-scheme:\s*dark/.exec(styleCss)?.[1] ?? '';
    const dark = [...darkBlock.matchAll(/\.theme-([a-z-]+)/g)].map((m) => m[1]);
    expect(dark.sort()).toEqual(
      THEMES.filter((t) => t.dark)
        .map((t) => t.id)
        .sort()
    );
  });

  it('reads the earlier light and dark choices as themes', async () => {
    setActivePinia(createPinia());
    await capacitorKeyValue.set('jotter_lite_settings', JSON.stringify({ theme: 'dark', language: 'en' }));
    const settings = useSettingsStore();
    await settings.restore();
    expect(settings.theme).toBe('midnight');
  });

  it('lets the system choice use the light and the dark theme picked, as the device switches', async () => {
    let dark = false;
    let notify: () => void = () => undefined;
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, listener: () => void) => (notify = listener),
    }));
    try {
      setActivePinia(createPinia());
      await capacitorKeyValue.set(
        'jotter_lite_settings',
        JSON.stringify({ theme: 'system', lightTheme: 'earth-light', darkTheme: 'forest' })
      );
      const settings = useSettingsStore();
      await settings.restore();
      const themeClasses = () => [...document.documentElement.classList].filter((c) => c.startsWith('theme-'));
      expect(themeClasses()).toEqual(['theme-earth-light']);

      dark = true;
      notify();
      expect(themeClasses()).toEqual(['theme-forest']);

      settings.darkTheme = 'sakura';
      await nextTick();
      expect(themeClasses()).toEqual(['theme-sakura']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores a saved light or dark theme of the wrong kind', async () => {
    setActivePinia(createPinia());
    await capacitorKeyValue.set(
      'jotter_lite_settings',
      JSON.stringify({ theme: 'system', lightTheme: 'forest', darkTheme: 'nordic-light' })
    );
    const settings = useSettingsStore();
    await settings.restore();
    expect([settings.lightTheme, settings.darkTheme]).toEqual(['nordic-light', 'midnight']);
  });
});
