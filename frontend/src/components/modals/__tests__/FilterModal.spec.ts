import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import FilterModal from '@/components/modals/FilterModal.vue';
import { useSettingsStore } from '@/stores/settings';
import { useProjectStore } from '@/stores/project';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  setActivePinia(createPinia());
});

beforeEach(() => {
  const projectStore = useProjectStore();
  projectStore.buckets = [
    { name: 'todo', title: 'To Do', subtitle: '', position: 1, is_default: true },
    { name: 'in-progress', title: 'In Progress', subtitle: '', position: 2, is_default: false },
    { name: 'done', title: 'Done', subtitle: '', position: 3, is_default: false },
  ];
  projectStore.tasks = [{ id: 1, title: 'Task 1', tags: ['bug', 'ui', 'refactor'], project_id: 'test-project', bucket: 'todo' }] as any;
});

describe('FilterModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    currentFilters: {},
  };

  it('renders correctly when isOpen is true', () => {
    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    expect(wrapper.text()).toContain('Filter Tasks');
    expect(wrapper.find('input[placeholder="Search in title and description..."]').exists()).toBe(true);
    expect(wrapper.text()).toContain('To Do');
    expect(wrapper.text()).toContain('In Progress');
    expect(wrapper.text()).toContain('bug');
    expect(wrapper.text()).toContain('ui');
  });

  it('emits apply and close events when clicking close button (auto-save)', async () => {
    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    // Find the button inside the header that handles close
    const closeBtn = wrapper.find('button[class*="text-theme-text-muted"]');
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger('click');
    expect(wrapper.emitted('apply')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits apply and close events when Escape key is pressed (auto-save)', async () => {
    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    await nextTick();
    expect(wrapper.emitted('apply')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close but does NOT emit apply when clicking Cancel button (discard)', async () => {
    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('Cancel'));
    expect(cancelBtn).toBeDefined();
    await cancelBtn!.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('apply')).toBeFalsy();
  });

  it('emits apply event with selected filters', async () => {
    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    // Enter search text
    const searchInput = wrapper.find('input[placeholder="Search in title and description..."]');
    await searchInput.setValue('Refactor code');

    // Click Apply button
    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('Apply Filters'));
    expect(applyBtn).toBeDefined();
    await applyBtn!.trigger('click');
    expect(wrapper.emitted('apply')).toBeTruthy();
    const applyEvent = wrapper.emitted('apply')![0][0];
    expect(applyEvent).toEqual({
      search: 'Refactor code',
      buckets: undefined,
      priorities: undefined,
      tags: undefined,
      tag_mode: undefined,
      has_due_date: null,
      due_after: undefined,
      due_before: undefined,
    });
  });

  it('clears all filters when clicking clear button', async () => {
    const wrapper = mount(FilterModal, {
      props: {
        ...defaultProps,
        currentFilters: {
          search: 'Some search',
          buckets: 'todo',
          priorities: 'high',
        },
      },
    });

    const searchInput = wrapper.find('input[placeholder="Search in title and description..."]').element as HTMLInputElement;
    expect(searchInput.value).toBe('Some search');

    // Trigger clear
    const clearBtn = wrapper.findAll('button').find((b) => b.text().includes('Clear Filters'));
    expect(clearBtn).toBeDefined();
    await clearBtn!.trigger('click');
    await nextTick();
    expect(searchInput.value).toBe('');
  });

  it('updates settingsStore.hideDoneColumn when applied', async () => {
    const store = useSettingsStore();
    store.hideDoneColumn = false;

    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    const checkbox = wrapper.find('#hide-done-column-checkbox');
    expect(checkbox.exists()).toBe(true);
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    await checkbox.setValue(true);

    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('Apply Filters'));
    expect(applyBtn).toBeDefined();
    await applyBtn!.trigger('click');

    expect(store.hideDoneColumn).toBe(true);
  });
});
