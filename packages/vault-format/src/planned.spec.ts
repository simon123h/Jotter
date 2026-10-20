/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPlanned, weekOf, plannedStart } from '@jotter/task-filter';

// Vitest runs from packages/vault-format
const legacy = JSON.parse(readFileSync(resolve(process.cwd(), '../../spec/fixtures/planned/legacy.json'), 'utf-8'));

describe('legacy planned values', () => {
  for (const c of legacy.cases) {
    it(`${c.value} on ${c.today}`, () => {
      expect(readPlanned(c.value, c.today)).toBe(c.expected);
    });
  }
});

describe('weeks', () => {
  it('knows the ISO week of a day', () => {
    expect(weekOf('2026-10-14')).toBe('2026-W42');
    expect(weekOf('2027-01-01')).toBe('2026-W53');
    expect(weekOf('2024-12-30')).toBe('2025-W01');
  });

  it('starts a week on its Monday and a month on its first day', () => {
    expect(plannedStart('2026-W43')).toBe('2026-10-19');
    expect(plannedStart('2026-10')).toBe('2026-10-01');
    expect(plannedStart('2026-10-21')).toBe('2026-10-21');
    expect(plannedStart('2027-W53')).toBeNull();
  });
});

describe('what is no planned value', () => {
  it('is read the same as the Python reader does', () => {
    for (const value of ['2026-13', '0999-12-31', '0000-W01', '0999-01']) {
      expect(plannedStart(value), value).toBeNull();
      expect(readPlanned(value, '2026-10-14'), value).toBeNull();
    }
  });

  it('trims the value, as the Python reader does', () => {
    expect(readPlanned(' 2026-10\n', '2026-10-14')).toBe('2026-10');
    expect(readPlanned('2026-w43\n', '2026-10-14')).toBe('2026-W43');
  });
});
