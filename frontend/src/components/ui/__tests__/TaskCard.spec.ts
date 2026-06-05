import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TaskCard from '@/components/ui/TaskCard.svelte';
import type { Task } from '@/types';

describe('TaskCard.svelte', () => {
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
    const { getByText } = render(TaskCard, {
      props: {
        task: mockTask,
      },
    });

    expect(getByText('Test Task Title')).toBeDefined();
  });

  it('renders tags lists properly', () => {
    const { container } = render(TaskCard, {
      props: {
        task: mockTask,
      },
    });

    const tags = container.querySelectorAll('span.border');
    expect(tags).toHaveLength(2);
    expect(tags[0].textContent?.trim()).toBe('bug');
    expect(tags[1].textContent?.trim()).toBe('frontend');
  });

  it('invokes onclick callback when card is clicked', async () => {
    const onclick = vi.fn();
    const { getByText } = render(TaskCard, {
      props: {
        task: mockTask,
        onclick,
      },
    });

    await fireEvent.click(getByText('Test Task Title'));

    expect(onclick).toHaveBeenCalled();
    expect(onclick).toHaveBeenCalledWith(mockTask);
  });

  it('invokes onmarkdone callback when the checkmark button is clicked', async () => {
    const onmarkdone = vi.fn();
    const { getByTitle } = render(TaskCard, {
      props: {
        task: mockTask,
        onmarkdone,
      },
    });

    const markDoneBtn = getByTitle('Mark as done');
    expect(markDoneBtn).toBeDefined();

    await fireEvent.click(markDoneBtn);

    expect(onmarkdone).toHaveBeenCalled();
    expect(onmarkdone).toHaveBeenCalledWith(mockTask);
  });

  it('does not render checkmark button if task is in the done bucket', () => {
    const doneTask = { ...mockTask, bucket: 'done' };
    const { queryByTitle } = render(TaskCard, {
      props: {
        task: doneTask,
      },
    });

    const markDoneBtn = queryByTitle('Mark as done');
    expect(markDoneBtn).toBeNull();
  });
});
