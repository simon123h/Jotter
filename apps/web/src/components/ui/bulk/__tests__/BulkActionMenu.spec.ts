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
});
