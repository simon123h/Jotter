import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimeblockEditModal from '@/components/modals/TimeblockEditModal.vue';
import { useTimeblockStore } from '@/stores/timeblock';

vi.mock('@/api', () => ({
  getTimeblocks: vi.fn().mockResolvedValue([]),
  createTimeblock: vi.fn(),
  updateTimeblock: vi.fn(),
  deleteTimeblock: vi.fn(),
  allocateTaskToTimeblock: vi.fn(),
}));

describe('TimeblockEditModal.vue', () => {
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
    wrapper = mount(TimeblockEditModal, {
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

    expect(wrapper.text()).toContain('Create Time Block');
    const titleInput = wrapper.find('input[type="text"]');
    expect(titleInput.exists()).toBe(true);
  });

  it('populates fields when an existing timeblock is provided', () => {
    wrapper = mount(TimeblockEditModal, {
      props: {
        isOpen: true,
        timeblock: {
          id: 'tb_123',
          title: 'Deep Architecture Focus',
          date: '2026-08-31',
          start_time: '08:30',
          end_time: '10:30',
          color: 'emerald',
          task_ids: [],
        },
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Edit Time Block');
    const titleInput = wrapper.find('input[type="text"]');
    expect((titleInput.element as HTMLInputElement).value).toBe('Deep Architecture Focus');
  });

  it('submits timeblock creation on form submit', async () => {
    const timeblockStore = useTimeblockStore();
    const createSpy = vi.spyOn(timeblockStore, 'createTimeblock').mockResolvedValue({
      id: 'tb_new',
      title: 'New Sprint Box',
      date: '2026-08-31',
      start_time: '09:00',
      end_time: '10:00',
      color: 'indigo',
      task_ids: [],
    });

    wrapper = mount(TimeblockEditModal, {
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
