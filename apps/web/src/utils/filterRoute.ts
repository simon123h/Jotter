import { toGroup, toSort } from '@jotter/task-filter';
import type { TaskFilterParams } from '@/types';

/** The filters that go into the address as they are: one query parameter each. */
const TEXT_KEYS = [
  'search',
  'buckets',
  'priorities',
  'tags',
  'tag_mode',
  'due_after',
  'due_before',
  'created_after',
  'created_before',
  'updated_after',
  'updated_before',
  'project',
  'planned_date',
  'planned_before',
  'planned_after',
  'sort',
  'group',
] as const;

const GROUP_PAGES = { planned: 'time', tag: 'tag', bucket: 'board' } as const;

/** The page that shows a view: the layout its `group:` asks for, a plain list when it asks for none. */
export function viewRouteName(filters: TaskFilterParams): 'time' | 'tag' | 'board' | 'list' {
  return (filters.group && GROUP_PAGES[filters.group]) || 'list';
}

/** Every query parameter the filters use, so that a page can take them out of an address before it puts its own in. */
export const FILTER_QUERY_KEYS: readonly string[] = [...TEXT_KEYS, 'has_due_date'];

/** The filters as query parameters of the address (only those that are set). */
export function filtersToRouteQuery(filters: TaskFilterParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const key of TEXT_KEYS) {
    const value = filters[key];
    if (value) query[key] = value;
  }
  if (filters.has_due_date !== undefined && filters.has_due_date !== null) query.has_due_date = String(filters.has_due_date);
  return query;
}

/** The filters an address holds. */
export function routeQueryToFilters(q: Record<string, unknown>): TaskFilterParams {
  let has_due_date: boolean | null = null;
  if (q.has_due_date === 'true') has_due_date = true;
  else if (q.has_due_date === 'false') has_due_date = false;

  const filters: TaskFilterParams = { has_due_date };
  for (const key of TEXT_KEYS) {
    const value = q[key] as string | undefined;
    (filters as Record<string, unknown>)[key] = value || undefined;
  }
  // An address can say anything: a sort or a grouping that is none is left out
  filters.sort = toSort(filters.sort);
  filters.group = toGroup(filters.group);
  return filters;
}

/** The sort an address asks for (none when it asks for no sort the search knows). */
export const routeSort = (q: Record<string, unknown>) => toSort(q.sort as string | undefined);
