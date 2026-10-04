import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BulkDatePicker from '../BulkDatePicker.vue';
import type { DatePreset } from '../types';

const presets: DatePreset[] = [
  { id: 'today', label: 'Today', offsetDays: 0 },
  { id: 'nextWeek', label: 'Next Week', offsetDays: 7 },
  { id: 'clear', label: 'Clear', offsetDays: null, wide: true },
];

describe('BulkDatePicker.vue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the title and one button per preset', () => {
    const wrapper = mount(BulkDatePicker, { props: { title: 'Pick a date', presets } });
    expect(wrapper.text()).toContain('Pick a date');
    expect(wrapper.findAll('.grid button')).toHaveLength(3);
    expect(wrapper.find('.col-span-2').text()).toBe('Clear');
  });

  it('emits dates offset from today in local YYYY-MM-DD form', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 28, 12, 0, 0)); // 28 Jan 2026, local time
    const wrapper = mount(BulkDatePicker, { props: { title: 'Due', presets } });
    const buttons = wrapper.findAll('.grid button');

    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('select')).toEqual([['2026-01-28'], ['2026-02-04']]);
  });

  it('emits an empty string for a clearing preset', async () => {
    const wrapper = mount(BulkDatePicker, { props: { title: 'Due', presets } });
    await wrapper.findAll('.grid button')[2].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['']]);
  });

  it('emits the custom date when confirmed', async () => {
    const wrapper = mount(BulkDatePicker, { props: { title: 'Due', presets } });
    await wrapper.find('input[type="date"]').setValue('2026-03-15');
    await wrapper.find('div.space-y-1\\.5 button').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['2026-03-15']]);
  });
});
