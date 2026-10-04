import type {
  Task,
  Bucket,
  Project,
  Vault,
  TaskFilterParams,
  AppSettings,
  SystemInfo,
  GitCommit,
  Timeblock,
  CanvasDocument,
  CanvasMeta,
} from '@/types';
import * as demoApi from '@/api.demo';
import { activeStorage, isNativeMobile } from '@/storage';
import { isServerOnline } from '@/storage/connectionState';
import { crossTabBus } from '@/utils/broadcast';

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

export async function createProject(title: string): Promise<Project> {
  let res: Project;
  if (IS_DEMO_MODE) res = await demoApi.createProject(title);
  else res = await activeStorage.createProject(title);
  crossTabBus.broadcast({ type: 'projects-changed' });
  return res;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  let res: Project;
  if (IS_DEMO_MODE) res = await demoApi.updateProject(id, updates);
  else res = await activeStorage.updateProject(id, updates);
  crossTabBus.broadcast({ type: 'projects-changed' });
  return res;
}

export async function deleteProject(id: string): Promise<void> {
  if (IS_DEMO_MODE) await demoApi.deleteProject(id);
  else await activeStorage.deleteProject(id);
  crossTabBus.broadcast({ type: 'projects-changed' });
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
  let res: Task;
  if (IS_DEMO_MODE) res = await demoApi.createTask(projectId, task);
  else res = await activeStorage.createTask(projectId, task);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function updateTask(projectId: string, id: string, task: Partial<Task>): Promise<Task> {
  let res: Task;
  if (IS_DEMO_MODE) res = await demoApi.updateTask(projectId, id, task);
  else res = await activeStorage.updateTask(projectId, id, task);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
  let res: Task;
  if (IS_DEMO_MODE) res = await demoApi.moveTask(projectId, id, bucket, position);
  else res = await activeStorage.moveTask(projectId, id, bucket, position);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function deleteTask(projectId: string, id: string): Promise<void> {
  if (IS_DEMO_MODE) await demoApi.deleteTask(projectId, id);
  else await activeStorage.deleteTask(projectId, id);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
}

export async function uploadAttachment(projectId: string, taskId: string, file: File): Promise<Task> {
  if (IS_DEMO_MODE) throw new Error('Attachments not supported in demo mode');
  if (activeStorage.uploadAttachment) {
    const res = await activeStorage.uploadAttachment(projectId, taskId, file);
    crossTabBus.broadcast({ type: 'tasks-changed', projectId });
    return res;
  }
  throw new Error('Upload attachment not implemented on current adapter');
}

export async function deleteAttachment(projectId: string, taskId: string, filename: string): Promise<Task> {
  if (IS_DEMO_MODE) throw new Error('Attachments not supported in demo mode');
  if (activeStorage.deleteAttachment) {
    const res = await activeStorage.deleteAttachment(projectId, taskId, filename);
    crossTabBus.broadcast({ type: 'tasks-changed', projectId });
    return res;
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
  let res: Bucket;
  if (IS_DEMO_MODE) res = await demoApi.createBucket(projectId, title, subtitle, color, layout, max_tasks);
  else res = await activeStorage.createBucket(projectId, title, subtitle, color, layout, max_tasks);
  crossTabBus.broadcast({ type: 'buckets-changed', projectId });
  return res;
}

export async function updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
  let res: Bucket;
  if (IS_DEMO_MODE) res = await demoApi.updateBucket(projectId, name, bucketUpdates);
  else res = await activeStorage.updateBucket(projectId, name, bucketUpdates);
  crossTabBus.broadcast({ type: 'buckets-changed', projectId });
  return res;
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  if (IS_DEMO_MODE) await demoApi.deleteBucket(projectId, name);
  else await activeStorage.deleteBucket(projectId, name);
  crossTabBus.broadcast({ type: 'buckets-changed', projectId });
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

export async function updateDataDir(dataDir: string): Promise<{ status: string; data_dir: string; synced?: number }> {
  if (IS_DEMO_MODE) return { status: 'ok', data_dir: dataDir };
  return activeStorage.updateDataDir(dataDir);
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
  const res = await activeStorage.createTimeblock(timeblock);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
  return res;
}

export async function updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock> {
  const res = await activeStorage.updateTimeblock(id, updates);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
  return res;
}

export async function deleteTimeblock(id: string): Promise<void> {
  await activeStorage.deleteTimeblock(id);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
}

export async function allocateTaskToTimeblock(timeblockId: string, taskId: string, action: 'add' | 'remove' = 'add'): Promise<Timeblock> {
  const res = await activeStorage.allocateTaskToTimeblock(timeblockId, taskId, action);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
  return res;
}

// ==========================================
// CANVAS API
// ==========================================

export async function getCanvases(projectId: string): Promise<CanvasMeta[]> {
  if (IS_DEMO_MODE) return demoApi.getCanvases(projectId);
  return activeStorage.getCanvases(projectId);
}

export async function getCanvas(projectId: string, canvasId: string): Promise<CanvasDocument> {
  if (IS_DEMO_MODE) return demoApi.getCanvas(projectId, canvasId);
  return activeStorage.getCanvas(projectId, canvasId);
}

export async function saveCanvas(projectId: string, canvasId: string, doc: CanvasDocument): Promise<CanvasDocument> {
  let res: CanvasDocument;
  if (IS_DEMO_MODE) res = await demoApi.saveCanvas(projectId, canvasId, doc);
  else res = await activeStorage.saveCanvas(projectId, canvasId, doc);
  crossTabBus.broadcast({ type: 'canvas-changed', projectId, canvasId });
  return res;
}

export async function deleteCanvas(projectId: string, canvasId: string): Promise<void> {
  if (IS_DEMO_MODE) await demoApi.deleteCanvas(projectId, canvasId);
  else await activeStorage.deleteCanvas(projectId, canvasId);
  crossTabBus.broadcast({ type: 'canvas-changed', projectId, canvasId });
}

// ==========================================
// VAULT API
// ==========================================

export async function commitChanges(): Promise<{ status: string; committed: boolean }> {
  const res = await fetch('/api/system/commit', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to commit changes');
  }
  return res.json();
}

export async function enableGitVersioning(): Promise<{ status: string; created: boolean }> {
  const res = await fetch('/api/system/git/init', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to enable Git versioning');
  }
  return res.json();
}

export async function getVaults(): Promise<Vault[]> {
  const res = await fetch('/api/vaults');
  if (!res.ok) throw new Error('Failed to load vaults');
  return res.json();
}

export async function getActiveVault(): Promise<Vault> {
  const res = await fetch('/api/vaults/active');
  if (!res.ok) throw new Error('Failed to load active vault');
  return res.json();
}

export async function createVault(payload: { name: string; path: string; id?: string }): Promise<Vault> {
  const res = await fetch('/api/vaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create vault');
  }
  return res.json();
}

export async function switchVault(vaultId: string): Promise<Vault> {
  const res = await fetch('/api/vaults/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vault_id: vaultId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to switch vault');
  }
  return res.json();
}

export async function deleteVault(vaultId: string): Promise<void> {
  const res = await fetch(`/api/vaults/${encodeURIComponent(vaultId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete vault');
  }
}
