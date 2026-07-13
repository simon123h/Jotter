import { defineComponent, computed } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useBoardNavigation } from '@/composables/useBoardNavigation';
import { useSelectionStore } from '@/stores/selection';
import { useModalStore } from '@/stores/modal';
import type { Task, Bucket } from '@/types';

const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'project',
    params: { projectId: 'proj-1' },
    query: {},
  }),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('useBoardNavigation composable', () => {
  let pinia: any;

  const mockBuckets: Bucket[] = [
    { name: 'todo', title: 'To Do', subtitle: '', position: 1, max_tasks: 0 },
    { name: 'progress', title: 'In Progress', subtitle: '', position: 2, max_tasks: 0 },
    { name: 'done', title: 'Done', subtitle: '', position: 3, max_tasks: 0 },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      project_id: 'proj-1',
      title: 'Task 1',
      body: '',
      bucket: 'todo',
      priority: 'none',
      tags: [],
      position: 1.0,
      attachments: [],
      created_at: '',
      updated_at: '',
    },
    {
      id: 'task-2',
      project_id: 'proj-1',
      title: 'Task 2',
      body: '',
      bucket: 'todo',
      priority: 'none',
      tags: [],
      position: 2.0,
      attachments: [],
      created_at: '',
      updated_at: '',
    },
    {
      id: 'task-3',
      project_id: 'proj-1',
      title: 'Task 3',
      body: '',
      bucket: 'progress',
      priority: 'none',
      tags: [],
      position: 1.0,
      attachments: [],
      created_at: '',
      updated_at: '',
    },
  ];

  beforeAll(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const selectionStore = useSelectionStore();
    selectionStore.clearSelection();
    const modalStore = useModalStore();
    modalStore.activeModal = null;
  });

  const TestComponent = defineComponent({
    props: {
      buckets: { type: Array as () => Bucket[], required: true },
      tasks: { type: Array as () => Task[], required: true },
    },
    setup(props) {
      const visibleBuckets = computed(() => props.buckets);
      const tasksByBucket = computed(() => {
        const groups: Record<string, Task[]> = {};
        props.buckets.forEach((b) => {
          groups[b.name] = [];
        });
        props.tasks.forEach((task) => {
          if (groups[task.bucket]) {
            groups[task.bucket].push(task);
          }
        });
        return groups;
      });
      const tasksRef = computed(() => props.tasks);

      useBoardNavigation({
        visibleBuckets,
        tasksByBucket,
        tasks: tasksRef,
      });

      return {};
    },
    template: '<div></div>',
  });

  it('selects the first task on arrow keypress when nothing is selected', () => {
    const selectionStore = useSelectionStore();
    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    window.dispatchEvent(event);

    expect(selectionStore.selectedIds.has('task-1')).toBe(true);
    expect(selectionStore.selectionCount).toBe(1);

    wrapper.unmount();
  });

  it('navigates down to the next task in the column on ArrowDown', () => {
    const selectionStore = useSelectionStore();
    selectionStore.toggleSelection('task-1');

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    window.dispatchEvent(event);

    expect(selectionStore.selectedIds.has('task-2')).toBe(true);
    expect(selectionStore.selectedIds.has('task-1')).toBe(false);

    wrapper.unmount();
  });

  it('navigates up to the previous task in the column on ArrowUp', () => {
    const selectionStore = useSelectionStore();
    selectionStore.toggleSelection('task-2');

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
    window.dispatchEvent(event);

    expect(selectionStore.selectedIds.has('task-1')).toBe(true);
    expect(selectionStore.selectedIds.has('task-2')).toBe(false);

    wrapper.unmount();
  });

  it('navigates right to the adjacent column on ArrowRight', () => {
    const selectionStore = useSelectionStore();
    selectionStore.toggleSelection('task-1'); // index 0 in 'todo'

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    window.dispatchEvent(event);

    // Adjacent column is 'progress', target task is task-3 (since current index is 0)
    expect(selectionStore.selectedIds.has('task-3')).toBe(true);
    expect(selectionStore.selectedIds.has('task-1')).toBe(false);

    wrapper.unmount();
  });

  it('navigates left to the adjacent column on ArrowLeft', () => {
    const selectionStore = useSelectionStore();
    selectionStore.toggleSelection('task-3'); // in 'progress'

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    window.dispatchEvent(event);

    // Adjacent column is 'todo', target index min(0, todo.length-1) -> task-1
    expect(selectionStore.selectedIds.has('task-1')).toBe(true);
    expect(selectionStore.selectedIds.has('task-3')).toBe(false);

    wrapper.unmount();
  });

  it('opens selected task modal on Enter keypress', () => {
    const selectionStore = useSelectionStore();
    selectionStore.toggleSelection('task-1');

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    window.dispatchEvent(event);

    expect(pushMock).toHaveBeenCalledWith({
      name: 'project-task',
      params: { projectId: 'proj-1', taskId: 'task-1' },
      query: {},
    });

    wrapper.unmount();
  });

  it('clears selection on Escape keypress', () => {
    const selectionStore = useSelectionStore();
    selectionStore.toggleSelection('task-1');

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(selectionStore.selectionCount).toBe(0);

    wrapper.unmount();
  });

  it('ignores shortcuts when a modal is active', () => {
    const selectionStore = useSelectionStore();
    const modalStore = useModalStore();
    modalStore.activeModal = 'task-create';

    const wrapper = mount(TestComponent, {
      props: {
        buckets: mockBuckets,
        tasks: mockTasks,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
    window.dispatchEvent(event);

    expect(selectionStore.selectionCount).toBe(0);

    wrapper.unmount();
  });
});
