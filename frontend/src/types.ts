export interface Vault {
  id: string;
  name: string;
  path: string;
  is_active: boolean;
  is_git: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  created_at: string;
  done_clean_period?: number | null;
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
  postponed_until?: string;
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
  created_before?: string; // YYYY-MM-DD
  created_after?: string; // YYYY-MM-DD
  updated_before?: string; // YYYY-MM-DD
  updated_after?: string; // YYYY-MM-DD
  project?: string; // Project ID or Title query
}

export interface TaskQuery {
  projectId?: string;
  isGlobal?: boolean;
  excludeBuckets?: string;
}

export interface AppSettings {
  hideDoneColumn: boolean;
  hideArchiveColumn: boolean;
  hidePostponedColumn: boolean;
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
  language?: string;
  tagColors?: Record<string, string>;
  timeblockStartHour?: number;
  timeblockEndHour?: number;
  isTimeblockSidebarOpen?: boolean;
  doneCleanPeriod?: number | null;
  autoCommit?: boolean;
}

export interface SystemInfo {
  version: string;
  data_dir: string;
  git_installed?: boolean;
}

export interface GitCommit {
  id: string;
  short_id: string;
  author: string;
  date: string;
  message: string;
}

export type TimeblockRecurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'bi-weekly';

export interface Timeblock {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  task_ids: string[];
  tasks?: Task[];
  recurrence?: TimeblockRecurrence | null;
}

// ==========================================
// JSON CANVAS TYPES (Obsidian Canvas Spec)
// ==========================================

export type CanvasNodeType = 'text' | 'file' | 'link' | 'group';
export type CanvasSide = 'top' | 'right' | 'bottom' | 'left';
export type CanvasEnd = 'none' | 'arrow';

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string | null;
  text?: string | null;
  file?: string | null;
  url?: string | null;
  label?: string | null;
  background?: string | null;
  backgroundStyle?: string | null;
  [key: string]: any;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: CanvasSide;
  fromEnd?: CanvasEnd;
  toNode: string;
  toSide?: CanvasSide;
  toEnd?: CanvasEnd;
  color?: string | null;
  label?: string | null;
  [key: string]: any;
}

export interface CanvasDocument {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface CanvasMeta {
  id: string;
  title: string;
  filename?: string;
  created_at?: string;
  updated_at?: string;
}
