import { describe, it, expect, vi } from 'vitest';
import { crossTabBus } from '@/utils/broadcast';

describe('crossTabBus', () => {
  it('allows subscription and unsubscription without errors', () => {
    const listener = vi.fn();
    const unsubscribe = crossTabBus.subscribe(listener);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('broadcasts event safely when BroadcastChannel is supported or mockable', () => {
    expect(() => {
      crossTabBus.broadcast({ type: 'tasks-changed', projectId: 'default' });
      crossTabBus.broadcast({ type: 'buckets-changed', projectId: 'default' });
      crossTabBus.broadcast({ type: 'projects-changed' });
      crossTabBus.broadcast({ type: 'timeblocks-changed' });
    }).not.toThrow();
  });
});
