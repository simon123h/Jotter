/** The colour themes defined in themes.css. */
export const THEMES = [
  { id: 'nordic-light', dark: false },
  { id: 'desert-light', dark: false },
  { id: 'earth-light', dark: false },
  { id: 'frost', dark: true },
  { id: 'cyberpunk', dark: true },
  { id: 'midnight', dark: true },
  { id: 'forest', dark: true },
  { id: 'sakura', dark: true },
  { id: 'true-black', dark: true },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

/** The theme with no class on <html>: it is defined on :root. */
export const DEFAULT_THEME: ThemeId = 'nordic-light';
