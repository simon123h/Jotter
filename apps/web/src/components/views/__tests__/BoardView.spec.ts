import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BoardView from '@/components/views/BoardView.vue';
import ColumnEditModal from '@/components/modals/ColumnEditModal.vue';
import { deleteBucket } from '@/api';
import { useToastStore } from '@/stores/toast';
import { useUiStore } from '@/stores/ui';
import { createMockTask } from '@/__tests__/factories';
import type { Bucket } from '@/types';

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'project', params: { projectId: 'work' }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/api', () => ({
  deleteBucket: vi.fn(),
  getBuckets: vi.fn(() => Promise.resolve([])),
  updateBucket: vi.fn(() => Promise.resolve({})),
  createBucket: vi.fn(() => Promise.resolve({})),
  updateTask: vi.fn(() => Promise.resolve({})),
  getTasks: vi.fn(() => Promise.resolve([])),
  getAllTasks: vi.fn(() => Promise.resolve([])),
  getProjects: vi.fn(() => Promise.resolve([])),
  syncSystem: vi.fn(() => Promise.resolve([])),
}));

const todo: Bucket = { name: 'todo', title: 'To Do', subtitle: '', position: 1000, is_default: true };
const review: Bucket = { name: 'review', title: 'Review', subtitle: '', position: 2000, is_default: false };

describe('BoardView.vue deleting a column', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const openEditor = async (props: { buckets: Bucket[]; tasks: ReturnType<typeof createMockTask>[] }) => {
    const wrapper = mount(BoardView, { props, global: { stubs: { RouterLink: RouterLinkStub } }, attachTo: document.body });
    await flushPromises();
    (wrapper.vm as any).currentEditingBucket = review;
    (wrapper.vm as any).isEditModalOpen = true;
    await flushPromises();
    return wrapper;
  };

  it('shows why the column cannot be deleted, instead of doing nothing', async () => {
    vi.mocked(deleteBucket).mockRejectedValueOnce(
      new Error("Cannot delete column 'review': 2 task(s) are still in it, postponed ones included")
    );
    const wrapper = await openEditor({ buckets: [todo, review], tasks: [] });

    wrapper.findComponent(ColumnEditModal).vm.$emit('delete-column');
    await flushPromises();

    expect(useToastStore().toasts.map((t) => t.message)).toEqual([
      "Cannot delete column 'review': 2 task(s) are still in it, postponed ones included",
    ]);
    expect(wrapper.emitted('refresh')).toBeTruthy();
    wrapper.unmount();
  });

  it('says nothing when the column is deleted', async () => {
    vi.mocked(deleteBucket).mockResolvedValueOnce(undefined);
    const wrapper = await openEditor({ buckets: [todo, review], tasks: [] });

    wrapper.findComponent(ColumnEditModal).vm.$emit('delete-column');
    await flushPromises();

    expect(deleteBucket).toHaveBeenCalledWith('work', 'review');
    expect(useToastStore().toasts).toEqual([]);
    wrapper.unmount();
  });

  it('counts the tasks of a column that are planned beyond the horizon, so that the delete button is off', async () => {
    const postponed = createMockTask({ id: 'p', project_id: 'work', bucket: 'review', planned_date: '2999-01-01' });
    const wrapper = await openEditor({ buckets: [todo, review], tasks: [postponed] });

    expect(wrapper.findComponent(ColumnEditModal).props('tasksCount')).toBe(1);
    wrapper.unmount();
  });
});

describe('BoardView.vue lower pane', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // A desktop screen: the lower pane is not offered on a narrow one
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
  });

  const board = async () => {
    const wrapper = mount(BoardView, {
      props: { buckets: [todo, review], tasks: [createMockTask({ id: 'a', project_id: 'work', bucket: 'review' })] },
      global: { stubs: { RouterLink: RouterLinkStub } },
      attachTo: document.body,
    });
    await flushPromises();
    return wrapper;
  };

  it('has no lower pane until a column is docked, and docks a column from its settings', async () => {
    const wrapper = await board();
    expect(wrapper.find('[data-testid="lower-pane"]').exists()).toBe(false);

    const setDocked = async (title: string, docked: boolean) => {
      await wrapper
        .findAll('h3')
        .find((h) => h.text() === title)!
        .trigger('dblclick');
      await flushPromises();
      const checkbox = document.body.querySelector('[data-testid="column-dock"] input') as HTMLInputElement;
      checkbox.checked = docked;
      checkbox.dispatchEvent(new Event('change'));
      const save = Array.from(document.body.querySelectorAll('button')).find((btn) => btn.textContent?.includes('Save Changes'));
      save!.click();
      await flushPromises();
    };

    await setDocked('Review', true);

    const pane = wrapper.find('[data-testid="lower-pane"]');
    expect(pane.text()).toContain('Review');
    expect(pane.text()).not.toContain('To Do');
    expect(wrapper.find('[data-testid="lower-pane-divider"]').exists()).toBe(true);
    expect(useUiStore().isColumnDocked('work', 'review')).toBe(true);

    // Taking the tick out brings the column back to the board
    await setDocked('Review', false);
    expect(wrapper.find('[data-testid="lower-pane"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('resizes the pane with the arrow keys on the divider', async () => {
    useUiStore().toggleColumnDock('work', 'review');
    const wrapper = await board();

    await wrapper.find('[data-testid="lower-pane-divider"]').trigger('keydown', { key: 'ArrowUp' });
    expect(useUiStore().dockHeight).toBe(45);
    await wrapper.find('[data-testid="lower-pane-divider"]').trigger('keydown', { key: 'ArrowDown' });
    await wrapper.find('[data-testid="lower-pane-divider"]').trigger('keydown', { key: 'ArrowDown' });
    expect(useUiStore().dockHeight).toBe(35);
    wrapper.unmount();
  });

  it('keeps every column on the board on a narrow screen', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    useUiStore().toggleColumnDock('work', 'review');
    const wrapper = await board();

    expect(wrapper.find('[data-testid="lower-pane"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Review');
    wrapper.unmount();
  });
});

describe('BoardView.vue horizon', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('counts the tasks the horizon keeps out of the way, not the finished ones that are hidden anyway', async () => {
    const done: Bucket = { name: 'done', title: 'Done', subtitle: '', position: 3000, is_default: false };
    const tasks = [
      createMockTask({ id: 'a', bucket: 'todo', planned_date: '2999-01-01' }),
      createMockTask({ id: 'b', bucket: 'todo', planned_date: '2999-01-02' }),
      createMockTask({ id: 'c', bucket: 'done', planned_date: '2999-01-03' }),
      createMockTask({ id: 'd', bucket: 'todo' }),
    ];
    const wrapper = mount(BoardView, {
      props: { buckets: [todo, done], tasks },
      global: { stubs: { RouterLink: RouterLinkStub } },
      attachTo: document.body,
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="beyond-count"]').text()).toBe('2');
    wrapper.unmount();
  });
});
