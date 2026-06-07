import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TaskDetailModal from '@/components/modals/TaskDetailModal.vue';

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
});
