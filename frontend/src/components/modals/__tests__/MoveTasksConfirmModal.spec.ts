import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import MoveTasksConfirmModal from '@/components/modals/MoveTasksConfirmModal.vue';
import { useProjectStore } from '@/stores/project';
import { useSelectionStore } from '@/stores/selection';
import { getBuckets, updateTask } from '@/api';

// Set up Pinia
beforeAll(() => {
  setActivePinia(createPinia());
});

// Mock API functions
vi.mock('@/api', () => ({
  getProjects: vi.fn().mockResolvedValue([]),
  getBuckets: vi.fn().mockResolvedValue([
    { id: 'b-1', name: 'todo', is_default: true },
    { id: 'b-2', name: 'done', is_default: false },
  ]),
  getTasks: vi.fn().mockResolvedValue([]),
  getAllTasks: vi.fn().mockResolvedValue([]),
  syncSystem: vi.fn().mockResolvedValue({}),
  updateTask: vi.fn().mockResolvedValue({}),
}));

describe('MoveTasksConfirmModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    taskIds: ['task-1', 'task-2'],
    targetProjectId: 'proj-new',
  };

  let wrapper: VueWrapper<any> | null = null;
  let projectStore: any;
  let selectionStore: any;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
    vi.clearAllMocks();
  });

  const mountModal = () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    projectStore = useProjectStore();
    selectionStore = useSelectionStore();

    // Populate some mocked store state
    projectStore.projects = [
      { id: 'proj-old', title: 'Old Project', created_at: '2026-06-01T12:00:00Z' },
      { id: 'proj-new', title: 'New Target Project', created_at: '2026-06-01T12:00:00Z' },
    ];
    projectStore.tasks = [
      { id: 'task-1', title: 'Task 1', project_id: 'proj-old', bucket: 'todo', position: 1.0 },
      { id: 'task-2', title: 'Task 2', project_id: 'proj-old', bucket: 'done', position: 2.0 },
    ];

    selectionStore.selectedIds = new Set(['task-1', 'task-2']);

    wrapper = mount(MoveTasksConfirmModal, {
      props: defaultProps,
      global: {
        plugins: [pinia],
      },
    });
  };

  it('renders correctly when isOpen is true', () => {
    mountModal();

    expect(wrapper!.text()).toContain('Move Tasks to Project');
    expect(wrapper!.text()).toContain('2 task(s)');
    expect(wrapper!.text()).toContain('New Target Project');
    expect(wrapper!.text()).toContain('Move to Default Column');
    expect(wrapper!.text()).toContain('Keep Current Columns');
  });

  it('does not render when isOpen is false', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = mount(MoveTasksConfirmModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toBe('');
  });

  it('emits close on pressing Escape', async () => {
    mountModal();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    await nextTick();

    expect(wrapper!.emitted('close')).toBeTruthy();
  });

  it('handles "Move to Default Column" selection and updates backend correctly', async () => {
    mountModal();

    // The default selection is already 'default' (Move to Default Column)
    const confirmBtn = wrapper!.find('button.bg-theme-primary');
    expect(confirmBtn.exists()).toBe(true);

    await confirmBtn.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert API calls
    expect(getBuckets).toHaveBeenCalledWith('proj-new');
    expect(updateTask).toHaveBeenCalledTimes(2);
    expect(updateTask).toHaveBeenNthCalledWith(1, 'proj-old', 'task-1', {
      project_id: 'proj-new',
      bucket: 'todo',
      position: 1000.0,
    });
    expect(updateTask).toHaveBeenNthCalledWith(2, 'proj-old', 'task-2', {
      project_id: 'proj-new',
      bucket: 'todo',
      position: 1000.0,
    });

    // Assert selection cleared & modal closed
    expect(selectionStore.selectedIds.size).toBe(0);
    expect(wrapper!.emitted('close')).toBeTruthy();
  });

  it('handles "Keep Current Columns" selection and updates backend without resetting bucket', async () => {
    mountModal();

    // Click "Keep Current Columns" card/button
    const keepOptionBtn = wrapper!.findAll('button').find((btn) => btn.text().includes('Keep Current Columns'));
    expect(keepOptionBtn).toBeDefined();
    await keepOptionBtn!.trigger('click');
    await nextTick();

    const confirmBtn = wrapper!.find('button.bg-theme-primary');
    await confirmBtn.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert API calls (should NOT get buckets or pass resetToDefaultBucket options)
    expect(getBuckets).not.toHaveBeenCalled();
    expect(updateTask).toHaveBeenCalledTimes(2);
    expect(updateTask).toHaveBeenNthCalledWith(1, 'proj-old', 'task-1', {
      project_id: 'proj-new',
    });
    expect(updateTask).toHaveBeenNthCalledWith(2, 'proj-old', 'task-2', {
      project_id: 'proj-new',
    });

    // Assert selection cleared & modal closed
    expect(selectionStore.selectedIds.size).toBe(0);
    expect(wrapper!.emitted('close')).toBeTruthy();
  });
});
