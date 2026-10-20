/** The entities of a vault, as read from and written to its markdown files (spec/FORMAT.md). */

/** How a task comes back after it is completed (spec/FORMAT.md, "Recurring tasks"). */
export interface RepeatRule {
  every: number;
  unit: 'day' | 'week' | 'month' | 'year';
  from: 'completion' | 'due';
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  bucket: string;
  position: number;
  tags: string[];
  attachments: string[];
  body: string;
  due_date?: string;
  /** A day `YYYY-MM-DD`, an ISO week `YYYY-Www` or a month `YYYY-MM` (spec/FORMAT.md, "Dates and times"). */
  planned_date?: string;
  priority?: string;
  color?: string | null;
  repeat?: RepeatRule;
  /** Local date-times `YYYY-MM-DDTHH:mm`, sorted, without duplicates. */
  reminders?: string[];
  created_at: string;
  updated_at: string;
  /** Read from a file with a planning keyword or a running postponement: not written, the scan reads such a file again. */
  legacy_planned?: boolean;
  /** Frontmatter keys this app does not know. Kept so that saving a task does not delete them. */
  extra_frontmatter?: Record<string, unknown>;
}

export interface Project {
  id: string;
  title: string;
  created_at: string;
  done_clean_period?: number | null;
  description?: string;
  /** Put away: out of the lists, the reminders and every view across projects. Only the boolean `true` archives. */
  archived?: boolean;
  /** Markdown below the manifest's frontmatter, kept when the manifest is rewritten. */
  body?: string;
  /** Manifest keys this app does not know, kept when the manifest is rewritten. */
  extra_frontmatter?: Record<string, unknown>;
}

export type BucketName = string;

export interface Bucket {
  name: BucketName;
  title: string;
  subtitle: string;
  position: number;
  color?: string | null;
  layout?: 'list' | 'grid-2' | 'grid-3';
  max_tasks?: number | null;
  is_default?: boolean;
}
