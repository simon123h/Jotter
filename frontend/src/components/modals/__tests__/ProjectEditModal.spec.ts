import { beforeAll, afterEach, describe, it, expect, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ProjectEditModal from '@/components/modals/ProjectEditModal.vue';
import { updateProject, deleteProject } from '@/api';

// Set up Pinia
beforeAll(() => {
  setActivePinia(createPinia());
});

// Mock API functions
vi.mock('@/api', () => ({
  getProjects: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn().mockResolvedValue({}),
  deleteProject: vi.fn().mockResolvedValue({}),
}));

// Mock useDialog
vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showDialog: vi.fn().mockResolvedValue(true),
  }),
}));

describe('ProjectEditModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    project: {
      id: 'proj-123',
      title: 'Our Awesome Project',
      done_clean_period: 14,
      git_remote: 'git@github.com:user/repo.git',
      created_at: '2026-06-01T12:00:00Z',
      updated_at: '2026-06-01T12:00:00Z',
    },
  };

  let wrapper: VueWrapper<any> | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
    vi.clearAllMocks();
  });

  it('renders correctly when isOpen is true', () => {
    wrapper = mount(ProjectEditModal, {
      props: defaultProps,
    });

    const titleInput = wrapper.find('input[type="text"]');
    expect(titleInput.exists()).toBe(true);
    expect((titleInput.element as HTMLInputElement).value).toBe('Our Awesome Project');
    expect(wrapper.text()).toContain('Edit Project Settings');
  });

  it('does not render when isOpen is false', () => {
    wrapper = mount(ProjectEditModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
    });

    const titleInput = wrapper.find('input[type="text"]');
    expect(titleInput.exists()).toBe(false);
  });

  it('calls updateProject and emits close on close button click (auto-save)', async () => {
    wrapper = mount(ProjectEditModal, {
      props: defaultProps,
    });

    const closeBtn = wrapper.find('button[class*="text-theme-text-muted"]');
    expect(closeBtn.exists()).toBe(true);
    await closeBtn.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(updateProject).toHaveBeenCalledWith('proj-123', {
      title: 'Our Awesome Project',
      done_clean_period: 14,
      git_remote: 'git@github.com:user/repo.git',
    });
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('calls updateProject and emits close when pressing Escape key (auto-save)', async () => {
    wrapper = mount(ProjectEditModal, {
      props: defaultProps,
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(updateProject).toHaveBeenCalledWith('proj-123', {
      title: 'Our Awesome Project',
      done_clean_period: 14,
      git_remote: 'git@github.com:user/repo.git',
    });
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('calls updateProject and emits close on backdrop click (auto-save)', async () => {
    wrapper = mount(ProjectEditModal, {
      props: defaultProps,
    });

    const backdrop = wrapper.find('.backdrop-blur-sm');
    expect(backdrop.exists()).toBe(true);
    await backdrop.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(updateProject).toHaveBeenCalledWith('proj-123', {
      title: 'Our Awesome Project',
      done_clean_period: 14,
      git_remote: 'git@github.com:user/repo.git',
    });
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close but does NOT call updateProject when Cancel button is clicked (discard)', async () => {
    wrapper = mount(ProjectEditModal, {
      props: defaultProps,
    });

    const cancelBtn = wrapper.findAll('button').find((btn) =>
      btn.text().includes('Cancel')
    );
    expect(cancelBtn).toBeDefined();
    await cancelBtn!.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(updateProject).not.toHaveBeenCalled();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('calls deleteProject and emits close when Delete button is clicked', async () => {
    wrapper = mount(ProjectEditModal, {
      props: defaultProps,
    });

    const deleteBtn = wrapper.findAll('button').find((btn) =>
      btn.text().includes('Delete')
    );
    expect(deleteBtn).toBeDefined();
    await deleteBtn!.trigger('click');
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await nextTick();

    expect(deleteProject).toHaveBeenCalledWith('proj-123');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
