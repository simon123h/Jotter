import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import { createTask, getLinkTitle } from '@/api';
import { createMockTask } from '@/__tests__/factories';
import TaskCreateModal from '@/features/task-editor/components/TaskCreateModal.vue';

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { projectId: 'work' } }) }));

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  createTask: vi.fn(() => Promise.resolve({})),
  getLinkTitle: vi.fn(),
}));

describe('TaskCreateModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    projectId: 'test-project',
    defaultBucket: 'todo' as const,
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    const projectStore = useProjectStore();
    projectStore.buckets = [
      { name: 'todo' as const, title: 'To Do', subtitle: '', position: 1, is_default: true },
      { name: 'done' as const, title: 'Done', subtitle: '', position: 2, is_default: false },
    ];
  });

  it('renders correctly when isOpen is true', () => {
    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
    });

    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Create New Task');
  });

  it('warns, without blocking, when the address in the title is already saved in the project', async () => {
    useProjectStore().tasks = [createMockTask({ id: 'a', title: 'Saved article', body: 'https://www.example.com/post/1' })];
    const wrapper = mount(TaskCreateModal, { props: defaultProps });
    expect(wrapper.find('[data-testid="duplicate-hint"]').exists()).toBe(false);

    await wrapper.find('input[type="text"]').setValue('https://example.com/post/1?utm_source=x');
    expect(wrapper.find('[data-testid="duplicate-hint"]').text()).toBe('Already saved: Saved article');

    await wrapper.find('input[type="text"]').setValue('https://example.com/post/2');
    expect(wrapper.find('[data-testid="duplicate-hint"]').exists()).toBe(false);
  });

  describe('the title of a pasted link', () => {
    const url = 'https://example.com/post/1';

    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(getLinkTitle).mockReset();
    });
    afterEach(() => vi.useRealTimers());

    async function paste(text: string) {
      const wrapper = mount(TaskCreateModal, { props: defaultProps });
      await wrapper.find('input[type="text"]').setValue(text);
      return wrapper;
    }
    const settle = async () => {
      await vi.advanceTimersByTimeAsync(600);
      await nextTick();
    };

    it('takes the title of the page and moves the address into the notes, when the setting is on', async () => {
      useSettingsStore().settings.lookUpLinkTitles = true;
      vi.mocked(getLinkTitle).mockResolvedValue('A good article');
      const wrapper = await paste(url);
      await settle();

      expect(getLinkTitle).toHaveBeenCalledWith(url);
      expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('A good article');
      await wrapper.find('form').trigger('submit');
      expect(createTask).toHaveBeenCalledWith('work', expect.objectContaining({ title: 'A good article', body: url }));
    });

    it('does nothing with the setting off, and keeps the address when the page cannot be read', async () => {
      const off = await paste(url);
      await settle();
      expect(getLinkTitle).not.toHaveBeenCalled();
      expect((off.find('input[type="text"]').element as HTMLInputElement).value).toBe(url);

      useSettingsStore().settings.lookUpLinkTitles = true;
      vi.mocked(getLinkTitle).mockResolvedValue(null);
      const failed = await paste('https://example.com/other');
      await settle();
      expect(getLinkTitle).toHaveBeenCalledTimes(1);
      expect((failed.find('input[type="text"]').element as HTMLInputElement).value).toBe('https://example.com/other');
      expect(failed.find('[data-testid="looking-up-title"]').exists()).toBe(false);
    });

    it('does not ask for a text that is more than an address, nor overwrite a title edited meanwhile', async () => {
      useSettingsStore().settings.lookUpLinkTitles = true;
      await paste(`Read ${url}`);
      await settle();
      expect(getLinkTitle).not.toHaveBeenCalled();

      let answer: (title: string) => void = () => undefined;
      vi.mocked(getLinkTitle).mockReturnValue(new Promise((resolve) => (answer = resolve)));
      const wrapper = await paste(url);
      await vi.advanceTimersByTimeAsync(600);
      expect(wrapper.find('[data-testid="looking-up-title"]').exists()).toBe(true);
      await wrapper.find('input[type="text"]').setValue('My own title');
      answer('A good article');
      await settle();
      expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('My own title');
    });
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

  it('shows autocomplete popup when typing "/"', async () => {
    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = wrapper.find('input[type="text"]');
    await titleInput.setValue('/');
    await titleInput.trigger('input');
    await nextTick();

    // Check if the autocomplete list is shown
    expect(wrapper.text()).toContain('To Do');
    expect(wrapper.text()).toContain('/todo');
    expect(wrapper.text()).toContain('Done');
    expect(wrapper.text()).toContain('/done');
  });

  it('filters autocomplete list by input search text', async () => {
    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = wrapper.find('input[type="text"]');
    await titleInput.setValue('/don');
    await titleInput.trigger('input');
    await nextTick();

    expect(wrapper.text()).not.toContain('/todo');
    expect(wrapper.text()).toContain('/done');
  });

  it('selects autocomplete item on click/mousedown', async () => {
    const wrapper = mount(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = wrapper.find('input[type="text"]');
    await titleInput.setValue('/don');
    // Set selectionStart to simulate caret position
    const inputEl = titleInput.element as HTMLInputElement;
    inputEl.selectionStart = 4;
    inputEl.selectionEnd = 4;

    await titleInput.trigger('input');
    await nextTick();

    const options = wrapper.findAll('div[class*="cursor-pointer"]');
    // Click on the first option (which should be /done because of filtering)
    await options[0].trigger('mousedown');
    await nextTick();

    expect(inputEl.value).toBe('/done ');
  });
});
