import { describe, it, expect } from 'vitest';
import { getTagClasses, TAG_COLOR_CLASSES } from '../tagStyles';

describe('getTagClasses', () => {
  it('uses the custom color for a tag, matching case-insensitively', () => {
    expect(getTagClasses(' Work ', { work: 'rose' })).toBe(TAG_COLOR_CLASSES.rose);
  });

  it('falls back to a stable hashed color for unknown tags or unknown color ids', () => {
    const auto = getTagClasses('home');
    expect(getTagClasses('home')).toBe(auto);
    expect(getTagClasses('home', { home: 'not-a-color' })).toBe(auto);
    expect(getTagClasses('home', null)).toBe(auto);
    expect(Object.values(TAG_COLOR_CLASSES)).toContain(auto);
  });
});
