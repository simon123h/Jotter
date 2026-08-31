import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimeboxSidebar from '@/components/layout/TimeboxSidebar.vue';
import { useTimeboxStore } from '@/stores/timebox';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import { useSelectionStore } from '@/stores/selection';

vi.mock('@/api', () => ({
  getTimeboxes: vi.fn().mockResolvedValue([]),
  createTimebox: vi.fn(),
  updateTimebox: vi.fn(),
  deleteTimebox: vi.fn(),
  allocateTaskToTimebox: vi.fn().mockResolvedValue({ id: 'tb-1', taskIds: ['task-1'], startTime: '09:00', endTime: '11:00' }),
  getSettings: vi.fn().mockResolvedValue({}),
  updateTask: vi.fn().mockResolvedValue({}),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { projectId: 'default' },
    query: {},
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('TimeboxSidebar.vue', () => {
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  it('renders title and day navigation controls', () => {
    const wrapper = mount(TimeboxSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Time Blocking');
  });

  it('navigates days with previous and next buttons', async () => {
    const wrapper = mount(TimeboxSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    const prevBtn = wrapper.find('button[title="Previous day"]');
    expect(prevBtn.exists()).toBe(true);
    await prevBtn.trigger('click');

    const nextBtn = wrapper.find('button[title="Next day"]');
    expect(nextBtn.exists()).toBe(true);
    await nextBtn.trigger('click');
  });

  it('opens timebox edit modal on grid slot click', async () => {
    const modalStore = useModalStore();
    const openSpy = vi.spyOn(modalStore, 'openTimeboxEdit');

    const wrapper = mount(TimeboxSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    const slot = wrapper.find('.timebox-day-col > div');
    await slot.trigger('click');

    expect(openSpy).toHaveBeenCalled();
  });

  it('renders time blocks and allocates selected tasks on button click', async () => {
    const timeboxStore = useTimeboxStore();
    const projectStore = useProjectStore();
    const selectionStore = useSelectionStore();

    projectStore.tasks = [
      {
        id: 'task-1',
        project_id: 'default',
        title: 'Implement Auth Service',
        bucket: 'todo',
        position: 1,
        tags: [],
      },
    ];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    timeboxStore.timeboxes = [
      {
        id: 'tb-1',
        title: 'Focus Sprint',
        date: todayStr,
        startTime: '09:00',
        endTime: '11:00',
        color: 'indigo',
        taskIds: [],
      },
    ];

    selectionStore.selectedIds.add('task-1');
    const allocateSpy = vi.spyOn(timeboxStore, 'allocateTask');

    const wrapper = mount(TimeboxSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Focus Sprint');
    expect(wrapper.text()).toContain('09:00 - 11:00');

    // Click the Add Selected Tasks button
    const planSelectedBtn = wrapper.find('button[aria-label="Add Tasks"]');
    expect(planSelectedBtn.exists()).toBe(true);
    await planSelectedBtn.trigger('click');
    await flushPromises();

    expect(allocateSpy).toHaveBeenCalledWith('tb-1', 'task-1');
    expect(projectStore.tasks[0].planned_date).toBe('today');
  });
});
