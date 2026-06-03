import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TaskCreateModal from '../TaskCreateModal.vue';

describe('TaskCreateModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    projectId: 'test-project',
    defaultBucket: 'todo' as const,
    buckets: [
      { name: 'todo' as const, title: 'To Do' },
      { name: 'done' as const, title: 'Done' },
    ],
  };

  it('renders correctly when isOpen is true', () => {
    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
    });

    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Create New Task');
  });

  it('does not render when isOpen is false', () => {
    const wrapper = mount(TaskCreateModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
    });

    expect(wrapper.find('input[type="text"]').exists()).toBe(false);
  });

  it('focuses the title input field when opened', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
      attachTo: el,
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0)); // wait for focus tick

    const titleInput = wrapper.find('input[type="text"]').element as HTMLInputElement;
    expect(document.activeElement).toBe(titleInput);

    wrapper.unmount();
    el.remove();
  });

  it('emits close event when pressing Escape key', () => {
    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
