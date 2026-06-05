import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import FilterModal from '@/components/modals/FilterModal.svelte';
import { settingsStore } from '@/stores/settings';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

beforeEach(() => {
  localStorage.clear();
  settingsStore.hideDoneColumn = true;
  settingsStore.isSidebarOpen = true;
  settingsStore.currentTheme = 'nordic-light';
  settingsStore.viewMode = 'board';
  settingsStore.activeProjectId = 'default';
  settingsStore.thresholdDays = 7;
  settingsStore.pinnedProjectIds = [];
  settingsStore.sortBy = 'alpha';
});

describe('FilterModal.svelte', () => {
  const defaultProps = {
    isOpen: true,
    buckets: [
      { name: 'todo', title: 'To Do', subtitle: '', position: 1 },
      { name: 'in-progress', title: 'In Progress', subtitle: '', position: 2 },
      { name: 'done', title: 'Done', subtitle: '', position: 3 },
    ],
    allTags: ['bug', 'ui', 'refactor'],
    currentFilters: {},
  };

  it('renders correctly when isOpen is true', () => {
    const { getByPlaceholderText, container } = render(FilterModal, {
      props: defaultProps,
    });

    expect(container.textContent).toContain('Filter Tasks');
    expect(getByPlaceholderText('Search in title and description...')).toBeDefined();
    expect(container.textContent).toContain('To Do');
    expect(container.textContent).toContain('In Progress');
    expect(container.textContent).toContain('bug');
    expect(container.textContent).toContain('ui');
  });

  it('invokes onclose callback when clicking close button', async () => {
    const onclose = vi.fn();
    render(FilterModal, {
      props: {
        ...defaultProps,
        onclose,
      },
    });

    // Find the button inside the header that handles close
    const closeBtn = document.body.querySelector('button[class*="text-theme-text-muted"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    await fireEvent.click(closeBtn);
    expect(onclose).toHaveBeenCalled();
  });

  it('invokes onapply callback with selected filters', async () => {
    const onapply = vi.fn();
    const { getByPlaceholderText, getByText } = render(FilterModal, {
      props: {
        ...defaultProps,
        onapply,
      },
    });

    // Enter search text
    const searchInput = getByPlaceholderText('Search in title and description...') as HTMLInputElement;
    searchInput.value = 'Refactor code';
    await fireEvent.input(searchInput);

    // Click Apply button
    const applyBtn = getByText('Apply Filters');
    expect(applyBtn).toBeDefined();
    await fireEvent.click(applyBtn);

    expect(onapply).toHaveBeenCalled();
    expect(onapply).toHaveBeenCalledWith({
      search: 'Refactor code',
      buckets: undefined,
      priorities: undefined,
      tags: undefined,
      tag_mode: undefined,
      has_due_date: null,
      due_after: undefined,
      due_before: undefined,
    });
  });

  it('clears all filters when clicking clear button', async () => {
    const { getByPlaceholderText, getByText } = render(FilterModal, {
      props: {
        ...defaultProps,
        currentFilters: {
          search: 'Some search',
          buckets: 'todo',
          priorities: 'high',
        },
      },
    });

    const searchInput = getByPlaceholderText('Search in title and description...') as HTMLInputElement;
    expect(searchInput.value).toBe('Some search');

    // Trigger clear
    const clearBtn = getByText('Clear Filters');
    expect(clearBtn).toBeDefined();
    await fireEvent.click(clearBtn);

    expect(searchInput.value).toBe('');
  });

  it('updates settingsStore.hideDoneColumn when applied', async () => {
    settingsStore.hideDoneColumn = false;

    const { getByText } = render(FilterModal, {
      props: defaultProps,
    });

    const checkbox = document.getElementById('hide-done-column-checkbox') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);

    checkbox.checked = true;
    await fireEvent.change(checkbox);

    const applyBtn = getByText('Apply Filters');
    expect(applyBtn).toBeDefined();
    await fireEvent.click(applyBtn);

    expect(settingsStore.hideDoneColumn).toBe(true);
  });
});
