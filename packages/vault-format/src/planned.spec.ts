/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { canonicalPlanned, weekOf, plannedStart, plannedSpan, plannedSlot } from '@jotter/task-filter';

describe('weeks', () => {
  it('knows the ISO week of a day', () => {
    expect(weekOf('2026-10-14')).toBe('2026-W42');
    expect(weekOf('2027-01-01')).toBe('2026-W53');
    expect(weekOf('2024-12-30')).toBe('2025-W01');
  });

  it('starts a week on its Monday and a month on its first day', () => {
    expect(plannedStart('2026-W43')).toBe('2026-10-19');
    expect(plannedStart('2026-10')).toBe('2026-10-01');
    expect(plannedStart('2026-10-21')).toBe('2026-10-21');
    expect(plannedStart('2027-W53')).toBeNull();
  });
});

describe('what is no planned value', () => {
  it('is read the same as the Python reader does', () => {
    for (const value of ['2026-13', '0999-12-31', '0000-W01', '0999-01']) {
      expect(plannedStart(value), value).toBeNull();
      expect(canonicalPlanned(value), value).toBeNull();
    }
  });

  it('trims the value, as the Python reader does', () => {
    expect(canonicalPlanned(' 2026-10\n')).toBe('2026-10');
    expect(canonicalPlanned('2026-w43\n')).toBe('2026-W43');
  });
});

describe('the ends of the calendar and of the month', () => {
  it('stops a span at the last day of year 9999', () => {
    expect(plannedSpan('9999-W52')).toEqual(['9999-12-27', '9999-12-31']);
    expect(plannedSpan('9999-12')).toEqual(['9999-12-01', '9999-12-31']);
  });

  it('files a month under Month in its last days', () => {
    const now = new Date(2026, 9, 29); // Thursday 29 October: the week goes on to Sunday 1 November
    expect(plannedSlot('2026-10', now)).toBe('month');
  });

  it('files next week under Next week, also when it reaches into the next month', () => {
    const now = new Date(2026, 9, 29); // Thursday 29 October: next week is 2026-W45, 2 to 8 November
    expect(plannedSlot('2026-W45', now)).toBe('nextWeek');
    expect(plannedSlot('2026-11-05', now)).toBe('nextWeek');
    expect(plannedSlot('2026-W46', now)).toBe('later');
    expect(plannedSlot('2026-11', now)).toBe('later');
  });

  it('knows no planning keyword', () => {
    for (const word of ['today', 'thisWeek', 'someday']) {
      expect(canonicalPlanned(word), word).toBeNull();
      expect(plannedSpan(word), word).toBeNull();
    }
  });
});
