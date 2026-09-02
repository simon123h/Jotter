import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { usePomodoroStore } from '../pomodoro';

vi.mock('@/utils/sound', () => ({
  playPomodoroChime: vi.fn(),
}));

describe('usePomodoroStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    localStorage.clear();
  });

  it('initializes with default values', () => {
    const store = usePomodoroStore();
    expect(store.phase).toBe('work');
    expect(store.status).toBe('idle');
    expect(store.work_duration).toBe(25);
    expect(store.short_break_duration).toBe(5);
    expect(store.long_break_duration).toBe(15);
    expect(store.time_remaining).toBe(25 * 60);
    expect(store.formatted_time).toBe('25:00');
    expect(store.progress_percent).toBe(0);
    expect(store.is_bar_open).toBe(false);
  });

  it('starts, ticks, and pauses the timer', () => {
    const store = usePomodoroStore();

    store.start();
    expect(store.status).toBe('running');

    vi.advanceTimersByTime(3000); // 3 seconds
    expect(store.time_remaining).toBe(25 * 60 - 3);
    expect(store.formatted_time).toBe('24:57');

    store.pause();
    expect(store.status).toBe('paused');

    vi.advanceTimersByTime(3000);
    // Should remain unchanged while paused
    expect(store.time_remaining).toBe(25 * 60 - 3);
  });

  it('resets timer back to initial duration', () => {
    const store = usePomodoroStore();
    store.start();
    vi.advanceTimersByTime(10000); // 10 seconds

    store.reset();
    expect(store.status).toBe('idle');
    expect(store.time_remaining).toBe(25 * 60);
    expect(store.formatted_time).toBe('25:00');
  });

  it('transitions from work to short_break when timer completes', () => {
    const store = usePomodoroStore();
    store.start();

    // Fast-forward to the end of work duration (25 mins)
    vi.advanceTimersByTime(25 * 60 * 1000);

    expect(store.phase).toBe('short_break');
    expect(store.completed_cycles).toBe(1);
    expect(store.time_remaining).toBe(5 * 60);
    expect(store.status).toBe('idle');
  });

  it('triggers long_break after configured cycle interval', () => {
    const store = usePomodoroStore();
    store.long_break_interval = 2; // Test with 2 cycles

    // Cycle 1
    store.skip(); // Work -> short_break
    expect(store.phase).toBe('short_break');
    expect(store.completed_cycles).toBe(1);

    // Cycle 1 Break -> Work
    store.skip();
    expect(store.phase).toBe('work');

    // Cycle 2
    store.skip(); // Work -> long_break
    expect(store.phase).toBe('long_break');
    expect(store.completed_cycles).toBe(2);
    expect(store.time_remaining).toBe(15 * 60);
  });

  it('updates durations and saves them', () => {
    const store = usePomodoroStore();
    store.setDurations({
      work: 30,
      short_break: 8,
      long_break: 20,
    });

    expect(store.work_duration).toBe(30);
    expect(store.short_break_duration).toBe(8);
    expect(store.long_break_duration).toBe(20);
    expect(store.time_remaining).toBe(30 * 60);
    expect(store.formatted_time).toBe('30:00');
  });

  it('persists is_bar_open state across store restarts', () => {
    const store1 = usePomodoroStore();
    expect(store1.is_bar_open).toBe(false);

    store1.openBar();
    expect(store1.is_bar_open).toBe(true);

    // Simulate PWA restart by resetting Pinia
    setActivePinia(createPinia());
    const store2 = usePomodoroStore();
    expect(store2.is_bar_open).toBe(true);
  });

  it('resumes running timer across PWA restart using target_end_timestamp', () => {
    const store1 = usePomodoroStore();
    store1.start();
    expect(store1.status).toBe('running');

    // Advance 60 seconds
    vi.advanceTimersByTime(60 * 1000);

    // Simulate PWA restart by resetting Pinia
    setActivePinia(createPinia());
    const store2 = usePomodoroStore();
    expect(store2.status).toBe('running');
    expect(store2.time_remaining).toBe(24 * 60);
  });

  it('persists all settings to localStorage across store restarts', () => {
    const store1 = usePomodoroStore();
    store1.setDurations({
      work: 45,
      short_break: 10,
      long_break: 25,
      long_break_interval: 6,
      sound_enabled: false,
    });

    // Simulate PWA restart by resetting Pinia
    setActivePinia(createPinia());
    const store2 = usePomodoroStore();
    expect(store2.work_duration).toBe(45);
    expect(store2.short_break_duration).toBe(10);
    expect(store2.long_break_duration).toBe(25);
    expect(store2.long_break_interval).toBe(6);
    expect(store2.sound_enabled).toBe(false);
  });
});
