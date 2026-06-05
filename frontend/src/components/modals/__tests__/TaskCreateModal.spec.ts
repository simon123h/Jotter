import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TaskCreateModal from '@/components/modals/TaskCreateModal.svelte';

describe('TaskCreateModal.svelte', () => {
  const defaultProps = {
    isOpen: true,
    projectId: 'test-project',
    defaultBucket: 'todo' as const,
    buckets: [
      { name: 'todo' as const, title: 'To Do' },
      { name: 'done' as const, title: 'Done' },
    ],
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders correctly when isOpen is true', () => {
    const { container } = render(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = container.querySelector('input[type="text"]');
    expect(titleInput).not.toBeNull();
    expect(container.textContent).toContain('Create New Task');
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(TaskCreateModal, {
      props: {
        ...defaultProps,
        isOpen: false,
      },
    });

    const titleInput = container.querySelector('input[type="text"]');
    expect(titleInput).toBeNull();
  });

  it('focuses the title input field when opened', async () => {
    const { container, unmount } = render(TaskCreateModal, {
      props: defaultProps,
    });

    // Wait for the focus tick in onMount/tick
    await new Promise((resolve) => setTimeout(resolve, 50));

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(document.activeElement).toBe(titleInput);

    unmount();
  });

  it('invokes onclose callback when pressing Escape key', () => {
    const onclose = vi.fn();
    render(TaskCreateModal, {
      props: {
        ...defaultProps,
        onclose,
      },
    });

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    expect(onclose).toHaveBeenCalled();
  });

  it('shows autocomplete popup when typing "/"', async () => {
    const { container } = render(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput).not.toBeNull();

    titleInput.value = '/';
    await fireEvent.input(titleInput);

    // Check if the autocomplete list is shown
    expect(container.textContent).toContain('To Do');
    expect(container.textContent).toContain('/todo');
    expect(container.textContent).toContain('Done');
    expect(container.textContent).toContain('/done');
  });

  it('filters autocomplete list by input search text', async () => {
    const { container } = render(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput).not.toBeNull();

    titleInput.value = '/don';
    await fireEvent.input(titleInput);

    expect(container.textContent).not.toContain('/todo');
    expect(container.textContent).toContain('/done');
  });

  it('selects autocomplete item on mousedown', async () => {
    const { container } = render(TaskCreateModal, {
      props: defaultProps,
    });

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput).not.toBeNull();

    titleInput.value = '/don';
    titleInput.selectionStart = 4;
    titleInput.selectionEnd = 4;
    await fireEvent.input(titleInput);

    // Click/mousedown on the autocomplete option
    const option = container.querySelector('div[class*="cursor-pointer"]') as HTMLDivElement;
    expect(option).not.toBeNull();
    await fireEvent.mouseDown(option);

    expect(titleInput.value).toBe('/done ');
  });
});
