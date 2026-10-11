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

/** What a search query asks for; defined with the query language in packages/task-filter. */
export type { TaskFilter as TaskFilterParams } from '@jotter/task-filter';

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
