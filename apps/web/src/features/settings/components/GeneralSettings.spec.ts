import { useDialog } from '@/composables/useDialog';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const platform = vi.hoisted(() => ({ isDemoMode: true }));
vi.mock('@/platform', () => ({
  get isDemoMode() {
    return platform.isDemoMode;
  },
  appVersion: 'test',
}));
const resetDemo = vi.hoisted(() => vi.fn());
vi.mock('@/storage/demoAdapter', () => ({ resetDemo }));

import GeneralSettings from './GeneralSettings.vue';

describe('GeneralSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetDemo.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('offers to reset the demo, after a confirmation', async () => {
    const wrapper = mount(GeneralSettings);

    await wrapper.find('[data-testid="demo-reset"]').trigger('click');
    useDialog().handleCancel();
    await flushPromises();
    expect(resetDemo).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="demo-reset"]').trigger('click');
    expect(useDialog().isOpen.value).toBe(true);
    useDialog().handleConfirm();
    await flushPromises();
    expect(resetDemo).toHaveBeenCalledTimes(1);
  });

  it('has no reset outside the demo', () => {
    platform.isDemoMode = false;
    const wrapper = mount(GeneralSettings);
    expect(wrapper.find('[data-testid="demo-reset"]').exists()).toBe(false);
    platform.isDemoMode = true;
  });
});
