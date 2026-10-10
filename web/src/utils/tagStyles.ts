/** Chip classes for each selectable tag color. */
export const TAG_COLOR_CLASSES: Record<string, string> = {
  accent: 'bg-theme-accent/10 text-theme-accent border-theme-accent/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// Palette used for tags without a custom color, picked by a hash of the tag name
const AUTO_TAG_CLASSES = [
  TAG_COLOR_CLASSES.accent,
  TAG_COLOR_CLASSES.sky,
  TAG_COLOR_CLASSES.emerald,
  TAG_COLOR_CLASSES.indigo,
  TAG_COLOR_CLASSES.violet,
  TAG_COLOR_CLASSES.amber,
];

/**
 * Classes for a tag chip: the user's custom color when set, otherwise a stable color derived from the name.
 * @param customColors map of lower-cased tag name to color id (the `tagColors` setting)
 */
export function getTagClasses(tag: string, customColors?: Record<string, string> | null): string {
  const custom = customColors?.[tag.trim().toLowerCase()];
  if (custom && TAG_COLOR_CLASSES[custom]) {
    return TAG_COLOR_CLASSES[custom];
  }
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AUTO_TAG_CLASSES[hash % AUTO_TAG_CLASSES.length];
}
