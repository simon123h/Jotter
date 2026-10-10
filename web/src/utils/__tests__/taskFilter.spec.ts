import { describe, it, expect } from 'vitest';
import { filterTasks, parseQuery, stringifyQuery, isEmptyFilter, type TaskFilter } from '@jotter/task-filter';

// The same cases run against the Python backend (tests/test_search_conformance.py)
import matchFixture from '../../../../spec/fixtures/search/match.json';
import parseFixture from '../../../../spec/fixtures/search/parse.json';

const { tasks, cases } = matchFixture as {
  tasks: Array<{ id: string; title: string; bucket: string; tags: string[] }>;
  cases: Array<{ name: string; filter: TaskFilter; ids: string[] }>;
};
const parseCases = (parseFixture as { cases: Array<{ query: string; filter: TaskFilter }> }).cases;

describe('task filter conformance', () => {
  for (const c of cases) {
    it(`matches: ${c.name}`, () => {
      expect(filterTasks(tasks, c.filter, '2026-06-15').map((t) => t.id)).toEqual(c.ids);
    });
  }

  for (const c of parseCases) {
    it(`parses: ${c.query || '(empty)'}`, () => {
      expect(parseQuery(c.query)).toEqual(c.filter);
    });
  }
});

describe('task filter', () => {
  it('writes a filter back as a query that parses to the same filter', () => {
    for (const { filter } of parseCases) expect(parseQuery(stringifyQuery(filter))).toEqual(filter);
  });

  it('knows an empty filter', () => {
    expect(isEmptyFilter({})).toBe(true);
    expect(isEmptyFilter({ tag_mode: 'any' })).toBe(true);
    expect(isEmptyFilter({ has_due_date: false })).toBe(false);
  });

  it('keeps the order of the tasks', () => {
    expect(filterTasks([...tasks].reverse(), { bucket: 'todo' }, '2026-06-15').map((t) => t.id)).toEqual(['e', 'b', 'a']);
  });
});
