import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TimeMachineModal from '@/components/modals/TimeMachineModal.vue';
import { useProjectStore } from '@/stores/project';

// Set up Pinia
beforeAll(() => {
  setActivePinia(createPinia());
});

// Mock API functions
vi.mock('@/api', () => ({
  getGitHistory: vi.fn().mockResolvedValue([
    {
      id: 'commit-1234567890',
      short_id: 'commit-123',
      author: 'Tester Simon',
      date: '2026-06-08T12:00:00Z',
      message: 'Created a masterpiece snapshot',
    },
    {
      id: 'commit-abcdefghij',
      short_id: 'commit-abc',
      author: 'Tester John',
      date: '2026-06-07T12:00:00Z',
      message: 'Cleaned up the workspace',
    },
  ]),
}));

describe('TimeMachineModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    projectId: 'project-1',
  };

  let wrapper: VueWrapper<any> | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
    vi.clearAllMocks();
  });

  it('renders correctly when isOpen is true', async () => {
    wrapper = mount(TimeMachineModal, {
      props: defaultProps,
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(wrapper.text()).toContain('Time Machine');
    expect(wrapper.text()).toContain('Created a masterpiece snapshot');
    expect(wrapper.text()).toContain('Cleaned up the workspace');
  });

  it('does not render when isOpen is false', () => {
    wrapper = mount(TimeMachineModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
    });

    expect(wrapper.find('h3').exists()).toBe(false);
  });

  it('filters the commit history by message, author, or hash input', async () => {
    wrapper = mount(TimeMachineModal, {
      props: defaultProps,
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    const searchInput = wrapper.find('input[type="text"]');
    expect(searchInput.exists()).toBe(true);

    // Filter for Simon's commit
    await searchInput.setValue('Simon');
    await nextTick();

    expect(wrapper.text()).toContain('Created a masterpiece snapshot');
    expect(wrapper.text()).not.toContain('Cleaned up the workspace');

    // Filter for abc hash
    await searchInput.setValue('abc');
    await nextTick();

    expect(wrapper.text()).not.toContain('Created a masterpiece snapshot');
    expect(wrapper.text()).toContain('Cleaned up the workspace');
  });

  it('calls restoreToCommit on the project store when a commit is restored', async () => {
    const projectStore = useProjectStore();
    const restoreSpy = vi.spyOn(projectStore, 'restoreToCommit').mockResolvedValue(undefined as any);

    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    wrapper = mount(TimeMachineModal, {
      props: defaultProps,
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    // Find the restore buttons and click on the first one
    const restoreBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Restore State'));
    expect(restoreBtn).toBeDefined();

    await restoreBtn!.trigger('click');
    await nextTick();

    expect(confirmSpy).toHaveBeenCalled();
    expect(restoreSpy).toHaveBeenCalledWith('commit-1234567890', 'project-1');
    expect(wrapper.emitted('close')).toBeTruthy();

    confirmSpy.mockRestore();
    restoreSpy.mockRestore();
  });
});
