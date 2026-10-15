import { describe, it, expect } from 'vitest';
import { compareTitles, withoutEmoji } from '@jotter/task-filter';

describe('compareTitles', () => {
  const sorted = (titles: string[]) => [...titles].sort(compareTitles);

  it('sorts by the name, not by a leading emoji or symbol', () => {
    expect(sorted(['🎯 Work', 'Garden', '📚 Reading', '(Misc) Zed', 'Home'])).toEqual([
      'Garden',
      'Home',
      '(Misc) Zed',
      '📚 Reading',
      '🎯 Work',
    ]);
  });

  it('ignores case and accents, and keeps a stable order for equal names', () => {
    expect(sorted(['béta', 'Alpha', 'beta'])).toEqual(['Alpha', 'beta', 'béta']);
    expect(sorted(['🏠 Home', 'Home'])).toEqual(sorted(['Home', '🏠 Home']));
  });

  it('does not drop a title made only of symbols', () => {
    expect(sorted(['Zed', '🎯'])).toEqual(['🎯', 'Zed']);
  });
});

describe('withoutEmoji', () => {
  it('drops emojis, also joined and flag ones, and the gap they leave', () => {
    expect(withoutEmoji('🎯 Work')).toBe('Work');
    expect(withoutEmoji('Home 🏠')).toBe('Home');
    expect(withoutEmoji('👨‍👩‍👧 Family 🇩🇪 trips')).toBe('Family trips');
  });

  it('keeps digits, letters and punctuation', () => {
    expect(withoutEmoji('2026 (plan) #1')).toBe('2026 (plan) #1');
  });
});
