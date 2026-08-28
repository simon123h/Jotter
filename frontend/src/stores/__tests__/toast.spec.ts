import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useToastStore } from '../toast';

describe('useToastStore', () => {
  beforeAll(() => {
    setActivePinia(createPinia());
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it('adds error toast and auto-dismisses after duration', () => {
    const store = useToastStore();
    const id = store.error('Something went wrong', 'Error Title', 3000);

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].id).toBe(id);
    expect(store.toasts[0].type).toBe('error');
    expect(store.toasts[0].message).toBe('Something went wrong');
    expect(store.toasts[0].title).toBe('Error Title');

    vi.advanceTimersByTime(3000);
    expect(store.toasts).toHaveLength(0);
  });

  it('deduplicates identical active toasts and resets timer', () => {
    const store = useToastStore();
    const id1 = store.error('Network failure', undefined, 3000);
    expect(store.toasts).toHaveLength(1);

    vi.advanceTimersByTime(2000); // 1s left on timer

    const id2 = store.error('Network failure', undefined, 3000);
    expect(store.toasts).toHaveLength(1);
    expect(id2).toBe(id1);

    vi.advanceTimersByTime(2000); // would have expired on old timer, but timer was refreshed
    expect(store.toasts).toHaveLength(1);

    vi.advanceTimersByTime(1000); // expires now
    expect(store.toasts).toHaveLength(0);
  });

  it('adds success toast and supports manual remove', () => {
    const store = useToastStore();
    const id = store.success('Task created successfully');

    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].type).toBe('success');

    store.removeToast(id);
    expect(store.toasts).toHaveLength(0);
  });

  it('clears all toasts', () => {
    const store = useToastStore();
    store.info('Info 1');
    store.warning('Warning 1');
    expect(store.toasts).toHaveLength(2);

    store.clear();
    expect(store.toasts).toHaveLength(0);
  });
});
