import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DeadlineField from '../DeadlineField.vue';

describe('DeadlineField.vue', () => {
  it('offers "Add deadline" until the task has a deadline or one is asked for', async () => {
    const wrapper = mount(DeadlineField, { props: { modelValue: '' } });
    expect(wrapper.find('[data-testid="deadline-input"]').exists()).toBe(false);

    await wrapper.find('[data-testid="add-deadline"]').trigger('click');
    expect(wrapper.find('[data-testid="add-deadline"]').exists()).toBe(false);
    await wrapper.find('[data-testid="deadline-input"]').setValue('2030-05-01');
    expect(wrapper.emitted('update:modelValue')).toEqual([['2030-05-01']]);
  });

  it('shows the field of a task that has a deadline', () => {
    const wrapper = mount(DeadlineField, { props: { modelValue: '2030-05-01' } });
    expect((wrapper.find('[data-testid="deadline-input"]').element as HTMLInputElement).value).toBe('2030-05-01');
    expect(wrapper.find('[data-testid="add-deadline"]').exists()).toBe(false);
  });
});
