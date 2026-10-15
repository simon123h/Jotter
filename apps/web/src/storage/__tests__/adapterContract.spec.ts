import { describe, it, expect, beforeEach } from 'vitest';
import fixture from '../../../../../spec/fixtures/adapter/scenarios.json';
import { DemoStorageAdapter } from '../demoAdapter';
import type { StorageAdapter } from '../types';

/**
 * The scenarios of spec/fixtures/adapter, replayed against the static demo. The Python backend replays the same ones
 * through its REST API (tests/test_adapter_contract.py), so the demo cannot fall behind unnoticed.
 */
interface Step {
  op: string;
  args: unknown[];
  save?: string;
  match?: Record<string, unknown>;
  absent?: string[];
  pick?: string;
  equals?: unknown[];
  includes?: unknown[];
  excludes?: unknown[];
}
interface Scenario {
  name: string;
  skip?: Record<string, string>;
  steps: Step[];
}

const scenarios = fixture.scenarios as Scenario[];

function resolve(value: unknown, saved: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => resolve(item, saved));
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 1 && entries[0][0] === '$ref') {
      return (entries[0][1] as string).split('.').reduce<any>((found, part) => found[part], saved);
    }
    return Object.fromEntries(entries.map(([key, item]) => [key, resolve(item, saved)]));
  }
  return value;
}

function check(step: Step, result: any) {
  const where = `${step.op} ${JSON.stringify(step.args)}`;
  for (const [key, expected] of Object.entries(step.match ?? {})) {
    expect(result[key], `${where}: ${key}`).toEqual(expected);
  }
  for (const key of step.absent ?? []) {
    expect([undefined, null, '']).toContainEqual(result[key]);
  }
  if (step.pick) {
    const picked = (result as any[]).map((item) => item[step.pick!]);
    if (step.equals) expect(picked, where).toEqual(step.equals);
    for (const member of step.includes ?? []) expect(picked, where).toContain(member);
    for (const member of step.excludes ?? []) expect(picked, where).not.toContain(member);
  }
}

describe('the demo does what the backend does (spec/fixtures/adapter)', () => {
  let adapter: StorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new DemoStorageAdapter();
  });

  for (const scenario of scenarios) {
    const skipped = scenario.skip?.demo;
    (skipped ? it.skip : it)(skipped ? `${scenario.name} (skipped: ${skipped})` : scenario.name, async () => {
      const saved: Record<string, unknown> = {};
      for (const step of scenario.steps) {
        const args = resolve(step.args, saved) as unknown[];
        const result = await (adapter as any)[step.op](...args);
        if (step.save) saved[step.save] = result;
        check(step, result);
      }
    });
  }
});
