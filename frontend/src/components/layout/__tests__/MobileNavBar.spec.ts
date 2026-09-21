import { describe, it, expect, vi, beforeAll } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MobileNavBar from '../MobileNavBar.vue';
import { useModalStore } from '@/stores/modal';

const mockPush = vi.fn();

vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'project',
    params: {
      projectId: 'proj-123',
    },
    query: {},
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/utils/haptics', () => ({
  triggerLightHaptic: vi.fn(),
  triggerMediumHaptic: vi.fn(),
  triggerSuccessHaptic: vi.fn(),
}));

beforeAll(() => {
  setActivePinia(createPinia());
});

describe('MobileNavBar.vue', () => {
  it('renders mobile navigation buttons and handles clicks', async () => {
    const wrapper = mount(MobileNavBar);
    expect(wrapper.exists()).toBe(true);

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(5);

    // Click list button
    const listBtn = buttons[1];
    await listBtn.trigger('click');
    expect(mockPush).toHaveBeenCalledWith({
      name: 'project-list',
      params: { projectId: 'proj-123' },
    });

    // Click matrix button
    const matrixBtn = buttons[3];
    await matrixBtn.trigger('click');
    expect(mockPush).toHaveBeenCalledWith({
      name: 'project-matrix',
      params: { projectId: 'proj-123' },
    });

    // Click quick add FAB
    const modalStore = useModalStore();
    const openCreateSpy = vi.spyOn(modalStore, 'openTaskCreate');
    const fabBtn = buttons[2];
    await fabBtn.trigger('click');
    expect(openCreateSpy).toHaveBeenCalledWith('todo');
  });
});
