/** Hex values behind the named task and timeblock colors. */
export const TASK_COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
};

/** Hex for a named color, or undefined when the name is unknown or unset. */
export const getTaskColorHex = (color?: string | null): string | undefined => (color ? TASK_COLOR_HEX[color] : undefined);

/** Inline style tinting a card with the given color; empty when there is nothing to tint. */
export const getTaskCardTintStyle = (color?: string | null): Record<string, string> => {
  const hex = getTaskColorHex(color);
  if (!hex) return {};
  return {
    '--card-tint': hex,
    'background-color': `color-mix(in srgb, ${hex} 20%, var(--theme-bg-card))`,
    'border-color': `color-mix(in srgb, ${hex} 40%, var(--theme-border))`,
  };
};
