import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BulkMoreSheet from '../BulkMoreSheet.vue';

describe('BulkMoreSheet.vue', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mountSheet = (open: boolean) => mount(BulkMoreSheet, { props: { open }, attachTo: document.body });
  const sheetButtons = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.grid button'));
  const findByText = (text: string) => sheetButtons().find((b) => b.textContent?.includes(text));

  it('renders nothing while closed', () => {
    mountSheet(false);
    expect(document.body.querySelector('.grid')).toBeNull();
  });

  it('lists all nine actions when open', () => {
    mountSheet(true);
    expect(sheetButtons()).toHaveLength(9);
  });

  it('emits menu for menu-backed actions', async () => {
    const wrapper = mountSheet(true);
    findByText('Priority')?.click();
    findByText('Postpone')?.click();
    expect(wrapper.emitted('menu')).toEqual([['priority'], ['postponedDate']]);
  });

  it('emits plain events for archive, consolidate and select-all', async () => {
    const wrapper = mountSheet(true);
    findByText('Archive')?.click();
    findByText('Consolidate')?.click();
    findByText('Select All')?.click();
    expect(wrapper.emitted('archive')).toHaveLength(1);
    expect(wrapper.emitted('consolidate')).toHaveLength(1);
    expect(wrapper.emitted('select-all')).toHaveLength(1);
  });

  it('emits close when the backdrop is clicked', async () => {
    const wrapper = mountSheet(true);
    document.body.querySelector<HTMLElement>('.fixed.inset-0')?.click();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
