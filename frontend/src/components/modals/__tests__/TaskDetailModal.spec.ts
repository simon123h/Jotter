import { beforeAll, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TaskDetailModal from '@/components/modals/TaskDetailModal.vue';
import { updateTask } from '@/api';

beforeAll(() => {
  setActivePinia(createPinia());
});

let mockRouteLeaveCallback: any = null;

// Mock getTask API
vi.mock('@/api', () => ({
  getTask: vi.fn().mockResolvedValue({
    id: '123',
    project_id: 'default',
    title: 'Test Task',
    body: '# Header\n- [ ] Todo item\nSome description',
    bucket: 'todo',
    position: 1,
    tags: [],
    attachments: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getAttachmentUrl: vi.fn(),
}));

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      projectId: 'default',
      taskId: '123',
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
  onBeforeRouteLeave: (cb: any) => {
    mockRouteLeaveCallback = cb;
  },
}));

describe('TaskDetailModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    projectId: 'default',
    taskId: '123',
    buckets: [],
    existingTags: [],
  };

  it('renders parsed markdown correctly', async () => {
    const wrapper = mount(TaskDetailModal, {
      props: defaultProps,
      global: {
        stubs: {
          MarkdownEditor: true,
        },
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50)); // let async api fetch complete
    await nextTick();

    const markdownDiv = wrapper.find('.markdown-content');
    expect(markdownDiv.exists()).toBe(true);
    expect(markdownDiv.html()).toContain('<h1>Header</h1>');
    expect(markdownDiv.html()).toContain('type="checkbox"');
    expect(markdownDiv.html()).toContain('data-checkbox-index="0"');
  });

  it('saves changes on route leave if editing with a valid title', async () => {
    const wrapper = mount(TaskDetailModal, {
      props: defaultProps,
      global: {
        stubs: {
          MarkdownEditor: true,
        },
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50)); // let API fetch complete
    await nextTick();

    // Click edit button
    const editBtn = wrapper.findAll('button').find((b) => b.text().includes('Edit'));
    expect(editBtn).toBeDefined();
    await editBtn!.trigger('click');
    await nextTick();

    // Find the title input and set its value
    const input = wrapper.find('input[type="text"]');
    if (input.exists()) {
      await input.setValue('New Valid Title');
    }

    // Set mock resolved value for updateTask to prevent errors
    vi.mocked(updateTask).mockResolvedValue({
      id: '123',
      title: 'New Valid Title',
      tags: [],
      bucket: 'todo',
      body: 'Some description',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    // Trigger the captured route leave callback
    expect(mockRouteLeaveCallback).toBeTypeOf('function');
    const result = await mockRouteLeaveCallback();

    // Expect the updateTask API to have been called with the new title
    expect(updateTask).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('cancels edits and does not save on route leave if the title is empty', async () => {
    const wrapper = mount(TaskDetailModal, {
      props: defaultProps,
      global: {
        stubs: {
          MarkdownEditor: true,
        },
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50)); // let API fetch complete
    await nextTick();

    // Click edit button
    const editBtn = wrapper.findAll('button').find((b) => b.text().includes('Edit'));
    await editBtn!.trigger('click');
    await nextTick();

    // Find the title input and set it to empty spaces
    const input = wrapper.find('input[type="text"]');
    if (input.exists()) {
      await input.setValue('   ');
    }

    // Clear previous mock calls
    vi.mocked(updateTask).mockClear();

    // Trigger route leave callback
    expect(mockRouteLeaveCallback).toBeTypeOf('function');
    const result = await mockRouteLeaveCallback();

    // Expect updateTask NOT to have been called and result to be true
    expect(updateTask).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
