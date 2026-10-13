import { effectScope, nextTick, reactive, ref } from 'vue';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTaskFilters } from '@/composables/useTaskFilters';
import { useProjectStore } from '@/stores/project';
import { createMockTask } from '@/__tests__/factories';
import type { Task } from '@/types';

// The URL: a reactive route whose query the composable reads and replaces
const route = reactive<{ query: Record<string, string> }>({ query: {} });
const replace = vi.fn(({ query }: { query: Record<string, string> }) => {
  route.query = query;
});
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace }),
}));

const tasks: Task[] = [
  createMockTask({
    id: 'a',
    title: 'Buy milk',
    body: 'Whole milk, two litres',
    bucket: 'todo',
    priority: 'high',
    tags: ['shopping', 'home'],
    due_date: '2026-10-20',
    project_id: 'home',
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-05T10:00:00.000Z',
  }),
  createMockTask({
    id: 'b',
    title: 'Write report',
    body: '',
    bucket: 'doing',
    priority: 'low',
    tags: ['work'],
    due_date: '2026-11-02',
    project_id: 'work',
    created_at: '2026-09-15T10:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.000Z',
  }),
  createMockTask({
    id: 'c',
    title: 'Call Pia',
    body: 'about the MILK delivery',
    bucket: 'todo',
    tags: ['home', 'work'],
    project_id: 'work',
    created_at: '2026-10-10T08:00:00.000Z',
    updated_at: '2026-10-10T08:00:00.000Z',
  }),
];

/** Runs the composable in a scope, as a component would, and settles the watchers. */
const scopes: Array<ReturnType<typeof effectScope>> = [];
const setup = (options?: { syncRoute?: boolean }) => {
  const scope = effectScope();
  scopes.push(scope);
  const filters = scope.run(() => useTaskFilters(ref(tasks), options))!;
  return { filters, scope };
};
const ids = (list: Task[]) => list.map((t) => t.id);

describe('useTaskFilters', () => {
  afterEach(() => {
    // The watchers of earlier tests would answer to the address of this one
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    route.query = {};
    replace.mockClear();
  });

  describe('filtering the tasks', () => {
    it('keeps every task while nothing is asked for', async () => {
      const { filters } = setup();
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'b', 'c']);
      expect(filters.hasActiveFilters.value).toBe(false);
    });

    it('searches title and body, ignoring case', async () => {
      const { filters } = setup();
      filters.applyFilters({ search: 'milk' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'c']);
      expect(filters.hasActiveFilters.value).toBe(true);
    });

    it('filters by buckets and priorities (none for tasks without one)', async () => {
      const { filters } = setup();
      filters.applyFilters({ buckets: 'todo, DOING' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'b', 'c']);

      filters.applyFilters({ buckets: 'doing' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['b']);

      filters.applyFilters({ priorities: 'none,low' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['b', 'c']);
    });

    it('filters by project id or a part of the project title', async () => {
      const projects = useProjectStore();
      projects.projects = [
        { id: 'home', title: 'Household', created_at: '' },
        { id: 'work', title: 'Day job', created_at: '' },
      ];
      const { filters } = setup();
      filters.applyFilters({ project: 'HOME' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a']);

      filters.applyFilters({ project: 'day' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['b', 'c']);
    });

    it('matches any of the tags, or all of them with tag_mode all', async () => {
      const { filters } = setup();
      filters.applyFilters({ tags: 'shopping,work' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'b', 'c']);

      filters.applyFilters({ tags: 'home,work', tag_mode: 'all' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['c']);
    });

    it('filters by whether a due date is set and by due date range', async () => {
      const { filters } = setup();
      filters.applyFilters({ has_due_date: false });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['c']);

      filters.applyFilters({ has_due_date: true });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'b']);

      filters.applyFilters({ due_after: '2026-10-21', due_before: '2026-12-01' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['b']);
    });

    it('lets a date alone cover its whole day for created and updated', async () => {
      const { filters } = setup();
      filters.applyFilters({ created_after: '2026-10-01', created_before: '2026-10-01' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['a']);

      filters.applyFilters({ updated_after: '2026-10-10' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['c']);

      filters.applyFilters({ updated_before: '2026-09-20' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['b']);

      // A full time stamp is compared as it is
      filters.applyFilters({ created_before: '2026-09-30T00:00:00.000Z' });
      await nextTick();
      expect(ids(filters.filteredTasks.value)).toEqual(['b']);
    });
  });

  describe('the search field, the chosen tags and the filters', () => {
    it('turns what is typed into filters', async () => {
      const { filters } = setup();
      filters.searchQuery.value = 'tags:home bucket:todo milk';
      await nextTick();
      expect(filters.taskFilters.value).toMatchObject({ tags: 'home', buckets: 'todo', search: 'milk' });
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'c']);
    });

    it('writes the filters of the dialog into the field and the tag list, and clears them again', async () => {
      const { filters } = setup();
      filters.applyFilters({ tags: 'home, work', buckets: 'todo' });
      await nextTick();
      expect(filters.searchQuery.value).toBe('bucket:todo tags:home,work');
      expect(filters.selectedTags.value).toEqual(['home', 'work']);

      filters.clearFilters();
      await nextTick();
      expect(filters.hasActiveFilters.value).toBe(false);
      expect(filters.searchQuery.value).toBe('');
      expect(filters.selectedTags.value).toEqual([]);
    });

    it('adds the chosen tags to the filters, and drops them when none is chosen', async () => {
      const { filters } = setup();
      filters.selectedTags.value = ['shopping'];
      await nextTick();
      expect(filters.taskFilters.value.tags).toBe('shopping');
      expect(ids(filters.filteredTasks.value)).toEqual(['a']);

      filters.selectedTags.value = [];
      await nextTick();
      expect(filters.taskFilters.value.tags).toBeUndefined();
    });
  });

  describe('the address of the page', () => {
    it('reads the filters from it, also when it changes', async () => {
      route.query = { buckets: 'todo', has_due_date: 'false', tags: 'home' };
      const { filters } = setup();
      await nextTick();
      expect(filters.taskFilters.value).toMatchObject({ buckets: 'todo', has_due_date: false, tags: 'home' });
      expect(filters.selectedTags.value).toEqual(['home']);

      route.query = { search: 'report', has_due_date: 'true' };
      await nextTick();
      expect(filters.taskFilters.value).toMatchObject({ search: 'report', has_due_date: true });
      expect(filters.searchQuery.value).toContain('report');
    });

    it('writes the filters to it, and leaves other parameters alone', async () => {
      route.query = { view: 'board' };
      const { filters } = setup();
      filters.applyFilters({
        search: 'milk',
        priorities: 'high',
        has_due_date: true,
        due_after: '2026-10-01',
        project: 'home',
        tags: 'home,work',
        tag_mode: 'all',
      });
      await nextTick();
      expect(replace).toHaveBeenLastCalledWith({
        query: expect.objectContaining({
          view: 'board',
          search: 'milk',
          priorities: 'high',
          has_due_date: 'true',
          due_after: '2026-10-01',
          project: 'home',
          tags: 'home,work',
          tag_mode: 'all',
        }),
      });

      filters.clearFilters();
      await nextTick();
      expect(replace).toHaveBeenLastCalledWith({ query: { view: 'board' } });
    });

    it('does not touch the address when asked not to', async () => {
      const { filters } = setup({ syncRoute: false });
      filters.applyFilters({ search: 'milk' });
      await nextTick();
      expect(replace).not.toHaveBeenCalled();
      expect(ids(filters.filteredTasks.value)).toEqual(['a', 'c']);
    });
  });
});
