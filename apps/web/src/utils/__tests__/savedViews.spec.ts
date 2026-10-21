import { describe, it, expect } from 'vitest';
import { exampleViews, newViewId, sameQuery, scopedQuery } from '@jotter/task-filter';
import { filtersToRouteQuery, routeQueryToFilters } from '@/utils/filterRoute';
import { parseQuery } from '@jotter/task-filter';

describe('saved views', () => {
  it('offers two example views in the language of the app', () => {
    const views = exampleViews({ upcoming: 'Demnächst', recent: 'Neu' });
    expect(views.map((v) => [v.id, v.name])).toEqual([
      ['upcoming', 'Demnächst'],
      ['recent', 'Neu'],
    ]);
    for (const view of views) expect(parseQuery(view.query)).not.toEqual({});
  });

  it('makes an id from the name, with a number when it is taken', () => {
    const taken = [{ id: 'my-view', name: 'x', query: '' }];
    expect(newViewId('Über uns!', [])).toBe('uber-uns');
    expect(newViewId('My view', taken)).toBe('my-view-2');
    expect(newViewId('???', [])).toBe('view');
  });

  it('knows two spellings of one search', () => {
    expect(sameQuery('tags:ui  prio:high', 'priority:high #ui')).toBe(true);
    expect(sameQuery('tag:ui', 'tag:bug')).toBe(false);
  });

  it('adds the project of a search saved inside one, unless the search names a project', () => {
    expect(scopedQuery('planned:after:today', 'jotter')).toBe('project:jotter planned:after:today');
    expect(scopedQuery('project:work fix', 'jotter')).toBe('project:work fix');
    expect(scopedQuery('fix', 'all')).toBe('fix');
    expect(scopedQuery(' fix ', null)).toBe('fix');
    expect(scopedQuery('', 'jotter')).toBe('project:jotter');
  });
});

describe('filters in the address', () => {
  it('writes what is set and reads it back, also the planned range and the sort', () => {
    const filters = parseQuery('tag:ui planned:after:today planned:before:+2w sort:-created due:has');
    const query = filtersToRouteQuery(filters);
    expect(query).toMatchObject({ planned_after: 'today', planned_before: '+2w', sort: '-created', has_due_date: 'true' });
    expect(routeQueryToFilters(query)).toMatchObject(filters);
  });

  it('leaves out what is not set', () => {
    expect(filtersToRouteQuery({})).toEqual({});
  });
});
