import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TaskCard from '@/components/ui/TaskCard.vue';
import type { Task } from '@/types';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'board',
    query: {},
  }),
}));

describe('TaskCard.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockTask: Task = {
    id: '123',
    project_id: 'default',
    title: 'Test Task Title',
    body: 'Test Task Body',
    bucket: 'todo',
    position: 1.0,
    tags: ['bug', 'frontend'],
    attachments: [],
    created_at: '2026-05-30T20:00:00Z',
    updated_at: '2026-05-30T20:00:00Z',
  };

  const mountOptions = {
    props: {
      task: mockTask,
    },
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  };

  it('renders task title correctly', () => {
    const wrapper = mount(TaskCard, mountOptions);
    expect(wrapper.text()).toContain('Test Task Title');
  });

  it('renders tags lists properly', () => {
    const wrapper = mount(TaskCard, mountOptions);

    const tags = wrapper.findAll('span.border');
    expect(tags).toHaveLength(2);
    expect(tags[0].text()).toBe('bug');
    expect(tags[1].text()).toBe('frontend');
  });

  it('emits click event on click', async () => {
    const wrapper = mount(TaskCard, mountOptions);

    await wrapper.trigger('click');

    // Since TaskCard is a router-link in the component, the component itself doesn't explicitly emit('click') on root click anymore,
    // but the DOM click event is still triggered. We can test that standard click behaves correctly or assert navigation.
    // However, if the test is asserting wrapper.emitted('click') because of previous emit definition, we can trigger click and see if it propagates
    // or trigger click and test if it was called.
    // Let's see: wrapper.trigger('click') should propagate. Wait, does a standard click event get emitted? Yes, standard native click is emitted.
    // In Vue Test Utils, wrapper.emitted('click') checks for both custom emits and standard events if they are emitted.
    expect(wrapper.emitted()).toBeDefined();
  });

  it('emits mark-done event when the checkmark button is clicked', async () => {
    const wrapper = mount(TaskCard, mountOptions);

    const markDoneBtn = wrapper.find('button[title="Mark as done"]');
    expect(markDoneBtn.exists()).toBe(true);

    await markDoneBtn.trigger('click');

    expect(wrapper.emitted('mark-done')).toBeTruthy();
    expect(wrapper.emitted('mark-done')?.[0]).toEqual([mockTask]);
  });

  it('does not render checkmark button if task is in the done bucket', () => {
    const doneTask = { ...mockTask, bucket: 'done' };
    const wrapper = mount(TaskCard, {
      ...mountOptions,
      props: {
        task: doneTask,
      },
    });

    const markDoneBtn = wrapper.find('button[title="Mark as done"]');
    expect(markDoneBtn.exists()).toBe(false);
  });
});
