export interface Project {
  id: string;
  title: string;
  created_at: string;
  done_clean_period?: number | null;
  git_remote?: string | null;
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
  planned_date?: string;
  priority?: string;
  color?: string | null;
  created_at: string;
  updated_at: string;
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

export interface TaskFilterParams {
  bucket?: string;
  buckets?: string; // Comma-separated list of bucket names
  tag?: string;
  tags?: string; // Comma-separated list of tags
  tag_mode?: 'any' | 'all';
  exclude_bucket?: string;
  exclude_buckets?: string; // Comma-separated list of excluded bucket names
  show_done?: boolean;
  show_archived?: boolean;
  priorities?: string; // Comma-separated list of priorities (low, medium, high, urgent, none)
  search?: string;
  due_before?: string; // YYYY-MM-DD
  due_after?: string; // YYYY-MM-DD
  planned_date?: string;
  has_due_date?: boolean | null;
}

export interface TaskQuery {
  projectId?: string;
  isGlobal?: boolean;
  excludeBuckets?: string;
}

export interface AppSettings {
  hideDoneColumn: boolean;
  hideArchiveColumn: boolean;
  isSidebarOpen: boolean;
  currentTheme: string;
  thresholdDays: number;
  pinnedProjectIds: string[];
  sortBy: 'alpha' | 'manual';
  hideAddTaskButton: boolean;
  projectOrder: string[];
  windowWidth?: number;
  windowHeight?: number;
  windowX?: number;
  windowY?: number;
  windowMaximized?: boolean;
  gitRemoteUrl?: string;
  language?: string;
}

export interface SystemInfo {
  version: string;
  data_dir: string;
}

export interface GitCommit {
  id: string;
  short_id: string;
  author: string;
  date: string;
  message: string;
}
