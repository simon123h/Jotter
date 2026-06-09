import { describe, it, expect } from 'vitest';
import { parseDSL, stringifyDSL } from '@/utils/dsl';
import type { TaskFilterParams } from '@/types';

describe('Search DSL', () => {
  describe('parseDSL', () => {
    it('parses empty query', () => {
      expect(parseDSL('')).toEqual({});
      expect(parseDSL('   ')).toEqual({});
    });

    it('parses plain text search', () => {
      expect(parseDSL('login bug')).toEqual({ search: 'login bug' });
    });

    it('parses plain text with quotes', () => {
      expect(parseDSL('"database connection" error')).toEqual({
        search: 'database connection error',
      });
    });

    it('parses singular and plural tag filters', () => {
      // OR matching (default)
      expect(parseDSL('tag:ui,bug')).toEqual({
        tags: 'ui,bug',
        tag_mode: 'any',
      });
      expect(parseDSL('tags:ui,bug')).toEqual({
        tags: 'ui,bug',
        tag_mode: 'any',
      });

      // AND matching
      expect(parseDSL('tags:ui+bug')).toEqual({
        tags: 'ui,bug',
        tag_mode: 'all',
      });
    });

    it('parses singular and plural bucket filters', () => {
      expect(parseDSL('bucket:todo')).toEqual({ buckets: 'todo' });
      expect(parseDSL('buckets:todo,progress')).toEqual({ buckets: 'todo,progress' });
    });

    it('parses priority and prio filters', () => {
      expect(parseDSL('priority:high')).toEqual({ priorities: 'high' });
      expect(parseDSL('prio:urgent')).toEqual({ priorities: 'urgent' });
    });

    it('parses project/proj filters', () => {
      expect(parseDSL('project:marketing')).toEqual({ project: 'marketing' });
      expect(parseDSL('proj:frontend')).toEqual({ project: 'frontend' });
    });

    it('parses due date attributes', () => {
      expect(parseDSL('due:has')).toEqual({ has_due_date: true });
      expect(parseDSL('due:none')).toEqual({ has_due_date: false });
      expect(parseDSL('due:before:2026-06-15')).toEqual({ due_before: '2026-06-15' });
      expect(parseDSL('due:after:2026-06-01')).toEqual({ due_after: '2026-06-01' });
    });

    it('handles quoted values for fields', () => {
      expect(parseDSL('bucket:"in progress"')).toEqual({ buckets: 'in progress' });
      expect(parseDSL('project:"marketing division"')).toEqual({ project: 'marketing division' });
    });

    it('combines text search with fields and operators in arbitrary order', () => {
      const query = 'login tags:ui,bug priority:high "session timeout"';
      expect(parseDSL(query)).toEqual({
        search: 'login session timeout',
        tags: 'ui,bug',
        tag_mode: 'any',
        priorities: 'high',
      });
    });
  });

  describe('stringifyDSL', () => {
    it('returns empty string for empty filters', () => {
      expect(stringifyDSL({})).toBe('');
    });

    it('stringifies text search', () => {
      expect(stringifyDSL({ search: 'session timeout' })).toBe('session timeout');
    });

    it('stringifies tags with proper separator logic', () => {
      expect(stringifyDSL({ tags: 'ui,bug', tag_mode: 'any' })).toBe('tags:ui,bug');
      expect(stringifyDSL({ tags: 'ui,bug', tag_mode: 'all' })).toBe('tags:ui+bug');
      expect(stringifyDSL({ tags: 'ui' })).toBe('tags:ui');
    });

    it('stringifies buckets and priorities', () => {
      expect(stringifyDSL({ buckets: 'todo' })).toBe('bucket:todo');
      expect(stringifyDSL({ buckets: 'todo,progress' })).toBe('buckets:todo,progress');
      expect(stringifyDSL({ priorities: 'high' })).toBe('priority:high');
    });

    it('stringifies project', () => {
      expect(stringifyDSL({ project: 'marketing' })).toBe('project:marketing');
      expect(stringifyDSL({ project: 'marketing space' })).toBe('project:"marketing space"');
    });

    it('stringifies due dates', () => {
      expect(stringifyDSL({ has_due_date: true })).toBe('due:has');
      expect(stringifyDSL({ has_due_date: false })).toBe('due:none');
      expect(stringifyDSL({ due_before: '2026-06-15' })).toBe('due:before:2026-06-15');
      expect(stringifyDSL({ due_after: '2026-06-01' })).toBe('due:after:2026-06-01');
    });

    it('combines multiple filters correctly', () => {
      const filters: TaskFilterParams = {
        buckets: 'todo',
        priorities: 'high',
        project: 'frontend',
        tags: 'ui,bug',
        tag_mode: 'all',
        has_due_date: true,
        search: 'fix session',
      };
      const expected = 'bucket:todo priority:high project:frontend tags:ui+bug due:has fix session';
      expect(stringifyDSL(filters)).toBe(expected);
    });
  });
});
