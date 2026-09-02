import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerDoneParticleBurst } from '../effects';

describe('effects.ts - triggerDoneParticleBurst', () => {
  beforeEach(() => {
    // Mock Element.prototype.animate if not present in jsdom
    if (!Element.prototype.animate) {
      Element.prototype.animate = vi.fn().mockReturnValue({
        finished: Promise.resolve(),
        cancel: vi.fn(),
      });
    }
  });

  it('creates particle container and cleans up after timeout', () => {
    vi.useFakeTimers();

    triggerDoneParticleBurst(100, 200);

    // Should create particles in DOM
    const containers = document.querySelectorAll('div[style*="position: fixed"]');
    expect(containers.length).toBeGreaterThan(0);

    vi.advanceTimersByTime(900);

    // After timeout, container should be removed
    const remainingContainers = document.querySelectorAll('div[style*="position: fixed"]');
    expect(remainingContainers.length).toBe(0);

    vi.useRealTimers();
  });
});
