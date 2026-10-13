import { describe, it, expect, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import GenericColumn from '../GenericColumn.vue';

describe('GenericColumn.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const column = (layout: 'list' | 'grid-2' | 'grid-3') =>
    mount(GenericColumn, { props: { id: 'todo', title: 'To Do', tasks: [], layout }, global: { stubs: { RouterLink: RouterLinkStub } } });

  it('is as wide as the screen below md in every layout, since the cards then sit in one css column', () => {
    for (const layout of ['list', 'grid-2', 'grid-3'] as const) {
      const classes = column(layout).classes();
      expect(classes, layout).toContain('w-[100vw]');
      expect(classes, layout).toContain('max-w-[100vw]');
      // none of the fixed widths of the grids applies without the md: prefix
      expect(
        classes.filter((c) => /^(min-)?w-\[(5|6|8|9)\d\dpx\]$/.test(c)),
        layout
      ).toEqual([]);
    }
  });

  it('is wide enough for its columns of cards from md up', () => {
    expect(column('list').classes()).toContain('md:w-80');
    expect(column('grid-2').classes()).toContain('md:w-[640px]');
    expect(column('grid-3').classes()).toContain('md:w-[960px]');
  });
});
