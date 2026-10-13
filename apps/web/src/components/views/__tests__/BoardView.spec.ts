import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BoardView from '@/components/views/BoardView.vue';
import ColumnEditModal from '@/components/modals/ColumnEditModal.vue';
import { deleteBucket } from '@/api';
import { useToastStore } from '@/stores/toast';
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

  it('counts the tasks of a column that sit postponed in the Postponed column, so that the delete button is off', async () => {
    const postponed = createMockTask({ id: 'p', project_id: 'work', bucket: 'review', postponed_until: '2999-01-01' });
    const wrapper = await openEditor({ buckets: [todo, review], tasks: [postponed] });

    expect(wrapper.findComponent(ColumnEditModal).props('tasksCount')).toBe(1);
    wrapper.unmount();
  });
});
