import type { Task, Bucket, Project, TaskFilterParams, AppSettings, SystemInfo, GitCommit, Timeblock } from '@/types';
import * as demoApi from '@/api.demo';
import { activeStorage, isNativeMobile } from '@/storage';
import { isServerOnline } from '@/storage/connectionState';

export { isNativeMobile, isServerOnline };

// Auto-detect Demo Mode
export const IS_DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('github.io') || window.location.hostname.includes('githubpreview.dev')));

// Centralized status checker
export async function checkServerStatus(): Promise<boolean> {
  if (isNativeMobile || IS_DEMO_MODE) {
    isServerOnline.value = true;
    return true;
  }
  return activeStorage.checkStatus();
}

// ==========================================
// PROJECT MANAGEMENT API
// ==========================================

export async function getProjects(): Promise<Project[]> {
  if (IS_DEMO_MODE) return demoApi.getProjects();
  return activeStorage.getProjects();
}

export async function createProject(title: string, git_remote?: string | null): Promise<Project> {
  if (IS_DEMO_MODE) return demoApi.createProject(title);
  return activeStorage.createProject(title, git_remote);
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  if (IS_DEMO_MODE) return demoApi.updateProject(id, updates);
  return activeStorage.updateProject(id, updates);
}

export async function deleteProject(id: string): Promise<void> {
  if (IS_DEMO_MODE) return demoApi.deleteProject(id);
  return activeStorage.deleteProject(id);
}

// ==========================================
// SCOPED TASK API
// ==========================================

export async function getAllTasks(filters?: TaskFilterParams): Promise<Task[]> {
  if (IS_DEMO_MODE) return demoApi.getTasks('default', filters);
  return activeStorage.getAllTasks(filters);
}

export async function getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') return [];
  if (IS_DEMO_MODE) return demoApi.getTasks(projectId, filters);
  return activeStorage.getTasks(projectId, filters);
}

export async function getTask(projectId: string, id: string): Promise<Task> {
  if (IS_DEMO_MODE) return demoApi.getTask(projectId, id);
  return activeStorage.getTask(projectId, id);
}

export async function createTask(
  projectId: string,
  task: {
    title: string;
    bucket: string;
    tags?: string[];
    body?: string;
    due_date?: string;
    planned_date?: string;
    priority?: string;
    color?: string | null;
  }
): Promise<Task> {
  if (IS_DEMO_MODE) return demoApi.createTask(projectId, task);
  return activeStorage.createTask(projectId, task);
}

export async function updateTask(projectId: string, id: string, task: Partial<Task>): Promise<Task> {
  if (IS_DEMO_MODE) return demoApi.updateTask(projectId, id, task);
  return activeStorage.updateTask(projectId, id, task);
}

export async function moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
  if (IS_DEMO_MODE) return demoApi.moveTask(projectId, id, bucket, position);
  return activeStorage.moveTask(projectId, id, bucket, position);
}

export async function deleteTask(projectId: string, id: string): Promise<void> {
  if (IS_DEMO_MODE) return demoApi.deleteTask(projectId, id);
  return activeStorage.deleteTask(projectId, id);
}

export async function uploadAttachment(projectId: string, taskId: string, file: File): Promise<Task> {
  if (IS_DEMO_MODE) throw new Error('Attachments not supported in demo mode');
  if (activeStorage.uploadAttachment) {
    return activeStorage.uploadAttachment(projectId, taskId, file);
  }
  throw new Error('Upload attachment not implemented on current adapter');
}

export async function deleteAttachment(projectId: string, taskId: string, filename: string): Promise<Task> {
  if (IS_DEMO_MODE) throw new Error('Attachments not supported in demo mode');
  if (activeStorage.deleteAttachment) {
    return activeStorage.deleteAttachment(projectId, taskId, filename);
  }
  throw new Error('Delete attachment not implemented on current adapter');
}

export function getAttachmentUrl(projectId: string, taskId: string, filename: string): string {
  if (activeStorage.getAttachmentUrl) {
    return activeStorage.getAttachmentUrl(projectId, taskId, filename);
  }
  return '';
}

// ==========================================
// COLUMN (BUCKETS) API
// ==========================================

export async function getBuckets(projectId: string): Promise<Bucket[]> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') return [];
  if (IS_DEMO_MODE) return demoApi.getBuckets(projectId);
  return activeStorage.getBuckets(projectId);
}

export async function createBucket(
  projectId: string,
  title: string,
  subtitle?: string,
  color?: string | null,
  layout?: 'list' | 'grid-2' | 'grid-3',
  max_tasks?: number | null
): Promise<Bucket> {
  if (IS_DEMO_MODE) return demoApi.createBucket(projectId, title, subtitle, color, layout, max_tasks);
  return activeStorage.createBucket(projectId, title, subtitle, color, layout, max_tasks);
}

export async function updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
  if (IS_DEMO_MODE) return demoApi.updateBucket(projectId, name, bucketUpdates);
  return activeStorage.updateBucket(projectId, name, bucketUpdates);
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  if (IS_DEMO_MODE) return demoApi.deleteBucket(projectId, name);
  return activeStorage.deleteBucket(projectId, name);
}

// ==========================================
// SYSTEM ROUTER API
// ==========================================

export async function syncSystem(): Promise<{ status: string; synchronized_tasks: number }> {
  if (IS_DEMO_MODE) return demoApi.syncSystem();
  return activeStorage.syncSystem();
}

export async function getSystemInfo(): Promise<SystemInfo> {
  if (IS_DEMO_MODE) return demoApi.getSystemInfo();
  return activeStorage.getSystemInfo();
}

export async function getGitHistory(projectId?: string): Promise<GitCommit[]> {
  if (IS_DEMO_MODE) return [];
  return activeStorage.getGitHistory(projectId);
}

export async function restoreCommit(commitHash: string, projectId?: string): Promise<{ synchronized_tasks: number }> {
  if (IS_DEMO_MODE) return { synchronized_tasks: 0 };
  return activeStorage.restoreCommit(commitHash, projectId);
}

// ==========================================
// SETTINGS API
// ==========================================

const DEMO_SETTINGS_KEY = 'jotter-demo-settings';
const DEFAULT_DEMO_SETTINGS: AppSettings = {
  hideDoneColumn: true,
  hideArchiveColumn: true,
  hidePostponedColumn: true,
  isSidebarOpen: true,
  currentTheme: 'nordic-light',
  thresholdDays: 7,
  pinnedProjectIds: [],
  sortBy: 'alpha',
  hideAddTaskButton: true,
  projectOrder: [],
  gitRemoteUrl: '',
};

export async function getSettings(): Promise<AppSettings> {
  if (IS_DEMO_MODE) {
    const stored = localStorage.getItem(DEMO_SETTINGS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { ...DEFAULT_DEMO_SETTINGS };
      }
    }
    return { ...DEFAULT_DEMO_SETTINGS };
  }
  return activeStorage.getSettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (IS_DEMO_MODE) {
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(settings));
    return;
  }
  return activeStorage.saveSettings(settings);
}

// ==========================================
// TIMEBLOCK API
// ==========================================

export async function getTimeblocks(params?: { startDate?: string; endDate?: string }): Promise<Timeblock[]> {
  return activeStorage.getTimeblocks(params);
}

export async function getTimeblock(id: string): Promise<Timeblock> {
  return activeStorage.getTimeblock(id);
}

export async function createTimeblock(timeblock: Omit<Timeblock, 'id'>): Promise<Timeblock> {
  return activeStorage.createTimeblock(timeblock);
}

export async function updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock> {
  return activeStorage.updateTimeblock(id, updates);
}

export async function deleteTimeblock(id: string): Promise<void> {
  return activeStorage.deleteTimeblock(id);
}

export async function allocateTaskToTimeblock(timeblockId: string, taskId: string, action: 'add' | 'remove' = 'add'): Promise<Timeblock> {
  return activeStorage.allocateTaskToTimeblock(timeblockId, taskId, action);
}
