/** The entities of a vault, as read from and written to its markdown files (spec/FORMAT.md). */

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
  planned_date?: string;
  priority?: string;
  color?: string | null;
  postponed_until?: string;
  created_at: string;
  updated_at: string;
  /** Frontmatter keys this app does not know. Kept so that saving a task does not delete them. */
  extra_frontmatter?: Record<string, unknown>;
}

export interface Project {
  id: string;
  title: string;
  created_at: string;
  done_clean_period?: number | null;
  description?: string;
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
