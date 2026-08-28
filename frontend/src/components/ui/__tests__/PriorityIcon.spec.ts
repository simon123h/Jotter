import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PriorityIcon from '@/components/ui/PriorityIcon.vue';

describe('PriorityIcon.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders urgent priority with flame icon and title', () => {
    const wrapper = mount(PriorityIcon, {
      props: { priority: 'urgent' },
    });
    expect(wrapper.attributes('title')).toContain('Urgent');
    expect(wrapper.classes()).toContain('text-red-400');
  });

  it('renders high priority with chevron-up icon', () => {
    const wrapper = mount(PriorityIcon, {
      props: { priority: 'high' },
    });
    expect(wrapper.attributes('title')).toContain('High');
    expect(wrapper.classes()).toContain('text-orange-400');
  });

  it('renders medium priority with equal icon', () => {
    const wrapper = mount(PriorityIcon, {
      props: { priority: 'medium' },
    });
    expect(wrapper.attributes('title')).toContain('Medium');
    expect(wrapper.classes()).toContain('text-yellow-400');
  });

  it('renders low priority with chevron-down icon', () => {
    const wrapper = mount(PriorityIcon, {
      props: { priority: 'low' },
    });
    expect(wrapper.attributes('title')).toContain('Low');
    expect(wrapper.classes()).toContain('text-blue-400');
  });

  it('renders nothing when priority is none or null', () => {
    const wrapper = mount(PriorityIcon, {
      props: { priority: 'none' },
    });
    expect(wrapper.find('span').exists()).toBe(false);
  });

  it('renders label when showLabel is true', () => {
    const wrapper = mount(PriorityIcon, {
      props: { priority: 'high', showLabel: true },
    });
    expect(wrapper.text()).toContain('High');
  });
});
