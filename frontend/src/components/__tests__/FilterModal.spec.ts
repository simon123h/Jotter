import { beforeAll, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import FilterModal from '../FilterModal.vue';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  setActivePinia(createPinia());
});

describe('FilterModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    buckets: [
      { name: 'todo', title: 'To Do', subtitle: '', position: 1 },
      { name: 'in-progress', title: 'In Progress', subtitle: '', position: 2 },
      { name: 'done', title: 'Done', subtitle: '', position: 3 },
    ],
    allTags: ['bug', 'ui', 'refactor'],
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

  it('emits close event when clicking close button', async () => {
    const wrapper = mount(FilterModal, {
      props: defaultProps,
    });

    // Find the button inside the header that handles close
    const closeBtn = wrapper.find('button[class*="text-theme-text-muted"]');
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
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
});
