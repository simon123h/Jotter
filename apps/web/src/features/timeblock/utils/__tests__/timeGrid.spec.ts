import { describe, it, expect } from 'vitest';
import { HOUR_HEIGHT, formatDateStr, timeToMinutes, minutesToTime, getTimeblockStyle, getNowIndicatorTop, isTaskDone } from '../timeGrid';
import type { Task, Timeblock } from '@/types';

const block = (overrides: Partial<Timeblock> = {}): Timeblock => ({
  id: 'tb',
  title: 'Block',
  date: '2026-01-01',
  start_time: '09:00',
  end_time: '10:00',
  task_ids: [],
  ...overrides,
});

describe('timeGrid', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(formatDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('converts between HH:MM and minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('')).toBe(0);
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('clamps minutesToTime to a valid day', () => {
    expect(minutesToTime(-30)).toBe('00:00');
    expect(minutesToTime(24 * 60 + 100)).toBe('23:59');
  });

  describe('getTimeblockStyle', () => {
    it('positions a block relative to the first visible hour', () => {
      const style = getTimeblockStyle(block({ start_time: '08:00', end_time: '09:30' }), 6, 18);
      expect(style.top).toBe(`${2 * HOUR_HEIGHT}px`);
      expect(style.height).toBe(`${1.5 * HOUR_HEIGHT}px`);
    });

    it('clips blocks to the visible range and enforces a minimum height', () => {
      const early = getTimeblockStyle(block({ start_time: '04:00', end_time: '07:00' }), 6, 18);
      expect(early.top).toBe('0px');
      expect(early.height).toBe(`${HOUR_HEIGHT}px`);

      const tiny = getTimeblockStyle(block({ start_time: '09:00', end_time: '09:05' }), 6, 18);
      expect(tiny.height).toBe(`${(20 / 60) * HOUR_HEIGHT}px`);
    });

    it('falls back to blue for unknown colors', () => {
      expect(getTimeblockStyle(block({ color: 'chartreuse' }), 6, 18)['--card-tint']).toBe('#3b82f6');
      expect(getTimeblockStyle(block({ color: 'red' }), 6, 18)['--card-tint']).toBe('#ef4444');
    });
  });

  describe('getNowIndicatorTop', () => {
    it('returns the pixel offset inside the visible hours', () => {
      expect(getNowIndicatorTop(new Date(2026, 0, 1, 8, 30), 6, 18)).toBe(2.5 * HOUR_HEIGHT);
    });

    it('returns null outside the visible hours', () => {
      expect(getNowIndicatorTop(new Date(2026, 0, 1, 5, 59), 6, 18)).toBeNull();
      expect(getNowIndicatorTop(new Date(2026, 0, 1, 19, 1), 6, 18)).toBeNull();
    });
  });

  it('treats done, archive and completed buckets as done', () => {
    const task = (bucket: string) => ({ bucket }) as Task;
    expect(isTaskDone(task('Done'))).toBe(true);
    expect(isTaskDone(task('archive'))).toBe(true);
    expect(isTaskDone(task('completed'))).toBe(true);
    expect(isTaskDone(task('todo'))).toBe(false);
  });
});
