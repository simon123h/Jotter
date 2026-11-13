import { describe, it, expect } from 'vitest';
import { exampleViews, newViewId, sameQuery, scopedQuery } from '@jotter/task-filter';
import { filtersToRouteQuery, routeQueryToFilters, routeSort, viewRouteName } from '@/utils/filterRoute';
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

describe('the page of a view', () => {
  it('follows the grouping of the search, and is the list without one', () => {
    expect(viewRouteName(parseQuery('planned:after:today group:planned'))).toBe('time');
    expect(viewRouteName(parseQuery('group:tag'))).toBe('tag');
    expect(viewRouteName(parseQuery('group:bucket'))).toBe('board');
    expect(viewRouteName(parseQuery('sort:-created'))).toBe('list');
  });
});

describe('filters in the address', () => {
  it('writes what is set and reads it back, also the planned range and the sort', () => {
    const filters = parseQuery('tag:ui planned:after:today planned:before:+2w sort:-created due:has');
    const query = filtersToRouteQuery(filters);
    expect(query).toMatchObject({ planned_after: 'today', planned_before: '+2w', sort: '-created', has_due_date: 'true' });
    expect(filtersToRouteQuery(parseQuery('group:tag'))).toEqual({ group: 'tag' });
    expect(routeQueryToFilters(query)).toMatchObject(filters);
  });

  it('leaves out a sort or a grouping that the search does not know', () => {
    const filters = routeQueryToFilters({ sort: 'foo', group: 'foo' });
    expect(filters.sort).toBeUndefined();
    expect(filters.group).toBeUndefined();
    expect(routeQueryToFilters({ sort: '-Due', group: 'Tag' })).toMatchObject({ sort: '-due', group: 'tag' });
    expect(routeSort({ sort: '--due' })).toBeUndefined();
    expect(routeSort({ sort: '-due' })).toBe('-due');
    expect(viewRouteName({ group: 'foo' as never })).toBe('list');
  });

  it('leaves out what is not set', () => {
    expect(filtersToRouteQuery({})).toEqual({});
  });
});
