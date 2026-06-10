import { beforeAll, describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
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

  it('resets activeMenu to none when selectedCount becomes 0', async () => {
    const wrapper = mount(BulkActionBar, {
      props: {
        ...defaultProps,
        selectedCount: 3,
      },
    });

    const calendarBtn = wrapper.find('button[title*="Set Due Date"]');
    expect(calendarBtn.exists()).toBe(true);
    await calendarBtn.trigger('click');

    // The nested menu should be open
    expect(wrapper.text()).toContain('Set Due Date');

    // Change selectedCount to 0 (triggers the watch and resets activeMenu to 'none')
    await wrapper.setProps({ selectedCount: 0 });
    await nextTick();

    // Change selectedCount back to 3
    await wrapper.setProps({ selectedCount: 3 });
    await nextTick();

    // The nested menu should NOT be open anymore because activeMenu was reset to 'none'
    expect(wrapper.text()).not.toContain('Set Due Date');
  });

  it('toggles the color menu and emits set-color events', async () => {
    const wrapper = mount(BulkActionBar, {
      props: defaultProps,
    });

    const colorBtn = wrapper.find('button[title*="Color"]');
    expect(colorBtn.exists()).toBe(true);

    // Toggle menu
    await colorBtn.trigger('click');

    // Red color button should be visible and clickable
    const redBtn = wrapper.find('button[title="Red"]');
    expect(redBtn.exists()).toBe(true);
    await redBtn.trigger('click');

    const emitted = wrapper.emitted('set-color');
    expect(emitted).toBeTruthy();
    expect(emitted?.[0][0]).toBe('red');
  });

  it('toggles the tag menu, allows entering tags via TagInput, and emits edit-tag events', async () => {
    const wrapper = mount(BulkActionBar, {
      props: defaultProps,
    });

    const tagBtn = wrapper.find('button[title*="Tag"]');
    expect(tagBtn.exists()).toBe(true);

    // Toggle menu
    await tagBtn.trigger('click');

    // Menu should show TagInput component
    const tagInput = wrapper.findComponent({ name: 'TagInput' });
    expect(tagInput.exists()).toBe(true);

    // Input should be present
    const input = tagInput.find('input');
    expect(input.exists()).toBe(true);

    // Enter comma-separated tags
    await input.setValue('tag-a, tag-b');
    
    // Click the Plus button
    const plusBtn = wrapper.find('button.bg-theme-primary');
    expect(plusBtn.exists()).toBe(true);
    await plusBtn.trigger('click');

    // It should emit 'edit-tag' for each tag entered
    const emitted = wrapper.emitted('edit-tag');
    expect(emitted).toBeTruthy();
    expect(emitted?.length).toBe(2);
    expect(emitted?.[0][0]).toBe('tag-a');
    expect(emitted?.[0][1]).toBe(false);
    expect(emitted?.[1][0]).toBe('tag-b');
    expect(emitted?.[1][1]).toBe(false);
  });
});
