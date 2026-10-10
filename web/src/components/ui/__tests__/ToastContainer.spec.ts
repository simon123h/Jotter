import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ToastContainer from '../ToastContainer.vue';
import { useToastStore } from '@/stores/toast';

describe('ToastContainer.vue', () => {
  beforeAll(() => {
    setActivePinia(createPinia());
  });

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders active toasts with icon, title, and message', async () => {
    const toastStore = useToastStore();
    toastStore.error('Server offline error', 'Connection Error');

    const wrapper = mount(ToastContainer);

    expect(wrapper.text()).toContain('Connection Error');
    expect(wrapper.text()).toContain('Server offline error');
  });

  it('allows dismissing toast via close button', async () => {
    const toastStore = useToastStore();
    toastStore.success('Operation completed');

    const wrapper = mount(ToastContainer);
    expect(wrapper.text()).toContain('Operation completed');

    const closeBtn = wrapper.find('button[aria-label="Dismiss notification"]');
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger('click');

    expect(toastStore.toasts).toHaveLength(0);
  });
});
