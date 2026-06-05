import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ColumnEditModal from '@/components/modals/ColumnEditModal.svelte';

describe('ColumnEditModal.svelte', () => {
  const defaultProps = {
    isOpen: true,
    bucketName: 'todo',
    initialTitle: 'To Do',
    initialSubtitle: 'Tasks that need to be done',
  };

  afterEach(() => {
    // Clean up JSDOM body to avoid leakage between tests
    document.body.innerHTML = '';
  });

  it('renders correctly when isOpen is true', () => {
    render(ColumnEditModal, {
      props: defaultProps,
    });

    const titleInput = document.body.querySelector('input[type="text"]');
    expect(titleInput).not.toBeNull();
    expect(document.body.textContent).toContain('Edit Column Details');
  });

  it('does not render when isOpen is false', () => {
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
    });

    const titleInput = document.body.querySelector('input[type="text"]');
    expect(titleInput).toBeNull();
  });

  it('invokes onclose callback when close button is clicked', async () => {
    const onclose = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        onclose,
      },
    });

    const closeBtn = document.body.querySelector('button[class*="text-theme-text-muted"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    await fireEvent.click(closeBtn);

    expect(onclose).toHaveBeenCalled();
  });

  it('invokes onclose callback when pressing Escape key', () => {
    const onclose = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        onclose,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(onclose).toHaveBeenCalled();
  });

  it('invokes onsave callback with updated title and subtitle when saved', async () => {
    const onsave = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        onsave,
      },
    });

    const inputs = document.body.querySelectorAll('input[type="text"]');
    const titleInput = inputs[0] as HTMLInputElement;
    const subtitleInput = inputs[1] as HTMLInputElement;

    titleInput.value = 'Refined To Do';
    await fireEvent.input(titleInput);
    subtitleInput.value = 'Tasks ready for sprint';
    await fireEvent.input(subtitleInput);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    await fireEvent.click(saveBtn);

    expect(onsave).toHaveBeenCalled();
    expect(onsave).toHaveBeenCalledWith({
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
    render(ColumnEditModal, {
      props: defaultProps,
    });

    const titleInput = document.body.querySelectorAll('input[type="text"]')[0] as HTMLInputElement;
    titleInput.value = '';
    await fireEvent.input(titleInput);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn.disabled).toBe(true);
  });

  it('handles null or undefined initialSubtitle without throwing errors', () => {
    render(ColumnEditModal, {
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

  it('invokes onsave callback with selected color when a color swatch is clicked', async () => {
    const onsave = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialColor: null,
        onsave,
      },
    });

    // Find the red color swatch button (the bg-rose-500 one)
    const colorBtn = document.body.querySelector('button.bg-rose-500') as HTMLButtonElement;
    expect(colorBtn).not.toBeNull();
    await fireEvent.click(colorBtn);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    await fireEvent.click(saveBtn);

    expect(onsave).toHaveBeenCalled();
    expect(onsave).toHaveBeenCalledWith({
      bucketName: 'todo',
      title: 'To Do',
      subtitle: 'Tasks that need to be done',
      color: 'red',
      layout: 'list',
      max_tasks: null,
      is_default: false,
    });
  });

  it('invokes onsave callback with selected layout when a layout segmented button is clicked', async () => {
    const onsave = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialLayout: 'list',
        onsave,
      },
    });

    // In template: The grid buttons are inside a div of class "grid grid-cols-3..."
    const segmentedButtons = document.body.querySelectorAll('.grid-cols-3 button');
    expect(segmentedButtons.length).toBe(3);
    const grid2Btn = segmentedButtons[1] as HTMLButtonElement; // grid-2
    await fireEvent.click(grid2Btn);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    await fireEvent.click(saveBtn);

    expect(onsave).toHaveBeenCalled();
    expect(onsave).toHaveBeenCalledWith({
      bucketName: 'todo',
      title: 'To Do',
      subtitle: 'Tasks that need to be done',
      color: null,
      layout: 'grid-2',
      max_tasks: null,
      is_default: false,
    });
  });

  it('invokes onsave callback with grid-3 layout when the third layout button is clicked', async () => {
    const onsave = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialLayout: 'list',
        onsave,
      },
    });

    const segmentedButtons = document.body.querySelectorAll('.grid-cols-3 button');
    const grid3Btn = segmentedButtons[2] as HTMLButtonElement; // grid-3
    await fireEvent.click(grid3Btn);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    await fireEvent.click(saveBtn);

    expect(onsave).toHaveBeenCalled();
    expect(onsave).toHaveBeenCalledWith({
      bucketName: 'todo',
      title: 'To Do',
      subtitle: 'Tasks that need to be done',
      color: null,
      layout: 'grid-3',
      max_tasks: null,
      is_default: false,
    });
  });

  it('invokes onsave callback with parsed max_tasks when max tasks limit is entered', async () => {
    const onsave = vi.fn();
    render(ColumnEditModal, {
      props: {
        ...defaultProps,
        initialMaxTasks: 3,
        onsave,
      },
    });

    const maxTasksInput = document.body.querySelector('input[type="number"]') as HTMLInputElement;
    expect(maxTasksInput).not.toBeNull();
    expect(maxTasksInput.value).toBe('3');

    maxTasksInput.value = '7';
    await fireEvent.input(maxTasksInput);

    const saveBtn = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save Changes')
    ) as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();
    await fireEvent.click(saveBtn);

    expect(onsave).toHaveBeenCalled();
    expect(onsave).toHaveBeenCalledWith({
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
