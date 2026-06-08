import { describe, it, expect, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ColumnEditModal from '@/components/modals/ColumnEditModal.vue';

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

  it('emits save and close events when close button is clicked (auto-save)', async () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const closeBtn = document.body.querySelector('button[class*="text-theme-text-muted"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(wrapper.emitted('save')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits save and close events when pressing Escape key (auto-save)', () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(wrapper.emitted('save')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits save and close events when clicking backdrop (auto-save)', async () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const backdrop = document.body.querySelector('.backdrop-blur-sm') as HTMLDivElement;
    expect(backdrop).not.toBeNull();
    backdrop.click();

    expect(wrapper.emitted('save')).toBeTruthy();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits close but does NOT emit save when Cancel button is clicked (discard)', async () => {
    wrapper = mount(ColumnEditModal, {
      props: defaultProps,
    });

    const cancelBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Cancel')
    ) as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();

    expect(wrapper.emitted('close')).toBeTruthy();
    expect(wrapper.emitted('save')).toBeFalsy();
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
      layout: 'list',
      max_tasks: null,
      is_default: false,
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
      layout: 'list',
      max_tasks: null,
      is_default: false,
    });
  });

  it('emits save event with selected layout when a layout segmented button is clicked', async () => {
    wrapper = mount(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialLayout: 'list',
      },
    });

    // In template: The grid buttons are inside a div of class "grid grid-cols-3..."
    const segmentedButtons = document.body.querySelectorAll('.grid-cols-3 button');
    expect(segmentedButtons.length).toBe(3);
    const grid2Btn = segmentedButtons[1] as HTMLButtonElement; // grid-2
    grid2Btn.click();
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
      color: null,
      layout: 'grid-2',
      max_tasks: null,
      is_default: false,
    });
  });

  it('emits save event with grid-3 layout when the third layout button is clicked', async () => {
    wrapper = mount(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialLayout: 'list',
      },
    });

    const segmentedButtons = document.body.querySelectorAll('.grid-cols-3 button');
    const grid3Btn = segmentedButtons[2] as HTMLButtonElement; // grid-3
    grid3Btn.click();
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
      color: null,
      layout: 'grid-3',
      max_tasks: null,
      is_default: false,
    });
  });

  it('emits save event with parsed max_tasks when max tasks limit is entered', async () => {
    wrapper = mount(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialMaxTasks: 3,
      },
    });

    const maxTasksInput = document.body.querySelector('input[type="number"]') as HTMLInputElement;
    expect(maxTasksInput).not.toBeNull();
    expect(maxTasksInput.value).toBe('3');

    maxTasksInput.value = '7';
    maxTasksInput.dispatchEvent(new Event('input'));
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
      color: null,
      layout: 'list',
      max_tasks: 7,
      is_default: false,
    });
  });
});
