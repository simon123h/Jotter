import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TimeBoxingView from '@/components/views/TimeBoxingView.vue';
import { useTimeboxStore } from '@/stores/timebox';
import { useProjectStore } from '@/stores/project';
import { useModalStore } from '@/stores/modal';

vi.mock('@/api', () => ({
  getTimeboxes: vi.fn().mockResolvedValue([]),
  createTimebox: vi.fn(),
  updateTimebox: vi.fn(),
  deleteTimebox: vi.fn(),
  allocateTaskToTimebox: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { projectId: 'default' },
    query: {},
    name: 'timeboxing',
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('TimeBoxingView.vue', () => {
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  it('renders week navigation, week controls, and days correctly', () => {
    const wrapper = mount(TimeBoxingView, {
      global: {
        plugins: [pinia],
        stubs: {
          routerLink: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Today');
    expect(wrapper.text()).toContain('Mon–Fri (5d)');
    expect(wrapper.text()).toContain('New Timebox');
  });

  it('switches between workweek and fullweek modes', async () => {
    const wrapper = mount(TimeBoxingView, {
      global: {
        plugins: [pinia],
        stubs: {
          routerLink: true,
        },
      },
    });

    const fullWeekBtn = wrapper.findAll('button').find((b) => b.text().includes('Mon–Sun'));
    expect(fullWeekBtn).toBeDefined();
    await fullWeekBtn?.trigger('click');

    expect(wrapper.text()).toContain('Mon–Sun (7d)');
  });

  it('opens timebox edit modal on slot click or add button', async () => {
    const modalStore = useModalStore();
    const openSpy = vi.spyOn(modalStore, 'openTimeboxEdit');

    const wrapper = mount(TimeBoxingView, {
      global: {
        plugins: [pinia],
        stubs: {
          routerLink: true,
        },
      },
    });

    const addBtn = wrapper.findAll('button').find((b) => b.text().includes('New Timebox'));
    await addBtn?.trigger('click');

    expect(openSpy).toHaveBeenCalled();
  });

  it('renders timeboxes on the grid and lists allocated tasks', async () => {
    const timeboxStore = useTimeboxStore();
    const projectStore = useProjectStore();

    projectStore.tasks = [
      {
        id: 'task-1',
        project_id: 'default',
        title: 'Implement Auth Service',
        bucket: 'todo',
        position: 1,
        tags: [],
        attachments: [],
        body: '',
        created_at: '2026-08-31',
        updated_at: '2026-08-31',
      },
    ];

    // Find the date of the first day in view
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    timeboxStore.timeboxes = [
      {
        id: 'tb-1',
        title: 'Deep Focus Morning',
        date: dateStr,
        startTime: '09:00',
        endTime: '11:00',
        color: 'indigo',
        taskIds: ['task-1'],
      },
    ];

    const wrapper = mount(TimeBoxingView, {
      global: {
        plugins: [pinia],
        stubs: {
          routerLink: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Deep Focus Morning');
    expect(wrapper.text()).toContain('Implement Auth Service');
  });
});
