import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskCard from '@/components/ui/TaskCard.vue';
import type { Task } from '@/types';

describe('TaskCard.vue', () => {
  const mockTask: Task = {
    id: '123',
    project_id: 'default',
    title: 'Test Task Title',
    body: 'Test Task Body',
    bucket: 'todo',
    position: 1.0,
    tags: ['bug', 'frontend'],
    created_at: '2026-05-30T20:00:00Z',
    updated_at: '2026-05-30T20:00:00Z',
  };

  it('renders task title correctly', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: mockTask,
      },
    });

    expect(wrapper.text()).toContain('Test Task Title');
  });

  it('renders tags lists properly', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: mockTask,
      },
    });

    const tags = wrapper.findAll('span.border');
    expect(tags).toHaveLength(2);
    expect(tags[0].text()).toBe('bug');
    expect(tags[1].text()).toBe('frontend');
  });

  it('emits click event on click', async () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: mockTask,
      },
    });

    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toBeTruthy();
    expect(wrapper.emitted('click')?.[0]).toEqual([mockTask]);
  });

  it('emits mark-done event when the checkmark button is clicked', async () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: mockTask,
      },
    });

    const markDoneBtn = wrapper.find('button[title="Mark as done"]');
    expect(markDoneBtn.exists()).toBe(true);

    await markDoneBtn.trigger('click');

    expect(wrapper.emitted('mark-done')).toBeTruthy();
    expect(wrapper.emitted('mark-done')?.[0]).toEqual([mockTask]);
  });

  it('does not render checkmark button if task is in the done bucket', () => {
    const doneTask = { ...mockTask, bucket: 'done' };
    const wrapper = mount(TaskCard, {
      props: {
        task: doneTask,
      },
    });

    const markDoneBtn = wrapper.find('button[title="Mark as done"]');
    expect(markDoneBtn.exists()).toBe(false);
  });
});
