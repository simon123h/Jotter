import { beforeAll, describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BulkActionBar from '@/components/ui/BulkActionBar.vue';

beforeAll(() => {
  setActivePinia(createPinia());
});

describe('BulkActionBar.vue', () => {
  const defaultProps = {
    selectedCount: 3,
    buckets: [
      { name: 'todo', title: 'To Do', subtitle: '', position: 1, is_default: true },
      { name: 'in-progress', title: 'In Progress', subtitle: '', position: 2, is_default: false },
    ],
    projects: [
      { id: 'proj-1', title: 'Project 1', created_at: '' },
      { id: 'proj-2', title: 'Project 2', created_at: '' },
    ],
    activeProjectId: 'proj-1',
    commonTags: ['tag1', 'tag2'],
  };

  it('renders correctly when selectedCount > 0', () => {
    const wrapper = mount(BulkActionBar, {
      props: defaultProps,
    });

    expect(wrapper.text()).toContain('3');
    expect(wrapper.text()).toContain('Selected');
  });

  it('toggles the due date menu and emits preset set-due-date events', async () => {
    const wrapper = mount(BulkActionBar, {
      props: defaultProps,
    });

    // Find the due date toggle button. Its title contains "Set Due Date" in English.
    // Let's find button with Calendar icon or with title matching "setDueDate"
    const calendarBtn = wrapper.find('button[title*="Set Due Date"]');
    expect(calendarBtn.exists()).toBe(true);

    // Toggle menu
    await calendarBtn.trigger('click');

    // Menu should show "Set Due Date" heading and preset buttons
    expect(wrapper.text()).toContain('Set Due Date');
    expect(wrapper.text()).toContain('Today');
    expect(wrapper.text()).toContain('Tomorrow');
    expect(wrapper.text()).toContain('Next Week');
    expect(wrapper.text()).toContain('Clear Due Date');

    // Click "Today" preset
    const todayBtn = wrapper.findAll('button').find((b) => b.text().includes('Today'));
    expect(todayBtn?.exists()).toBe(true);
    await todayBtn?.trigger('click');

    const emitted = wrapper.emitted('set-due-date');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
  });

  it('emits clear set-due-date event when clicking Clear Due Date', async () => {
    const wrapper = mount(BulkActionBar, {
      props: defaultProps,
    });

    const calendarBtn = wrapper.find('button[title*="Set Due Date"]');
    await calendarBtn.trigger('click');

    const clearBtn = wrapper.findAll('button').find((b) => b.text().includes('Clear Due Date'));
    expect(clearBtn?.exists()).toBe(true);
    await clearBtn?.trigger('click');

    const emitted = wrapper.emitted('set-due-date');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0][0]).toBe('');
  });

  it('emits set-due-date event with custom date', async () => {
    const wrapper = mount(BulkActionBar, {
      props: defaultProps,
    });

    const calendarBtn = wrapper.find('button[title*="Set Due Date"]');
    await calendarBtn.trigger('click');

    // Find custom date picker input
    const input = wrapper.find('input[type="date"]');
    expect(input.exists()).toBe(true);
    await input.setValue('2026-12-25');

    // Find save button (which has Check icon and is next to the input inside the custom date container)
    const saveBtn = wrapper.find('div.space-y-1\\.5 button');
    expect(saveBtn.exists()).toBe(true);
    await saveBtn.trigger('click');

    const emitted = wrapper.emitted('set-due-date');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0][0]).toBe('2026-12-25');
  });
});
