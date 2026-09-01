import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimeblockSidebar from '@/components/layout/TimeblockSidebar.vue';
import { useTimeblockStore } from '@/stores/timeblock';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';
import { useSelectionStore } from '@/stores/selection';

vi.mock('@/api', () => ({
  getTimeblocks: vi.fn().mockResolvedValue([]),
  createTimeblock: vi.fn(),
  updateTimeblock: vi.fn(),
  deleteTimeblock: vi.fn(),
  allocateTaskToTimeblock: vi.fn().mockResolvedValue({ id: 'tb-1', taskIds: ['task-1'], startTime: '09:00', endTime: '11:00' }),
  getTimeblocks: vi.fn().mockResolvedValue([]),
  createTimeblock: vi.fn(),
  updateTimeblock: vi.fn(),
  deleteTimeblock: vi.fn(),
  allocateTaskToTimeblock: vi.fn().mockResolvedValue({ id: 'tb-1', taskIds: ['task-1'], startTime: '09:00', endTime: '11:00' }),
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

describe('TimeblockSidebar.vue', () => {
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  it('renders title and day navigation controls', () => {
    const wrapper = mount(TimeblockSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Time Blocking');
  });

  it('navigates days with previous and next buttons', async () => {
    const wrapper = mount(TimeblockSidebar, {
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

  it('opens timeblock edit modal on grid slot click', async () => {
    const modalStore = useModalStore();
    const openSpy = vi.spyOn(modalStore, 'openTimeblockEdit');

    const wrapper = mount(TimeblockSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    const slot = wrapper.find('.timeblock-day-col > div');
    await slot.trigger('click');

    expect(openSpy).toHaveBeenCalled();
  });

  it('renders time blocks and allocates selected tasks on button click', async () => {
    const timeblockStore = useTimeblockStore();
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
    timeblockStore.timeblocks = [
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
    const allocateSpy = vi.spyOn(timeblockStore, 'allocateTask');

    const wrapper = mount(TimeblockSidebar, {
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
  });

  it('unallocates task from timeblock when task is completed inside the block', async () => {
    const timeblockStore = useTimeblockStore();
    const projectStore = useProjectStore();

    projectStore.tasks = [
      {
        id: 'task-1',
        project_id: 'default',
        title: 'Complete Feature',
        bucket: 'todo',
        position: 1,
        tags: [],
      },
    ];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    timeblockStore.timeblocks = [
      {
        id: 'tb-1',
        title: 'Focus Block',
        date: todayStr,
        startTime: '09:00',
        endTime: '11:00',
        color: 'indigo',
        taskIds: ['task-1'],
        recurrence: 'daily',
      },
    ];

    const unallocateSpy = vi.spyOn(timeblockStore, 'unallocateTask');

    const wrapper = mount(TimeblockSidebar, {
      global: {
        plugins: [pinia],
      },
    });

    const checkBtn = wrapper.find('.task-item-card button');
    expect(checkBtn.exists()).toBe(true);
    await checkBtn.trigger('click');
    await flushPromises();

    expect(unallocateSpy).toHaveBeenCalledWith('tb-1', 'task-1');
  });
});
