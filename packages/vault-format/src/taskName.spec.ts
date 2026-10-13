import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_TASK_NAMES, taskSlug, uniqueTaskName } from './taskName';

const fixture = JSON.parse(readFileSync(resolve(process.cwd(), '../../spec/fixtures/filenames/slug.json'), 'utf-8')) as {
  reserved: string[];
  cases: { description: string; title: string; slug: string }[];
};

describe('file names of new tasks', () => {
  it.each(fixture.cases.map((c) => [c.description, c.title, c.slug]))('follows the spec fixture: %s', (_description, title, slug) => {
    expect(taskSlug(title)).toBe(slug);
  });

  it('has the reserved names of the spec fixture', () => {
    expect([...RESERVED_TASK_NAMES].sort()).toEqual([...fixture.reserved].sort());
  });

  it('keeps a free name plain and gives a taken one four random characters', async () => {
    expect(await uniqueTaskName('buy-milk', async () => false)).toBe('buy-milk');
    expect(await uniqueTaskName('buy-milk', async (name) => name === 'buy-milk')).toMatch(/^buy-milk-[a-z0-9]{4}$/);
  });

  it.each(fixture.reserved)('always gives the reserved name %s a suffix', async (name) => {
    expect(await uniqueTaskName(name, async () => false)).toMatch(new RegExp(`^${name}-[a-z0-9]{4}$`));
  });
});
