import { describe, it, expect, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ColumnEditModal from '../ColumnEditModal.vue';

describe('ColumnEditModal.vue', () => {
  const defaultProps = {
    isOpen: true,
    bucketName: 'todo',
    initialTitle: 'To Do',
    initialSubtitle: 'Tasks that need to be done',
  };

  let wrapper: VueWrapper<any> | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
    // Clean up JSDOM body to avoid leakage between tests
    document.body.innerHTML = '';
  });

  it('renders correctly when isOpen is true', () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const titleInput = document.body.querySelector('input[type="text"]');
    expect(titleInput).not.toBeNull();
    expect(document.body.textContent).toContain('Edit Column Details');
  });

  it('does not render when isOpen is false', () => {
    wrapper = mount(ColumnEditModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
    });

    const titleInput = document.body.querySelector('input[type="text"]');
    expect(titleInput).toBeNull();
  });

  it('emits close event when close button is clicked', async () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const closeBtn = document.body.querySelector('button[class*="text-theme-text-muted"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close event when pressing Escape key', () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits save event with updated title and subtitle when saved', async () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const inputs = document.body.querySelectorAll('input[type="text"]');
    const titleInput = inputs[0] as HTMLInputElement;
    const subtitleInput = inputs[1] as HTMLInputElement;

    titleInput.value = 'Refined To Do';
    titleInput.dispatchEvent(new Event('input'));
    subtitleInput.value = 'Tasks ready for sprint';
    subtitleInput.dispatchEvent(new Event('input'));
    await nextTick();

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    saveBtn.click();

    expect(wrapper.emitted('save')).toBeTruthy();
    expect(wrapper.emitted('save')?.[0][0]).toEqual({
      bucketName: 'todo',
      title: 'Refined To Do',
      subtitle: 'Tasks ready for sprint',
      color: null,
    });
  });

  it('disables save button if title is empty', async () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const titleInput = document.body.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
    titleInput.value = '';
    titleInput.dispatchEvent(new Event('input'));
    await nextTick();

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.disabled).toBe(true);
  });

  it('handles null or undefined initialSubtitle without throwing errors', () => {
    wrapper = mount(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialSubtitle: null,
      },
    });

    const titleInput = document.body.querySelector('input[type="text"]');
    expect(titleInput).not.toBeNull();
    const subtitleInput = document.body.querySelectorAll('input[type="text"]')[1] as HTMLInputElement;
    expect(subtitleInput.value).toBe('');
  });

  it('emits save event with selected color when a color swatch is clicked', async () => {
    wrapper = mount(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialColor: null,
      },
    });

    // Find the red color swatch button (the bg-rose-500 one)
    const colorBtn = document.body.querySelector('button.bg-rose-500') as HTMLButtonElement;
    expect(colorBtn).not.toBeNull();
    colorBtn.click();
    await nextTick();

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    saveBtn.click();

    expect(wrapper.emitted('save')).toBeTruthy();
    expect(wrapper.emitted('save')?.[0][0]).toEqual({
      bucketName: 'todo',
      title: 'To Do',
      subtitle: 'Tasks that need to be done',
      color: 'red',
    });
  });
});
