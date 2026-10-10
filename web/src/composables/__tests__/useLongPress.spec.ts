import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPress } from '../useLongPress';

const touch = (x: number, y: number, count = 1) =>
  ({
    touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as TouchEvent;

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay and flags the press', () => {
    const cb = vi.fn();
    const lp = useLongPress(cb);
    lp.onTouchStart(touch(10, 10));
    vi.advanceTimersByTime(449);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(lp.isLongPressTriggered.value).toBe(true);
  });

  it('cancels when the finger moves more than 10px, but not for small jitter', () => {
    const cb = vi.fn();
    const lp = useLongPress(cb);
    lp.onTouchStart(touch(0, 0));
    lp.onTouchMove(touch(5, 5));
    vi.advanceTimersByTime(450);
    expect(cb).toHaveBeenCalledTimes(1);

    const cb2 = vi.fn();
    const lp2 = useLongPress(cb2);
    lp2.onTouchStart(touch(0, 0));
    lp2.onTouchMove(touch(0, 11));
    vi.advanceTimersByTime(450);
    expect(cb2).not.toHaveBeenCalled();
  });

  it('ignores multi-touch', () => {
    const cb = vi.fn();
    useLongPress(cb).onTouchStart(touch(0, 0, 2));
    vi.advanceTimersByTime(450);
    expect(cb).not.toHaveBeenCalled();
  });

  it('swallows the click after a long press, then re-arms', () => {
    const lp = useLongPress(vi.fn());
    lp.onTouchStart(touch(0, 0));
    vi.advanceTimersByTime(450);

    const end = touch(0, 0);
    lp.onTouchEnd(end);
    expect(end.preventDefault).toHaveBeenCalled();
    expect(lp.isLongPressTriggered.value).toBe(true);
    vi.advanceTimersByTime(150);
    expect(lp.isLongPressTriggered.value).toBe(false);
  });

  it('touch cancel clears the timer and the flag', () => {
    const cb = vi.fn();
    const lp = useLongPress(cb);
    lp.onTouchStart(touch(0, 0));
    lp.onTouchCancel();
    vi.advanceTimersByTime(450);
    expect(cb).not.toHaveBeenCalled();
    expect(lp.isLongPressTriggered.value).toBe(false);
  });
});
