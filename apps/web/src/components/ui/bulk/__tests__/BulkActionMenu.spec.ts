import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import BulkActionMenu from '../BulkActionMenu.vue';

describe('BulkActionMenu.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountMenu = (menu: 'tag' | 'priority') =>
    mount(BulkActionMenu, { props: { menu, buckets: [], projects: [], commonTags: ['a', 'b'] } });

  it('does not scroll the tag menu, so that the suggestions of its input are not clipped', () => {
    expect(mountMenu('tag').classes()).not.toContain('overflow-y-auto');
  });

  it('keeps the other menus within the screen by scrolling them', () => {
    expect(mountMenu('priority').classes()).toContain('overflow-y-auto');
  });

  it('picks the entry in that position with a number key', () => {
    const wrapper = mountMenu('priority');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
    expect(wrapper.emitted('set-priority')).toEqual([['urgent']]);
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('ignores number keys in the tag menu, whose input takes them as text', () => {
    const wrapper = mountMenu('tag');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(wrapper.emitted('edit-tag')).toBeUndefined();
    wrapper.unmount();
  });

  it('does not pick an entry while a dialog is open', () => {
    const wrapper = mountMenu('priority');
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
    expect(wrapper.emitted('set-priority')).toBeUndefined();
    dialog.remove();
    wrapper.unmount();
  });

  it('counts the entries of a date menu, not its apply button', () => {
    const wrapper = mount(BulkActionMenu, {
      props: { menu: 'dueDate', buckets: [], projects: [], commonTags: [] },
      attachTo: document.body,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(wrapper.emitted('set-due-date')).toHaveLength(1); // Today, the first preset
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '9' }));
    expect(wrapper.emitted('set-due-date')).toHaveLength(1); // there is no ninth entry
    wrapper.unmount();
  });
});
