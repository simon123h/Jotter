import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TaskCard from '@/components/ui/TaskCard.vue';
import type { Task } from '@/types';
import { updateTask } from '@/api';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'board',
    query: {},
  }),
}));

vi.mock('@/api', () => ({
  updateTask: vi.fn(() => Promise.resolve({})),
  getTasks: vi.fn(() => Promise.resolve([])),
  getAllTasks: vi.fn(() => Promise.resolve([])),
  getBuckets: vi.fn(() => Promise.resolve([])),
  getProjects: vi.fn(() => Promise.resolve([])),
  syncSystem: vi.fn(() => Promise.resolve([])),
}));

describe('TaskCard.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const mockTask: Task = {
    id: '123',
    project_id: 'default',
    title: 'Test Task Title',
    body: 'Test Task Body',
    bucket: 'todo',
    position: 1.0,
    tags: ['bug', 'frontend'],
    attachments: [],
    created_at: '2026-05-30T20:00:00Z',
    updated_at: '2026-05-30T20:00:00Z',
  };

  const mountOptions = {
    props: {
      task: mockTask,
    },
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  };

  it('renders task title correctly', () => {
    const wrapper = mount(TaskCard, mountOptions);
    expect(wrapper.text()).toContain('Test Task Title');
  });

  it('renders tags lists properly', () => {
    const wrapper = mount(TaskCard, mountOptions);

    const tags = wrapper.findAll('span.border');
    expect(tags).toHaveLength(2);
    expect(tags[0].text()).toBe('bug');
    expect(tags[1].text()).toBe('frontend');
  });

  it('emits click event on click', async () => {
    const wrapper = mount(TaskCard, mountOptions);

    await wrapper.trigger('click');
    expect(wrapper.emitted()).toBeDefined();
  });

  it('emits mark-done event when the checkmark button is clicked', async () => {
    const wrapper = mount(TaskCard, mountOptions);

    const markDoneBtn = wrapper.find('button[title="Mark as done"]');
    expect(markDoneBtn.exists()).toBe(true);

    await markDoneBtn.trigger('click');

    expect(wrapper.emitted('mark-done')).toBeTruthy();
    expect(wrapper.emitted('mark-done')?.[0]).toEqual([mockTask]);
  });

  it('does not render checkmark button if task is in the done bucket', () => {
    const doneTask = { ...mockTask, bucket: 'done' };
    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: doneTask,
      },
    });

    const markDoneBtn = wrapper.find('button[title="Mark as done"]');
    expect(markDoneBtn.exists()).toBe(false);
  });

  it('extracts and renders level-zero checklist items correctly, ignoring indented ones by default', () => {
    const taskWithChecklist: Task = {
      ...mockTask,
      body: `- [ ] Level 0 Item 1\n  - [ ] Level 1 Item\n- [x] Level 0 Item 2`,
    };

    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: taskWithChecklist,
      },
    });

    const checklistLabels = wrapper.findAll('.task-card-checklist label');
    expect(checklistLabels).toHaveLength(2);
    expect(checklistLabels[0].text()).toContain('Level 0 Item 1');
    expect(checklistLabels[1].text()).toContain('Level 0 Item 2');
    expect(checklistLabels[1].classes()).toContain('line-through'); // since it is checked [x]
  });

  it('renders nested checklist items up to maxNestingLevel with visual padding', () => {
    const taskWithChecklist: Task = {
      ...mockTask,
      body: `- [ ] Level 0 Item 1\n  - [ ] Level 1 Item\n    - [ ] Level 2 Item`,
    };

    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: taskWithChecklist,
        maxNestingLevel: 1,
      },
    });

    const checklistLabels = wrapper.findAll('.task-card-checklist label');
    expect(checklistLabels).toHaveLength(2); // Level 0 and Level 1
    expect(checklistLabels[0].text()).toContain('Level 0 Item 1');
    expect(checklistLabels[0].attributes('style')).toContain('padding-left: 0px');

    expect(checklistLabels[1].text()).toContain('Level 1 Item');
    expect(checklistLabels[1].attributes('style')).toContain('padding-left: 16px');
  });

  it('does not render checklist items if compact is true', () => {
    const taskWithChecklist: Task = {
      ...mockTask,
      body: `- [ ] Level 0 Item 1`,
    };

    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: taskWithChecklist,
        compact: true,
      },
    });

    const checklist = wrapper.find('.task-card-checklist');
    expect(checklist.exists()).toBe(false);
  });

  it('toggles a checklist item when its checkbox is clicked', async () => {
    const taskWithChecklist: Task = {
      ...mockTask,
      body: `- [ ] Level 0 Item 1\n  - [ ] Level 1 Item\n- [x] Level 0 Item 2`,
    };

    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: taskWithChecklist,
      },
    });

    const checkboxes = wrapper.findAll('.task-card-checklist input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);

    // Let's toggle the first checkbox (globalIndex 0)
    await checkboxes[0].trigger('click');

    // It should call updateTask with the new body where the first item is checked [x]
    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(updateTask).toHaveBeenCalledWith('default', '123', {
      body: `- [x] Level 0 Item 1\n  - [ ] Level 1 Item\n- [x] Level 0 Item 2`,
    });
  });
});
