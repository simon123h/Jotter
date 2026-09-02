import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ReviewView from '@/components/views/ReviewView.vue';
import { useProjectStore } from '@/stores/project';
import type { Task, Bucket } from '@/types';

// Mock vue-router
const mockRoute = {
  params: { projectId: 'proj-1' },
  query: {},
  meta: {},
};

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('ReviewView.vue', () => {
  let pinia: any;

  const now = new Date();
  const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString();

  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const mockBuckets: Bucket[] = [
    { name: 'todo', title: 'To Do', subtitle: '', position: 1, is_default: true },
    { name: 'done', title: 'Done', subtitle: '', position: 2, is_default: false },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      project_id: 'proj-1',
      title: 'Completed Today Task',
      body: 'Body 1',
      bucket: 'done',
      position: 1,
      tags: ['backend'],
      attachments: [],
      created_at: todayISO,
      updated_at: todayISO,
    },
    {
      id: 'task-2',
      project_id: 'proj-1',
      title: 'Completed 3 Days Ago Task',
      body: 'Body 2',
      bucket: 'done',
      position: 2,
      tags: ['frontend'],
      attachments: [],
      created_at: threeDaysAgo,
      updated_at: threeDaysAgo,
    },
    {
      id: 'task-3',
      project_id: 'proj-1',
      title: 'Completed 10 Days Ago Task',
      body: 'Body 3',
      bucket: 'done',
      position: 3,
      tags: ['docs'],
      attachments: [],
      created_at: tenDaysAgo,
      updated_at: tenDaysAgo,
    },
    {
      id: 'task-4',
      project_id: 'proj-1',
      title: 'Uncompleted Todo Task',
      body: 'Body 4',
      bucket: 'todo',
      position: 4,
      tags: [],
      attachments: [],
      created_at: todayISO,
      updated_at: todayISO,
    },
  ];

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const createWrapper = (tasks: Task[] = mockTasks) => {
    return mount(ReviewView, {
      props: {
        buckets: mockBuckets,
        tasks,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TaskCard: {
            props: ['task', 'showDoneButton'],
            template: '<div class="stub-task-card" :data-task-id="task.id">{{ task.title }}</div>',
          },
        },
      },
    });
  };

  it('renders correctly and filters only completed tasks for "today" timeframe by default', () => {
    const wrapper = createWrapper();

    const renderedCards = wrapper.findAll('.stub-task-card');
    // Only task-1 is done today (task-4 is todo, task-2 is 3 days ago, task-3 is 10 days ago)
    expect(renderedCards.length).toBe(1);
    expect(renderedCards[0].text()).toContain('Completed Today Task');
  });

  it('switches timeframe to "Last 7 Days" and shows tasks completed within past 7 days', async () => {
    const wrapper = createWrapper();

    const buttons = wrapper.findAll('button');
    const last7DaysBtn = buttons.find((b) => b.text().includes('Last 7 Days') || b.text().includes('Letzte 7 Tage'));
    expect(last7DaysBtn).toBeDefined();

    await last7DaysBtn!.trigger('click');
    await nextTick();

    const renderedCards = wrapper.findAll('.stub-task-card');
    // task-1 (today) and task-2 (3 days ago) are included; task-3 (10 days ago) and task-4 (todo) are excluded
    expect(renderedCards.length).toBe(2);
    expect(renderedCards[0].text()).toContain('Completed Today Task');
    expect(renderedCards[1].text()).toContain('Completed 3 Days Ago Task');
  });

  it('displays empty state when search returns no matching tasks (empty props.tasks)', () => {
    const projectStore = useProjectStore();
    projectStore.tasks = [...mockTasks];

    // Empty array passed from ProjectLayout because search matched nothing
    const wrapper = createWrapper([]);
    expect(wrapper.find('.stub-task-card').exists()).toBe(false);
    expect(wrapper.text()).toContain('No completed tasks in this period');
  });
});
