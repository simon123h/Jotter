import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TriageSummary from '../TriageSummary.vue';
import TriageShortcutsPanel from '../TriageShortcutsPanel.vue';
import TriageBucketPicker from '../TriageBucketPicker.vue';
import { TRIAGE_SHORTCUT_GROUPS } from '../../constants/triageShortcuts';
import { createMockBucket } from '@/__tests__/factories';

describe('TriageSummary.vue', () => {
  const props = { isCongrats: true, editedCount: 4, completedCount: 2, deletedCount: 1 };

  it('shows the session stats when the queue is finished', () => {
    const text = mount(TriageSummary, { props }).text();
    expect(text).toContain('4');
    expect(text).toContain('2');
    expect(text).toContain('1');
  });

  it('hides the stats when there was nothing to triage', () => {
    const wrapper = mount(TriageSummary, { props: { ...props, isCongrats: false } });
    expect(wrapper.find('.grid-cols-3').exists()).toBe(false);
  });

  it('emits restart', async () => {
    const wrapper = mount(TriageSummary, { props });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('restart')).toHaveLength(1);
  });
});

describe('TriageShortcutsPanel.vue', () => {
  it('renders one row per shortcut, grouped', () => {
    const wrapper = mount(TriageShortcutsPanel);
    const total = TRIAGE_SHORTCUT_GROUPS.reduce((n, g) => n + g.items.length, 0);
    expect(wrapper.findAll('kbd')).toHaveLength(total);
    expect(wrapper.findAll('h4')).toHaveLength(TRIAGE_SHORTCUT_GROUPS.length);
  });

  it('emits close', async () => {
    const wrapper = mount(TriageShortcutsPanel);
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('TriageBucketPicker.vue', () => {
  const buckets = [createMockBucket({ name: 'backlog' }), createMockBucket({ name: 'todo' })];

  it('picks a bucket by click', async () => {
    const wrapper = mount(TriageBucketPicker, { props: { buckets } });
    await wrapper.findAll('.space-y-1\\.5 button')[1].trigger('click');
    expect(wrapper.emitted('pick')).toEqual([['todo']]);
  });

  it('picks by number key, ignoring numbers beyond the bucket list', () => {
    const wrapper = mount(TriageBucketPicker, { props: { buckets } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(wrapper.emitted('pick')).toEqual([['backlog']]);
    wrapper.unmount();
  });

  it('closes on Escape and stops listening once unmounted', () => {
    const wrapper = mount(TriageBucketPicker, { props: { buckets } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(wrapper.emitted('pick')).toBeUndefined();
  });
});
