import { beforeAll, describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TriageView from '@/components/views/TriageView.vue';
import { updateTask, deleteTask } from '@/api';
import type { Task, Bucket } from '@/types';

// Mock API endpoints
vi.mock('@/api', () => ({
  updateTask: vi.fn().mockResolvedValue({}),
  deleteTask: vi.fn().mockResolvedValue({}),
}));

describe('TriageView.vue', () => {
  let pinia: any;

  let mockTasks: Task[];
  const getMockTasks = (): Task[] => [
    {
      id: 'task-1',
      project_id: 'proj-1',
      title: 'First Created Task',
      body: 'Body 1',
      bucket: 'todo',
      priority: 'none',
      tags: ['bug'],
      position: 1.0,
      attachments: [],
      created_at: '2026-06-01T12:00:00Z',
      updated_at: '2026-06-01T12:00:00Z',
    },
    {
      id: 'task-2',
      project_id: 'proj-1',
      title: 'Second Created Task',
      body: 'Body 2',
      bucket: 'todo',
      priority: 'high',
      tags: ['feature'],
      position: 2.0,
      attachments: [],
      created_at: '2026-06-02T12:00:00Z',
      updated_at: '2026-06-02T12:00:00Z',
    },
    {
      id: 'task-3',
      project_id: 'proj-1',
      title: 'Third Created Task',
      body: 'Body 3',
      bucket: 'progress',
      priority: 'urgent',
      tags: [],
      position: 3.0,
      attachments: [],
      created_at: '2026-06-03T12:00:00Z',
      updated_at: '2026-06-03T12:00:00Z',
      due_date: '2026-06-15T12:00:00Z',
    },
  ];

  const mockBuckets: Bucket[] = [
    { name: 'todo', title: 'To Do', subtitle: '', position: 1, max_tasks: 10 },
    { name: 'progress', title: 'In Progress', subtitle: '', position: 2, max_tasks: 5 },
    { name: 'done', title: 'Done', subtitle: '', position: 3, max_tasks: 0 },
  ];

  beforeAll(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  beforeEach(() => {
    mockTasks = getMockTasks();
    vi.clearAllMocks();
    // Stub confirm to return true by default
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('renders correctly showing the first task initially in default sorting order', () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    const titleEl = wrapper.find('h1');
    expect(titleEl.exists()).toBe(true);
    expect(titleEl.text()).toContain('First Created Task');
    expect(wrapper.text()).toContain('1 / 3');
  });

  it('correctly navigates to next and previous tasks using buttons', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Find the Next button (ChevronRight)
    const buttons = wrapper.findAll('button');
    const nextButton = buttons.find((b) => b.html().includes('ChevronRight') || b.html().includes('chevron-right'));
    const prevButton = buttons.find((b) => b.html().includes('ChevronLeft') || b.html().includes('chevron-left'));

    expect(nextButton).toBeDefined();
    expect(prevButton).toBeDefined();

    // Click Next
    await nextButton!.trigger('click');
    expect(wrapper.find('h1').text()).toContain('Second Created Task');
    expect(wrapper.text()).toContain('2 / 3');

    // Click Next again
    await nextButton!.trigger('click');
    expect(wrapper.find('h1').text()).toContain('Third Created Task');
    expect(wrapper.text()).toContain('3 / 3');

    // Click Prev
    await prevButton!.trigger('click');
    expect(wrapper.find('h1').text()).toContain('Second Created Task');
    expect(wrapper.text()).toContain('2 / 3');
  });

  it('handles sorting options correctly', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Find the sorting select element
    const select = wrapper.find('select');
    expect(select.exists()).toBe(true);

    // Sort by Priority
    await select.setValue('priority');
    await nextTick();

    // With priority sort, mockTasks should be ordered: task-3 (urgent), task-2 (high), task-1 (none)
    expect(wrapper.find('h1').text()).toContain('Third Created Task');

    // Sort by Due Date
    await select.setValue('due');
    await nextTick();
    // task-3 has due date, others don't, task-3 should be first
    expect(wrapper.find('h1').text()).toContain('Third Created Task');

    // Sort by Created Desc
    await select.setValue('created-desc');
    await nextTick();
    // Order: task-3, task-2, task-1
    expect(wrapper.find('h1').text()).toContain('Third Created Task');
  });

  it('updates task priority when keys are pressed', async () => {
    mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Dispatch keydown '2' on window (High priority)
    const event = new KeyboardEvent('keydown', { key: '2' });
    window.dispatchEvent(event);

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { priority: 'high' });
  });

  it('updates task planning date when scheduling keys are pressed', async () => {
    mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Dispatch keydown 't' on window (Plan for Today)
    const eventT = new KeyboardEvent('keydown', { key: 't' });
    window.dispatchEvent(eventT);
    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { planned_date: 'today' });

    // Dispatch keydown 'w' on window (Plan for This Week)
    const eventW = new KeyboardEvent('keydown', { key: 'w' });
    window.dispatchEvent(eventW);
    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { planned_date: 'thisWeek' });

    // Dispatch keydown 's' on window (Plan for Sometime)
    const eventS = new KeyboardEvent('keydown', { key: 's' });
    window.dispatchEvent(eventS);
    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { planned_date: 'sometime' });
  });

  it('completes the task when pressing key v', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'v' });
    window.dispatchEvent(event);

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { bucket: 'done' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
    // Should auto-advance to next task after marking done
    expect(wrapper.find('h1').text()).toContain('Second Created Task');
  });

  it('allows moving column using the bucket picker modal', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Open Bucket Picker by pressing 'm'
    const eventM = new KeyboardEvent('keydown', { key: 'm' });
    window.dispatchEvent(eventM);
    await nextTick();

    // Picker modal should be visible
    expect(wrapper.text()).toContain('Move to Column:');

    // Press key '2' to move task to the second bucket (In Progress / progress)
    const eventNum = new KeyboardEvent('keydown', { key: '2' });
    window.dispatchEvent(eventNum);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { bucket: 'progress' });
  });

  it('deletes the task and confirms', async () => {
    mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'd' });
    window.dispatchEvent(event);

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteTask).toHaveBeenCalledWith('proj-1', 'task-1');
  });

  it('toggles shortcuts guide panel when pressing h or close button', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Shortcuts panel is visible by default
    const shortcutsPanel = wrapper.find('.w-72');
    expect(shortcutsPanel.exists()).toBe(true);
    expect(shortcutsPanel.attributes('style') || '').not.toContain('display: none');

    // Press 'h' to toggle
    const eventH = new KeyboardEvent('keydown', { key: 'h' });
    window.dispatchEvent(eventH);
    await nextTick();

    // Now hidden
    expect(shortcutsPanel.attributes('style')).toContain('display: none');
  });

  it('allows adding and removing tags', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Click "+ Add Tags" button
    const addTagBtn = wrapper.find('button[title="Remove tag"]').exists()
      ? wrapper.findAll('button').find((b) => b.text().includes('+ Add Tags'))
      : wrapper.find('.border-dashed');

    expect(addTagBtn).toBeDefined();
    await addTagBtn!.trigger('click');
    await nextTick();

    // Enter a new tag "refactor" and press Enter
    const input = wrapper.find('input[placeholder="Comma separated tags..."]');
    expect(input.exists()).toBe(true);
    await input.setValue('refactor');
    await nextTick();
    await input.trigger('keydown.enter');
    await nextTick();

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { tags: ['bug', 'refactor'] });

    // Try removing an existing tag
    const removeTagBtn = wrapper.find('button[title="Remove tag"]');
    expect(removeTagBtn.exists()).toBe(true);
    await removeTagBtn.trigger('click');

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { tags: ['refactor'] });
  });

  it('allows inline editing of title and description', async () => {
    const wrapper = mount(TriageView, {
      props: {
        tasks: mockTasks,
        buckets: mockBuckets,
      },
    });

    // Click title to edit
    const titleHeader = wrapper.find('h1');
    await titleHeader.trigger('click');
    await nextTick();

    // Edit title
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
    await input.setValue('Updated Title');
    await input.trigger('keydown.enter');

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { title: 'Updated Title' });

    // Click description to edit
    const descDiv = wrapper.find('[title="Click to edit markdown"]');
    expect(descDiv.exists()).toBe(true);
    await descDiv.trigger('click');
    await nextTick();

    // Edit body description
    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);
    await textarea.setValue('New Description Body');
    // Save via helper button or ctrl+enter trigger
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save'));
    expect(saveBtn).toBeDefined();
    await saveBtn!.trigger('click');

    expect(updateTask).toHaveBeenCalledWith('proj-1', 'task-1', { body: 'New Description Body' });
  });
});
