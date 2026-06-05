import { render } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import KeyboardShortcutTestHelper from './KeyboardShortcutTestHelper.svelte';

describe('useKeyboardShortcuts composable', () => {
  it('registers keydown event listener and invokes callback on key match', () => {
    const callback = vi.fn();
    const { unmount } = render(KeyboardShortcutTestHelper, {
      props: { shortcuts: [{ key: 'q', callback }] }
    });

    const event = new KeyboardEvent('keydown', { key: 'q' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();

    unmount();
  });

  it('ignores shortcuts if ctrl, alt, or meta keys are pressed unless expected', () => {
    const callback = vi.fn();
    const { unmount } = render(KeyboardShortcutTestHelper, {
      props: { shortcuts: [{ key: 'q', callback }] }
    });

    const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();

    unmount();
  });

  it('respects required modifiers when specified', () => {
    const callback = vi.fn();
    const { unmount } = render(KeyboardShortcutTestHelper, {
      props: { shortcuts: [{ key: 's', ctrlKey: true, callback }] }
    });

    // Pressing 's' without ctrl should not trigger
    const event1 = new KeyboardEvent('keydown', { key: 's' });
    window.dispatchEvent(event1);
    expect(callback).not.toHaveBeenCalled();

    // Pressing 's' with ctrl should trigger
    const event2 = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    window.dispatchEvent(event2);
    expect(callback).toHaveBeenCalled();

    unmount();
  });

  it('ignores shortcuts when focused on input, textarea, select, or contenteditable elements', () => {
    const callback = vi.fn();
    const { unmount } = render(KeyboardShortcutTestHelper, {
      props: { shortcuts: [{ key: 'q', callback }] }
    });

    // Create focusable elements
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'q' });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();

    // Clean up
    input.remove();
    unmount();
  });
});
