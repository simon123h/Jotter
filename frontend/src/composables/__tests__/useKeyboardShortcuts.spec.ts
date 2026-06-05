import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';

describe('useKeyboardShortcuts composable', () => {
  it('registers keydown event listener and invokes callback on key match', () => {
    const callback = vi.fn();
    const TestComponent = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'q', callback }]);
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent);

    const event = new KeyboardEvent('keydown', { key: 'q' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('ignores shortcuts if ctrl, alt, or meta keys are pressed unless expected', () => {
    const callback = vi.fn();
    const TestComponent = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'q', callback }]);
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent);

    const event = new KeyboardEvent('keydown', { key: 'q', ctrlKey: true });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('respects required modifiers when specified', () => {
    const callback = vi.fn();
    const TestComponent = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 's', ctrlKey: true, callback }]);
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent);

    // Pressing 's' without ctrl should not trigger
    const event1 = new KeyboardEvent('keydown', { key: 's' });
    window.dispatchEvent(event1);
    expect(callback).not.toHaveBeenCalled();

    // Pressing 's' with ctrl should trigger
    const event2 = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    window.dispatchEvent(event2);
    expect(callback).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('ignores shortcuts when focused on input, textarea, select, or contenteditable elements', () => {
    const callback = vi.fn();
    const TestComponent = defineComponent({
      setup() {
        useKeyboardShortcuts([{ key: 'q', callback }]);
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent);

    // Create focusable elements
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'q' });
    window.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();

    // Clean up
    input.remove();
    wrapper.unmount();
  });
});
