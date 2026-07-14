import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ProjectSidebar from '../ProjectSidebar.vue';
import { useSelectionStore } from '@/stores/selection';
import { useSettingsStore } from '@/stores/settings';
import type { Project } from '@/types';

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
  }),
}));

describe('ProjectSidebar.vue', () => {
  let pinia: any;
  let selectionStore: any;
  let settingsStore: any;

  const defaultProps = {
    projects: [
      { id: '1', title: 'Project A', created_at: '2026-06-08T00:00:00Z' },
      { id: '2', title: 'Project B', created_at: '2026-06-08T00:00:00Z' },
    ] as Project[],
    activeProjectId: '1',
    syncLoading: false,
    syncSuccess: false,
  };

  const getMountOptions = () => ({
    props: defaultProps,
    global: {
      plugins: [pinia],
      mocks: {
        $route: {
          query: {},
        },
      },
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  });

  beforeAll(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  beforeEach(() => {
    setActivePinia(pinia);
    selectionStore = useSelectionStore();
    settingsStore = useSettingsStore();

    // Reset store states
    selectionStore.clearSelection();
    selectionStore.draggingTaskIds = [];
    settingsStore.pinnedProjectIds = [];
    settingsStore.sortBy = 'alpha';
  });

  it('renders a list of projects correctly', () => {
    const wrapper = mount(ProjectSidebar, getMountOptions());
    const items = wrapper.findAll('.project-item');
    expect(items.length).toBe(3);
    expect(items[0].text()).toContain('All Projects');
    expect(items[1].text()).toContain('Project A');
    expect(items[2].text()).toContain('Project B');
  });

  it('sets the active project class correctly', () => {
    const wrapper = mount(ProjectSidebar, getMountOptions());
    const items = wrapper.findAll('.project-item');
    const activeItem = items[1]; // Project A (id: '1')
    expect(activeItem.classes()).toContain('text-theme-accent');
  });

  it('triggers drag and drop lifecycle correctly', async () => {
    const wrapper = mount(ProjectSidebar, getMountOptions());
    const targetItem = wrapper.findAll('.project-item')[2]; // Project B (id: '2')

    // Simulate drag start on task card
    selectionStore.draggingTaskIds = ['task-1', 'task-2'];

    // Spy on Event.prototype.preventDefault
    const preventDefaultSpy = vi.spyOn(Event.prototype, 'preventDefault');

    // 1. Drag Over
    const dragOverEvent = {
      dataTransfer: { dropEffect: '' },
    } as unknown as DragEvent;
    await targetItem.trigger('dragover', dragOverEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();

    // Restore spy
    preventDefaultSpy.mockRestore();

    // 2. Drag Enter
    await targetItem.trigger('dragenter');
    await wrapper.vm.$nextTick();

    // Verify scale or class logic or computed state via wrapper classes/badge
    const badge = wrapper.find('.bg-theme-primary.animate-pulse');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('+2');

    // 3. Drop
    await targetItem.trigger('drop');
    const moveEvents = wrapper.emitted('move-tasks-to-project');
    expect(moveEvents).toBeTruthy();
    expect(moveEvents?.[0]).toEqual([{ taskIds: ['task-1', 'task-2'], projectId: '2' }]);
  });

  it('emits import-spreadsheet when import button is clicked', async () => {
    const wrapper = mount(ProjectSidebar, getMountOptions());
    const importBtn = wrapper.findAll('button').find((b) => b.text().includes('Import'));
    expect(importBtn).toBeDefined();
    await importBtn!.trigger('click');
    expect(wrapper.emitted('import-spreadsheet')).toBeTruthy();
  });
});
