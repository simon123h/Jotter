import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import TagInput from '../TagInput.vue';
import { useProjectStore } from '@/stores/project';

describe('TagInput.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders input field with placeholder', () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug, feature',
        placeholder: 'Enter tags...',
      },
    });

    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    expect(input.element.placeholder).toBe('Enter tags...');
    expect(input.element.value).toBe('bug, feature');
  });

  it('filters tag suggestions based on input', async () => {
    const store = useProjectStore();
    store.tasks = [
      { id: '1', title: 'Task 1', tags: ['frontend', 'bug'] },
      { id: '2', title: 'Task 2', tags: ['backend', 'feature'] },
    ];

    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug, ',
      },
    });

    // Existing tags should be populated
    expect(wrapper.vm.existingTags).toEqual(['backend', 'bug', 'feature', 'frontend']);

    // Trigger input focus to open dropdown
    const input = wrapper.find('input');
    await input.trigger('focus');

    // Suggestions should exclude 'bug' (already present in modelValue)
    expect(wrapper.vm.tagSuggestions).toEqual(['backend', 'feature', 'frontend']);
  });

  it('selects suggestion on click', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug, f',
        suggestionsOverride: ['frontend', 'feature', 'docs'],
      },
    });

    const input = wrapper.find('input');
    await input.trigger('focus');

    expect(wrapper.vm.tagSuggestions).toEqual(['frontend', 'feature']);

    // Mock select suggestion method directly
    wrapper.vm.selectTagSuggestion('frontend');

    // Emits update event with 'bug, frontend, '
    expect(wrapper.emitted('update:modelValue')?.[0][0]).toBe('bug, frontend, ');
  });

  it('handles keyboard navigation in suggestions dropdown', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug, f',
        suggestionsOverride: ['frontend', 'feature'],
      },
    });

    const input = wrapper.find('input');
    await input.trigger('focus');

    // Initially active index is 0
    expect(wrapper.vm.activeSuggestionIndex).toBe(0);

    // Arrow down moves index to 1
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.vm.activeSuggestionIndex).toBe(1);

    // Arrow up moves index back to 0
    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.vm.activeSuggestionIndex).toBe(0);

    // Enter selects active suggestion
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('update:modelValue')?.[0][0]).toBe('bug, frontend, ');
  });

  it('closes dropdown on Escape key', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug, f',
        suggestionsOverride: ['frontend', 'feature'],
      },
    });

    const input = wrapper.find('input');
    await input.trigger('focus');
    expect(wrapper.vm.isDropdownOpen).toBe(true);

    await input.trigger('keydown', { key: 'Escape' });
    expect(wrapper.vm.isDropdownOpen).toBe(false);
  });

  it('selects suggestion on Tab key', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug, f',
        suggestionsOverride: ['frontend', 'feature'],
      },
    });

    const input = wrapper.find('input');
    await input.trigger('focus');

    await input.trigger('keydown', { key: 'Tab' });
    expect(wrapper.emitted('update:modelValue')?.[0][0]).toBe('bug, frontend, ');
  });

  it('triggers enter event when dropdown is closed', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug',
      },
    });

    const input = wrapper.find('input');
    await input.trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('enter')).toBeTruthy();
  });

  it('triggers blur event and closes dropdown', async () => {
    const wrapper = mount(TagInput, {
      props: {
        modelValue: 'bug',
      },
    });

    const input = wrapper.find('input');
    await input.trigger('focus');
    expect(wrapper.vm.isDropdownOpen).toBe(true);

    await input.trigger('blur');
    expect(wrapper.vm.isDropdownOpen).toBe(false);
    expect(wrapper.emitted('blur')).toBeTruthy();
  });

  it('exposes focus method', () => {
    const wrapper = mount(TagInput, {
      props: { modelValue: '' },
    });
    expect(typeof wrapper.vm.focus).toBe('function');
  });
});
