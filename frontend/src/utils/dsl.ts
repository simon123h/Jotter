import type { TaskFilterParams } from '@/types';

/**
 * Parses a search DSL query string into structured TaskFilterParams.
 * Supports:
 * - tag:ui,bug or tags:ui,bug (OR logic)
 * - tag:ui+bug or tags:ui+bug (AND logic)
 * - bucket:todo or buckets:todo
 * - priority:high or priorities:high or prio:high
 * - project:frontend or proj:frontend
 * - due:has or due:none
 * - due:before:YYYY-MM-DD
 * - due:after:YYYY-MM-DD
 * - Standalone/quoted text for full-text search
 */
export function parseDSL(query: string): TaskFilterParams {
  const filters: TaskFilterParams = {};
  const searchTerms: string[] = [];

  // Match:
  // 1) key:quoted_value -> e.g. bucket:"in progress"
  // 2) key:unquoted_value -> e.g. tag:ui,bug or due:before:2026-06-15
  // 3) quoted_text -> e.g. "some phrase search"
  // 4) unquoted_text -> e.g. simple_word
  const regex = /(-?\w+):(?:"([^"]+)"|([^\s]+))|(?:"([^"]+)"|([^\s]+))/g;
  let match;

  while ((match = regex.exec(query)) !== null) {
    const [, key, quotedVal, unquotedVal, quotedText, unquotedText] = match;

    if (key) {
      const rawValue = (quotedVal !== undefined ? quotedVal : unquotedVal || '').trim();
      const lowerKey = key.toLowerCase();

      if (lowerKey === 'tag' || lowerKey === 'tags') {
        if (rawValue.includes('+')) {
          filters.tags = rawValue
            .split('+')
            .map((t) => t.trim())
            .filter(Boolean)
            .join(',');
          filters.tag_mode = 'all';
        } else {
          filters.tags = rawValue
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .join(',');
          filters.tag_mode = 'any';
        }
      } else if (lowerKey === 'bucket' || lowerKey === 'buckets') {
        filters.buckets = rawValue;
      } else if (lowerKey === 'priority' || lowerKey === 'priorities' || lowerKey === 'prio') {
        filters.priorities = rawValue;
      } else if (lowerKey === 'project' || lowerKey === 'proj') {
        filters.project = rawValue;
      } else if (lowerKey === 'due') {
        const lowerVal = rawValue.toLowerCase();
        if (lowerVal === 'has') {
          filters.has_due_date = true;
        } else if (lowerVal === 'none') {
          filters.has_due_date = false;
        } else if (rawValue.startsWith('before:')) {
          filters.due_before = rawValue.substring(7);
        } else if (rawValue.startsWith('after:')) {
          filters.due_after = rawValue.substring(6);
        }
      }
    } else {
      const text = (quotedText !== undefined ? quotedText : unquotedText || '').trim();
      if (text) {
        searchTerms.push(text);
      }
    }
  }

  if (searchTerms.length > 0) {
    filters.search = searchTerms.join(' ');
  }

  return filters;
}

/**
 * Serializes TaskFilterParams back into its search DSL string representation.
 */
export function stringifyDSL(filters: TaskFilterParams): string {
  const parts: string[] = [];

  // 1. Buckets
  if (filters.buckets) {
    const hasSpace = filters.buckets.includes(' ');
    const val = hasSpace ? `"${filters.buckets}"` : filters.buckets;
    parts.push(filters.buckets.includes(',') ? `buckets:${val}` : `bucket:${val}`);
  }

  // 2. Priorities
  if (filters.priorities) {
    const hasSpace = filters.priorities.includes(' ');
    const val = hasSpace ? `"${filters.priorities}"` : filters.priorities;
    parts.push(`priority:${val}`);
  }

  // 3. Project Filter
  if (filters.project) {
    const hasSpace = filters.project.includes(' ');
    const val = hasSpace ? `"${filters.project}"` : filters.project;
    parts.push(`project:${val}`);
  }

  // 4. Tags List with logical mode translation
  if (filters.tags) {
    const separator = filters.tag_mode === 'all' ? '+' : ',';
    const tagVal = filters.tags.split(',').join(separator);
    const hasSpace = tagVal.includes(' ');
    const val = hasSpace ? `"${tagVal}"` : tagVal;
    parts.push(`tags:${val}`);
  }

  // 5. Due Dates
  if (filters.has_due_date !== undefined && filters.has_due_date !== null) {
    parts.push(`due:${filters.has_due_date ? 'has' : 'none'}`);
  }
  if (filters.due_before) {
    parts.push(`due:before:${filters.due_before}`);
  }
  if (filters.due_after) {
    parts.push(`due:after:${filters.due_after}`);
  }

  // 6. Text Search (if contains space, quote it)
  if (filters.search) {
    parts.push(filters.search);
  }

  return parts.join(' ');
}
