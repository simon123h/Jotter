import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
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
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const wrapper = mount(GeneralSettings);

    await wrapper.find('[data-testid="demo-reset"]').trigger('click');
    expect(resetDemo).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="demo-reset"]').trigger('click');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(resetDemo).toHaveBeenCalledTimes(1);
  });

  it('has no reset outside the demo', () => {
    platform.isDemoMode = false;
    const wrapper = mount(GeneralSettings);
    expect(wrapper.find('[data-testid="demo-reset"]').exists()).toBe(false);
    platform.isDemoMode = true;
  });
});
