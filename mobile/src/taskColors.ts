/** The task colours the desktop app offers. Files store the name (`color: blue`); the hex is only for drawing. */
export const TASK_COLORS = [
  { id: 'red', hex: '#ef4444' },
  { id: 'orange', hex: '#f97316' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'green', hex: '#22c55e' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'purple', hex: '#a855f7' },
  { id: 'pink', hex: '#ec4899' },
] as const;

const BY_NAME: Record<string, string> = Object.fromEntries(TASK_COLORS.map((c) => [c.id, c.hex]));

/** The colour to draw for a stored value: a palette name, or a value written by another tool as `#rrggbb`. */
export function colorHex(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (BY_NAME[value]) return BY_NAME[value];
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined;
}

/** Inline style that tints a card with its colour, as the desktop cards are tinted. */
export function cardTint(value: string | null | undefined): Record<string, string> {
  const hex = colorHex(value);
  if (!hex) return {};
  return {
    'background-color': `color-mix(in srgb, ${hex} 20%, var(--color-card))`,
    'border-color': `color-mix(in srgb, ${hex} 40%, var(--color-line))`,
  };
}
