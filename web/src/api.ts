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
import { getStorageAdapter } from '@/storage';
import { isServerOnline } from '@/storage/connectionState';
import { crossTabBus } from '@/utils/broadcast';

export { isServerOnline };

const storage = getStorageAdapter;
const isBlankId = (id: string) => !id || id === 'null' || id === 'undefined';

export async function checkServerStatus(): Promise<boolean> {
  return storage().checkStatus();
}

// ==========================================
// PROJECT MANAGEMENT API
// ==========================================

export async function getProjects(): Promise<Project[]> {
  return storage().getProjects();
}

export async function createProject(title: string): Promise<Project> {
  const res = await storage().createProject(title);
  crossTabBus.broadcast({ type: 'projects-changed' });
  return res;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const res = await storage().updateProject(id, updates);
  crossTabBus.broadcast({ type: 'projects-changed' });
  return res;
}

export async function deleteProject(id: string): Promise<void> {
  await storage().deleteProject(id);
  crossTabBus.broadcast({ type: 'projects-changed' });
}

// ==========================================
// SCOPED TASK API
// ==========================================

export async function getAllTasks(filters?: TaskFilterParams): Promise<Task[]> {
  return storage().getAllTasks(filters);
}

export async function getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
  if (isBlankId(projectId)) return [];
  return storage().getTasks(projectId, filters);
}

export async function getTask(projectId: string, id: string): Promise<Task> {
  return storage().getTask(projectId, id);
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
  const res = await storage().createTask(projectId, task);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function updateTask(projectId: string, id: string, task: Partial<Task>): Promise<Task> {
  const res = await storage().updateTask(projectId, id, task);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
  const res = await storage().moveTask(projectId, id, bucket, position);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function deleteTask(projectId: string, id: string): Promise<void> {
  await storage().deleteTask(projectId, id);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
}

export async function uploadAttachment(projectId: string, taskId: string, file: File): Promise<Task> {
  const adapter = storage();
  if (!adapter.uploadAttachment) throw new Error('Upload attachment not implemented on current adapter');
  const res = await adapter.uploadAttachment(projectId, taskId, file);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export async function deleteAttachment(projectId: string, taskId: string, filename: string): Promise<Task> {
  const adapter = storage();
  if (!adapter.deleteAttachment) throw new Error('Delete attachment not implemented on current adapter');
  const res = await adapter.deleteAttachment(projectId, taskId, filename);
  crossTabBus.broadcast({ type: 'tasks-changed', projectId });
  return res;
}

export function getAttachmentUrl(projectId: string, taskId: string, filename: string): string {
  return storage().getAttachmentUrl?.(projectId, taskId, filename) ?? '';
}

// ==========================================
// COLUMN (BUCKETS) API
// ==========================================

export async function getBuckets(projectId: string): Promise<Bucket[]> {
  if (isBlankId(projectId)) return [];
  return storage().getBuckets(projectId);
}

export async function createBucket(
  projectId: string,
  title: string,
  subtitle?: string,
  color?: string | null,
  layout?: 'list' | 'grid-2' | 'grid-3',
  max_tasks?: number | null
): Promise<Bucket> {
  const res = await storage().createBucket(projectId, title, subtitle, color, layout, max_tasks);
  crossTabBus.broadcast({ type: 'buckets-changed', projectId });
  return res;
}

export async function updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
  const res = await storage().updateBucket(projectId, name, bucketUpdates);
  crossTabBus.broadcast({ type: 'buckets-changed', projectId });
  return res;
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  await storage().deleteBucket(projectId, name);
  crossTabBus.broadcast({ type: 'buckets-changed', projectId });
}

// ==========================================
// SYSTEM ROUTER API
// ==========================================

export async function syncSystem(): Promise<{ status: string; synchronized_tasks: number }> {
  return storage().syncSystem();
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return storage().getSystemInfo();
}

export async function getGitHistory(projectId?: string): Promise<GitCommit[]> {
  return storage().getGitHistory(projectId);
}

export async function restoreCommit(commitHash: string, projectId?: string): Promise<{ synchronized_tasks: number }> {
  return storage().restoreCommit(commitHash, projectId);
}

// ==========================================
// SETTINGS API
// ==========================================

export async function getSettings(): Promise<AppSettings> {
  return storage().getSettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return storage().saveSettings(settings);
}

// ==========================================
// TIMEBLOCK API
// ==========================================

export async function getTimeblocks(params?: { startDate?: string; endDate?: string }): Promise<Timeblock[]> {
  return storage().getTimeblocks(params);
}

export async function getTimeblock(id: string): Promise<Timeblock> {
  return storage().getTimeblock(id);
}

export async function createTimeblock(timeblock: Omit<Timeblock, 'id'>): Promise<Timeblock> {
  const res = await storage().createTimeblock(timeblock);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
  return res;
}

export async function updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock> {
  const res = await storage().updateTimeblock(id, updates);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
  return res;
}

export async function deleteTimeblock(id: string): Promise<void> {
  await storage().deleteTimeblock(id);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
}

export async function allocateTaskToTimeblock(timeblockId: string, taskId: string, action: 'add' | 'remove' = 'add'): Promise<Timeblock> {
  const res = await storage().allocateTaskToTimeblock(timeblockId, taskId, action);
  crossTabBus.broadcast({ type: 'timeblocks-changed' });
  return res;
}

// ==========================================
// CANVAS API
// ==========================================

export async function getCanvases(projectId: string): Promise<CanvasMeta[]> {
  return storage().getCanvases(projectId);
}

export async function getCanvas(projectId: string, canvasId: string): Promise<CanvasDocument> {
  return storage().getCanvas(projectId, canvasId);
}

export async function saveCanvas(projectId: string, canvasId: string, doc: CanvasDocument): Promise<CanvasDocument> {
  const res = await storage().saveCanvas(projectId, canvasId, doc);
  crossTabBus.broadcast({ type: 'canvas-changed', projectId, canvasId });
  return res;
}

export async function deleteCanvas(projectId: string, canvasId: string): Promise<void> {
  await storage().deleteCanvas(projectId, canvasId);
  crossTabBus.broadcast({ type: 'canvas-changed', projectId, canvasId });
}

// ==========================================
// VAULT API
// ==========================================

export async function enableGitVersioning(): Promise<{ status: string; created: boolean }> {
  const res = await fetch('/api/system/git/init', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to enable Git versioning');
  }
  return res.json();
}

function vaultAdapter() {
  const adapter = storage();
  if (!adapter.getVaults) throw new Error('Vaults are not supported in this runtime');
  return adapter;
}

export async function getVaults(): Promise<Vault[]> {
  return vaultAdapter().getVaults!();
}

export async function getActiveVault(): Promise<Vault> {
  return vaultAdapter().getActiveVault!();
}

export async function createVault(payload: { name: string; path: string; id?: string; create_dir?: boolean }): Promise<Vault> {
  return vaultAdapter().createVault!(payload);
}

export async function switchVault(vaultId: string): Promise<Vault> {
  return vaultAdapter().switchVault!(vaultId);
}

export async function renameVault(vaultId: string, name: string): Promise<Vault> {
  return vaultAdapter().renameVault!(vaultId, name);
}

export async function deleteVault(vaultId: string): Promise<void> {
  return vaultAdapter().deleteVault!(vaultId);
}
