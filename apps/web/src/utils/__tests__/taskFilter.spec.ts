import { describe, it, expect } from 'vitest';
import { filterTasks, parseQuery, stringifyQuery, isEmptyFilter, isoDay, isBeyond, today, type TaskFilter } from '@jotter/task-filter';

// The same cases run against the Python backend (tests/test_search_conformance.py)
import matchFixture from '../../../../../spec/fixtures/search/match.json';
import parseFixture from '../../../../../spec/fixtures/search/parse.json';
import sortFixture from '../../../../../spec/fixtures/search/sort.json';

const {
  tasks,
  cases,
  today: fixtureToday,
} = matchFixture as {
  today: string;
  tasks: Array<{ id: string; title: string; bucket: string; tags: string[] }>;
  cases: Array<{ name: string; filter: TaskFilter; ids: string[] }>;
};
const parseCases = (parseFixture as { cases: Array<{ query: string; filter: TaskFilter }> }).cases;

describe('task filter conformance', () => {
  for (const c of cases) {
    it(`matches: ${c.name}`, () => {
      expect(filterTasks(tasks, c.filter, fixtureToday).map((t) => t.id)).toEqual(c.ids);
    });
  }

  for (const c of parseCases) {
    it(`parses: ${c.query || '(empty)'}`, () => {
      expect(parseQuery(c.query)).toEqual(c.filter);
    });
  }
});

describe('sort:title conformance', () => {
  const rows = (sortFixture as { tasks: Array<{ id: string; title: string }> }).tasks.map((t) => ({
    ...t,
    bucket: 'todo',
    tags: [] as string[],
  }));
  for (const c of (sortFixture as { cases: Array<{ name: string; filter: TaskFilter; ids: string[] }> }).cases) {
    it(`sorts: ${c.name}`, () => {
      expect(filterTasks(rows, c.filter, '2026-06-15').map((t) => t.id)).toEqual(c.ids);
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
    // Sorting and grouping ask for no tasks: a view of only those has nothing filtered
    expect(isEmptyFilter({ sort: '-created', group: 'planned' })).toBe(true);
  });

  it('keeps the order of the tasks', () => {
    expect(filterTasks([...tasks].reverse(), { bucket: 'todo' }, '2026-06-15').map((t) => t.id)).toEqual(['e', 'd', 'b', 'a']);
  });
});

describe('days in the local calendar', () => {
  // Built from local parts: just after midnight is still the day before in UTC east of Greenwich
  const justAfterMidnight = new Date(2026, 9, 13, 0, 30);
  const lateEvening = new Date(2026, 9, 13, 23, 30);

  it('names the local day, whatever the time zone', () => {
    expect(isoDay(0, justAfterMidnight)).toBe('2026-10-13');
    expect(today(lateEvening)).toBe('2026-10-13');
  });

  it('counts days from it, across month ends and the clock change', () => {
    expect(isoDay(1, lateEvening)).toBe('2026-10-14');
    expect(isoDay(-13, lateEvening)).toBe('2026-09-30');
    expect(isoDay(1, new Date(2026, 9, 31, 12))).toBe('2026-11-01');
  });

  it('keeps a task out of the way when it is planned beyond the horizon', () => {
    // 2026-10-13 is a Tuesday: its week ends on 2026-10-18, its month on 2026-10-31
    const day = today(justAfterMidnight);
    expect(isBeyond('2026-10-14', 'today', day)).toBe(true);
    expect(isBeyond('2026-10-13', 'today', day)).toBe(false);
    expect(isBeyond('2026-10-14', 'tomorrow', day)).toBe(false);
    expect(isBeyond('2026-10-18', 'week', day)).toBe(false);
    expect(isBeyond('2026-W43', 'week', day)).toBe(true);
    expect(isBeyond('2026-W42', 'today', day)).toBe(false); // a week that has begun is not ahead
    expect(isBeyond('2026-11', 'month', day)).toBe(true);
    expect(isBeyond('2026-10', 'today', day)).toBe(false);
    expect(isBeyond('2099-01-01', 'all', day)).toBe(false);
    expect(isBeyond(null, 'today', day)).toBe(false);
  });
});
