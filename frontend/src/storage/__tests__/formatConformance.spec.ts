import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTaskMarkdown, dumpTaskMarkdown, parseProjectManifest, dumpProjectManifest } from '../markdownParser';

/**
 * Runs the shared vault-format fixtures (spec/fixtures) against the TypeScript parser used by the Android app.
 * The Python backend runs the same files in tests/test_format_conformance.py; see spec/README.md.
 *
 * KNOWN_DIVERGENCES lists fixtures this implementation does not pass yet. Each one is a bug to fix: remove
 * its entry once fixed (a fixed case fails the suite until you do, so the list cannot rot).
 */
const KNOWN_DIVERGENCES: Record<string, string> = {};

// Vitest runs from frontend/
const fixturesDir = `${resolve(process.cwd(), '../spec/fixtures')}/`;

interface Case {
  name: string;
  content: string;
  context: Record<string, string>;
  expected: Record<string, any>;
}

function loadCases(kind: 'tasks' | 'projects'): Case[] {
  return readdirSync(`${fixturesDir}${kind}`)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const name = f.replace(/\.json$/, '');
      const spec = JSON.parse(readFileSync(`${fixturesDir}${kind}/${f}`, 'utf-8'));
      return { name, content: readFileSync(`${fixturesDir}${kind}/${name}.md`, 'utf-8'), context: spec.context, expected: spec.expected };
    });
}

function taskView(task: any, expected: Record<string, any>) {
  const view: Record<string, any> = {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    bucket: task.bucket,
    position: task.position,
    tags: task.tags ?? [],
    attachments: task.attachments ?? [],
    body: task.body ?? '',
    due_date: task.due_date ?? null,
    planned_date: task.planned_date ?? null,
    priority: task.priority ?? 'none',
    color: task.color ?? null,
    postponed_until: task.postponed_until ?? null,
    extra: task.extra_frontmatter ?? {},
  };
  for (const key of ['created_at', 'updated_at']) {
    if (key in expected) view[key] = task[key];
  }
  return view;
}

function projectView(project: any, buckets: any[], expected: Record<string, any>) {
  const view: Record<string, any> = {
    id: project.id,
    title: project.title,
    description: project.description ?? '',
    done_clean_period: project.done_clean_period ?? null,
    buckets: buckets.map((b) => ({
      name: b.name,
      title: b.title,
      subtitle: b.subtitle ?? '',
      position: b.position,
      color: b.color ?? null,
      layout: b.layout ?? 'list',
      max_tasks: b.max_tasks ?? null,
      is_default: Boolean(b.is_default),
    })),
  };
  if ('created_at' in expected) view.created_at = project.created_at;
  return view;
}

/** Runs the assertions; a known divergence must fail, so that fixing it forces removing the list entry. */
function check(name: string, assertions: () => void) {
  if (name in KNOWN_DIVERGENCES) {
    expect(assertions, `${name} is listed as a known divergence (${KNOWN_DIVERGENCES[name]}) but now passes: remove it`).toThrow();
  } else {
    assertions();
  }
}

describe('format conformance: tasks', () => {
  for (const c of loadCases('tasks')) {
    it(`${c.name}: read and round trip`, () => {
      check(`task/${c.name}`, () => {
        if (c.expected.error) {
          expect(() => parseTaskMarkdown(c.content, c.context.default_project_id, `${c.context.file_stem}.md`)).toThrow();
          return;
        }
        const first = parseTaskMarkdown(c.content, c.context.default_project_id, `${c.context.file_stem}.md`);
        expect(taskView(first, c.expected)).toEqual(c.expected);
        const second = parseTaskMarkdown(dumpTaskMarkdown(first), c.context.default_project_id, `${c.context.file_stem}.md`);
        expect(taskView(second, c.expected)).toEqual(c.expected);
      });
    });
  }
});

describe('format conformance: projects', () => {
  for (const c of loadCases('projects')) {
    it(`${c.name}: read and round trip`, () => {
      check(`project/${c.name}`, () => {
        // `extra` (unknown keys) and `body` describe what must survive a rewrite, they are not part of the parsed project
        const { extra, body, ...parsedExpected } = c.expected;
        const first = parseProjectManifest(c.content, c.context.dir_name);
        expect(projectView(first.project, first.buckets, parsedExpected)).toEqual(parsedExpected);
        const second = parseProjectManifest(dumpProjectManifest(first.project, first.buckets), c.context.dir_name);
        expect(projectView(second.project, second.buckets, parsedExpected)).toEqual(parsedExpected);
        if (extra !== undefined) expect(second.project.extra_frontmatter).toEqual(extra);
        if (body !== undefined) expect(second.project.body).toBe(body);
      });
    });
  }
});
