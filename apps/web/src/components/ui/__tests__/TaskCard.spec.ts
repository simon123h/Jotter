import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TaskCard from '@/components/ui/TaskCard.vue';
import { updateTask } from '@/api';
import { useTimeblockStore } from '@/features/timeblock/stores/timeblock';
import { createMockTask } from '@/__tests__/factories';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'board',
    query: {},
  }),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
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

  const mockTask = createMockTask({
    id: '123',
    project_id: 'default',
    title: 'Test Task Title',
    body: 'Test Task Body',
    bucket: 'todo',
    position: 1.0,
    tags: ['bug', 'frontend'],
  });

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

  it('shows the domain of the address in the title or the notes as a link that does not open the task', async () => {
    const task = createMockTask({ ...mockTask, title: 'Article', body: 'Saw it at https://www.example.com/post/1.' });
    const wrapper = mount(TaskCard, { ...mountOptions, props: { task } });
    const link = wrapper.find('[data-testid="card-link"]');
    expect(link.text()).toBe('example.com');
    expect(link.attributes('href')).toBe('https://www.example.com/post/1');
    expect(link.attributes('target')).toBe('_blank');
    await link.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();

    expect(mount(TaskCard, mountOptions).find('[data-testid="card-link"]').exists()).toBe(false);
  });

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

  it('marks a medium, high or urgent task with a flag and leaves the others unmarked', () => {
    const flag = (priority?: string) =>
      mount(TaskCard, { ...mountOptions, props: { task: { ...mockTask, priority } } }).find('[data-testid="card-priority"]');
    expect(flag('urgent').attributes('title')).toBe('Urgent');
    expect(flag('high').exists()).toBe(true);
    expect(flag('medium').exists()).toBe(true);
    expect(flag('low').exists()).toBe(false);
    expect(flag(undefined).exists()).toBe(false);
  });

  it('extracts and renders level-zero checklist items correctly, ignoring indented ones by default', () => {
    const taskWithChecklist = createMockTask({
      ...mockTask,
      body: `- [ ] Level 0 Item 1\n  - [ ] Level 1 Item\n- [x] Level 0 Item 2`,
    });

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
    const taskWithChecklist = createMockTask({
      ...mockTask,
      body: `- [ ] Level 0 Item 1\n  - [ ] Level 1 Item\n    - [ ] Level 2 Item`,
    });

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

  it('normalizes nesting levels relative to the minimum indentation level found', () => {
    const taskWithChecklist = createMockTask({
      ...mockTask,
      body: `- Some bullet group header\n  - [ ] Level 1 Checklist Item 1\n  - [ ] Level 1 Checklist Item 2\n    - [ ] Level 2 Checklist Item 3`,
    });

    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: taskWithChecklist,
        maxNestingLevel: 0, // Should render Level 1 items because they are at minLevel (which is 1), but ignore Level 2 (which is 2)
      },
    });

    const checklistLabels = wrapper.findAll('.task-card-checklist label');
    expect(checklistLabels).toHaveLength(2); // Only Level 1 items
    expect(checklistLabels[0].text()).toContain('Level 1 Checklist Item 1');
    expect(checklistLabels[0].attributes('style')).toContain('padding-left: 0px'); // Level 1 normalized to 0px padding

    expect(checklistLabels[1].text()).toContain('Level 1 Checklist Item 2');
    expect(checklistLabels[1].attributes('style')).toContain('padding-left: 0px');
  });

  it('does not render checklist items if compact is true', () => {
    const taskWithChecklist = createMockTask({
      ...mockTask,
      body: `- [ ] Level 0 Item 1`,
    });

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
    const taskWithChecklist = createMockTask({
      ...mockTask,
      body: `- [ ] Level 0 Item 1\n  - [ ] Level 1 Item\n- [x] Level 0 Item 2`,
    });

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

  it('renders allocated timeblock badge and title when task is assigned to a timeblock', () => {
    const timeblockStore = useTimeblockStore();
    timeblockStore.timeblocks = [
      {
        id: 'tb-1',
        title: 'Morning Focus',
        date: '2026-09-01',
        start_time: '09:00',
        end_time: '11:00',
        task_ids: ['123'],
      },
    ];

    const wrapper = mount(TaskCard, mountOptions);
    expect(wrapper.text()).toContain('Morning Focus');
  });

  it('shows a missed deadline in red, and not a deadline that is still ahead or one of a finished task', () => {
    const due = (date: string, bucket = 'todo') =>
      mount(TaskCard, { ...mountOptions, props: { task: createMockTask({ ...mockTask, due_date: date, bucket }) } }).find(
        '[data-testid="card-due"]'
      );

    expect(due('2000-01-31').classes()).toContain('text-red-400');
    expect(due('2999-01-31').classes()).not.toContain('text-red-400');
    expect(due('2000-01-31', 'done').classes()).not.toContain('text-red-400');
  });

  it('shows the planned date as a day, a week or a month', () => {
    const planned = (date: string) =>
      mount(TaskCard, { ...mountOptions, props: { task: createMockTask({ ...mockTask, planned_date: date }) } });

    expect(planned('2999-01-31').find('[title^="Planned"]').exists()).toBe(true);
    expect(planned('2999-W05').find('[title^="Planned"]').text()).toContain('Week 5');
    expect(planned('2999-02').find('[title^="Planned"]').text()).toContain('February 2999');
  });
});
