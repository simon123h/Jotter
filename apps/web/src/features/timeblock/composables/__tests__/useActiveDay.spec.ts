import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useActiveDay } from '../useActiveDay';

describe('useActiveDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0)); // 10 June 2026, local time
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on today', () => {
    const day = useActiveDay();
    expect(day.activeDateStr.value).toBe('2026-06-10');
    expect(day.todayStr.value).toBe('2026-06-10');
    expect(day.isToday.value).toBe(true);
  });

  it('moves forward and back, but never before today', () => {
    const day = useActiveDay();
    day.prevDay();
    expect(day.activeDateStr.value).toBe('2026-06-10');

    day.nextDay();
    day.nextDay();
    expect(day.activeDateStr.value).toBe('2026-06-12');
    expect(day.isToday.value).toBe(false);

    day.prevDay();
    expect(day.activeDateStr.value).toBe('2026-06-11');
    day.prevDay();
    expect(day.activeDateStr.value).toBe('2026-06-10');
  });

  it('resets to today', () => {
    const day = useActiveDay();
    day.nextDay();
    day.resetToToday();
    expect(day.isToday.value).toBe(true);
  });

  it('accepts a future date from the date input', () => {
    const day = useActiveDay();
    day.setDateFromInput('2026-07-01');
    expect(day.activeDateStr.value).toBe('2026-07-01');
  });

  it('clamps a past date from the date input to today', () => {
    const day = useActiveDay();
    day.nextDay();
    day.setDateFromInput('2026-01-01');
    expect(day.activeDateStr.value).toBe('2026-06-10');
  });

  it('ignores an empty date input', () => {
    const day = useActiveDay();
    day.nextDay();
    day.setDateFromInput('');
    expect(day.activeDateStr.value).toBe('2026-06-11');
  });
});
