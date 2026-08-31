import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimeboxEditModal from '@/components/modals/TimeboxEditModal.vue';
import { useTimeboxStore } from '@/stores/timebox';

vi.mock('@/api', () => ({
  getTimeboxes: vi.fn().mockResolvedValue([]),
  createTimebox: vi.fn(),
  updateTimebox: vi.fn(),
  deleteTimebox: vi.fn(),
  allocateTaskToTimebox: vi.fn(),
}));

describe('TimeboxEditModal.vue', () => {
  let pinia: any;
  let wrapper: VueWrapper<any> | null = null;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  it('renders modal with default creation values when isOpen is true', () => {
    wrapper = mount(TimeboxEditModal, {
      props: {
        isOpen: true,
        initialDate: '2026-08-31',
        initialStartTime: '09:00',
        initialEndTime: '11:00',
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Create Timebox');
    const titleInput = wrapper.find('input[type="text"]');
    expect(titleInput.exists()).toBe(true);
  });

  it('populates fields when an existing timebox is provided', () => {
    wrapper = mount(TimeboxEditModal, {
      props: {
        isOpen: true,
        timebox: {
          id: 'tb_123',
          title: 'Deep Architecture Focus',
          date: '2026-08-31',
          startTime: '08:30',
          endTime: '10:30',
          color: 'emerald',
          taskIds: [],
        },
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Edit Timebox');
    const titleInput = wrapper.find('input[type="text"]');
    expect((titleInput.element as HTMLInputElement).value).toBe('Deep Architecture Focus');
  });

  it('submits timebox creation on form submit', async () => {
    const timeboxStore = useTimeboxStore();
    const createSpy = vi.spyOn(timeboxStore, 'createTimebox').mockResolvedValue({
      id: 'tb_new',
      title: 'New Sprint Box',
      date: '2026-08-31',
      startTime: '09:00',
      endTime: '10:00',
      color: 'indigo',
      taskIds: [],
    });

    wrapper = mount(TimeboxEditModal, {
      props: {
        isOpen: true,
        initialDate: '2026-08-31',
        initialStartTime: '09:00',
        initialEndTime: '10:00',
      },
      global: {
        plugins: [pinia],
      },
    });

    const titleInput = wrapper.find('input[type="text"]');
    await titleInput.setValue('New Sprint Box');

    const form = wrapper.find('form');
    await form.trigger('submit');

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Sprint Box',
        date: '2026-08-31',
      })
    );
    expect(wrapper.emitted('save')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
