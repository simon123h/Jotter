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

// The drag of a project is Sortable's: the test takes the options the sidebar gives it and plays its end of a drag
const sortableOptions = vi.hoisted(() => ({ current: null as any }));
vi.mock('sortablejs', () => ({
  default: { create: (_el: unknown, options: unknown) => ((sortableOptions.current = options), { destroy() {}, option() {} }) },
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

  it('keeps the order a project is dragged to, "All Projects" not counted as a place in the list', () => {
    settingsStore.sortBy = 'manual';
    const wrapper = mount(ProjectSidebar, getMountOptions());
    // Only the projects can be dragged, not the "All Projects" entry in front of them
    const draggable = wrapper.findAll(sortableOptions.current.draggable);
    expect(draggable.map((item) => item.text())).toEqual(['Project A', 'Project B']);
    // Project B is dropped in front of project A: the second child of the list becomes the first
    sortableOptions.current.onEnd({ oldIndex: 2, newIndex: 1, oldDraggableIndex: 1, newDraggableIndex: 0 });
    expect(settingsStore.projectOrder).toEqual(['2', '1']);
  });

  it('lists archived projects apart, collapsed, and not among the projects in use', async () => {
    const props = {
      ...defaultProps,
      projects: [...defaultProps.projects, { id: '3', title: 'Old trip', created_at: '2026-06-08T00:00:00Z', archived: true } as Project],
    };
    const wrapper = mount(ProjectSidebar, { ...getMountOptions(), props });
    expect(wrapper.findAll('.project-item').map((i) => i.text())).not.toContain('Old trip');
    expect(wrapper.find('[data-testid="archived-toggle"]').text()).toContain('Archived (1)');
    expect(wrapper.find('[data-testid="archived-project"]').exists()).toBe(false);

    await wrapper.find('[data-testid="archived-toggle"]').trigger('click');
    expect(wrapper.findAll('[data-testid="archived-project"]').map((i) => i.text())).toEqual(['Old trip']);
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

  it('keeps the drop target highlighted while the pointer moves over the parts of its row', async () => {
    const wrapper = mount(ProjectSidebar, getMountOptions());
    const row = wrapper.findAll('.project-item')[2];
    const title = row.find('span.truncate');
    const highlighted = () => wrapper.find('.bg-theme-primary.animate-pulse').exists();
    selectionStore.draggingTaskIds = ['task-1'];

    await row.trigger('dragenter');
    expect(highlighted()).toBe(true);

    // The browser fires dragenter for the child, then dragleave for the row it came from
    await title.trigger('dragenter');
    await row.trigger('dragleave', { relatedTarget: title.element });
    expect(highlighted()).toBe(true);

    // A dragleave without a related target (some browsers) is repaired by the next dragover
    await row.trigger('dragleave');
    await row.trigger('dragover', { dataTransfer: { dropEffect: '' } });
    expect(highlighted()).toBe(true);

    // Leaving the row for something else clears it
    await row.trigger('dragleave', { relatedTarget: document.body });
    expect(highlighted()).toBe(false);
  });

  it('emits close when mobile close button is clicked', async () => {
    const wrapper = mount(ProjectSidebar, getMountOptions());
    const closeBtn = wrapper.findAll('button').find((b) => b.attributes('title') === 'Close' || b.classes().includes('md:hidden'));
    expect(closeBtn).toBeDefined();
    await closeBtn!.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
