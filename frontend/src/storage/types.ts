import type { Task, Bucket, Project, TaskFilterParams, AppSettings, SystemInfo, GitCommit, Timeblock } from '@/types';

export interface StorageAdapter {
  // Connection / status
  checkStatus(): Promise<boolean>;

  // Projects
  getProjects(): Promise<Project[]>;
  createProject(title: string, gitRemote?: string | null): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Tasks
  getAllTasks(filters?: TaskFilterParams): Promise<Task[]>;
  getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]>;
  getTask(projectId: string, id: string): Promise<Task>;
  createTask(projectId: string, task: {
    title: string;
    bucket: string;
    tags?: string[];
    body?: string;
    due_date?: string;
    planned_date?: string;
    priority?: string;
    color?: string | null;
  }): Promise<Task>;
  updateTask(projectId: string, id: string, updates: Partial<Task>): Promise<Task>;
  moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task>;
  deleteTask(projectId: string, id: string): Promise<void>;
  uploadAttachment?(projectId: string, taskId: string, file: File): Promise<Task>;
  deleteAttachment?(projectId: string, taskId: string, filename: string): Promise<Task>;
  getAttachmentUrl?(projectId: string, taskId: string, filename: string): string;

  // Buckets (Columns)
  getBuckets(projectId: string): Promise<Bucket[]>;
  createBucket(
    projectId: string,
    title: string,
    subtitle?: string,
    color?: string | null,
    layout?: 'list' | 'grid-2' | 'grid-3',
    max_tasks?: number | null
  ): Promise<Bucket>;
  updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket>;
  deleteBucket(projectId: string, name: string): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  // Timeblocks
  getTimeblocks(params?: { startDate?: string; endDate?: string }): Promise<Timeblock[]>;
  getTimeblock(id: string): Promise<Timeblock>;
  createTimeblock(timeblock: Omit<Timeblock, 'id'>): Promise<Timeblock>;
  updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock>;
  deleteTimeblock(id: string): Promise<void>;
  allocateTaskToTimeblock(timeblockId: string, taskId: string, action?: 'add' | 'remove'): Promise<Timeblock>;

  // System & Sync
  syncSystem(): Promise<{ status: string; synchronized_tasks: number }>;
  getSystemInfo(): Promise<SystemInfo>;
  getGitHistory(projectId?: string): Promise<GitCommit[]>;
  restoreCommit(commitHash: string, projectId?: string): Promise<{ synchronized_tasks: number }>;
}
