import { ref } from 'vue';
import type { Task, Bucket, Project, TaskFilterParams, AppSettings, SystemInfo, GitCommit, Timeblock } from '@/types';
import * as demoApi from '@/api.demo';

const API_BASE = '/api';

// Shared reactive connection state
export const isServerOnline = ref(true);

// Auto-detect Demo Mode
export const IS_DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  window.location.hostname.endsWith('github.io') ||
  window.location.hostname.includes('githubpreview.dev');

// Helper to update server online status based on HTTP response status
function updateStatusFromResponse(response: Response) {
  if (IS_DEMO_MODE) {
    isServerOnline.value = true;
    return;
  }
  if ([502, 503, 504].includes(response.status)) {
    isServerOnline.value = false;
  } else {
    isServerOnline.value = true;
  }
}

// Helper to extract detailed, user-friendly error messages from backend JSON responses
async function handleResponseError(response: Response, fallbackPrefix: string): Promise<never> {
  let detail: string | undefined;
  try {
    const errorData = await response.json();
    if (errorData && errorData.detail) {
      detail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
    }
  } catch {
    // Ignore non-json response bodies
  }
  throw new Error(detail || `${fallbackPrefix}: ${response.statusText || response.status}`);
}

// Centralized status checker using raw fetch to avoid loop overhead
export async function checkServerStatus(): Promise<boolean> {
  if (IS_DEMO_MODE) {
    isServerOnline.value = true;
    return true;
  }
  try {
    const response = await fetch(`${API_BASE}/projects`, { method: 'GET' });
    updateStatusFromResponse(response);
    return isServerOnline.value;
  } catch {
    isServerOnline.value = false;
    return false;
  }
}

// Wrapper around fetch to update isServerOnline state reactively
async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    let target = input;
    if (typeof target === 'string' && target.startsWith('/')) {
      const base = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'http://localhost';
      target = new URL(target, base).toString();
    }
    const response = await fetch(target, init);
    updateStatusFromResponse(response);
    return response;
  } catch (error) {
    isServerOnline.value = false;
    throw error;
  }
}

// ==========================================
// PROJECT MANAGEMENT API
// ==========================================

export async function getProjects(): Promise<Project[]> {
  if (IS_DEMO_MODE) {
    return demoApi.getProjects();
  }
  const response = await customFetch(`${API_BASE}/projects`);
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch projects');
  }
  return response.json();
}

export async function createProject(title: string, git_remote?: string | null): Promise<Project> {
  if (IS_DEMO_MODE) {
    return demoApi.createProject(title);
  }
  const response = await customFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, git_remote }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to create project');
  }
  return response.json();
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  if (IS_DEMO_MODE) {
    return demoApi.updateProject(id, updates);
  }
  const response = await customFetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to update project');
  }
  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  if (IS_DEMO_MODE) {
    return demoApi.deleteProject(id);
  }
  const response = await customFetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to delete project');
  }
}

// ==========================================
// SCOPED TASK API
// ==========================================

function appendTaskFilterParams(url: URL, filters?: TaskFilterParams) {
  if (!filters) return;
  if (filters.bucket) url.searchParams.append('bucket', filters.bucket);
  if (filters.buckets) url.searchParams.append('buckets', filters.buckets);
  if (filters.tag) url.searchParams.append('tag', filters.tag);
  if (filters.tags) url.searchParams.append('tags', filters.tags);
  if (filters.tag_mode) url.searchParams.append('tag_mode', filters.tag_mode);
  if (filters.exclude_bucket) url.searchParams.append('exclude_bucket', filters.exclude_bucket);
  if (filters.exclude_buckets) url.searchParams.append('exclude_buckets', filters.exclude_buckets);
  if (filters.priorities) url.searchParams.append('priorities', filters.priorities);
  if (filters.search) url.searchParams.append('search', filters.search);
  if (filters.due_before) url.searchParams.append('due_before', filters.due_before);
  if (filters.due_after) url.searchParams.append('due_after', filters.due_after);
  if (filters.planned_date) url.searchParams.append('planned_date', filters.planned_date);
  if (filters.has_due_date !== undefined && filters.has_due_date !== null) {
    url.searchParams.append('has_due_date', String(filters.has_due_date));
  }
}

export async function getAllTasks(filters?: TaskFilterParams): Promise<Task[]> {
  if (IS_DEMO_MODE) {
    return demoApi.getTasks('default', filters);
  }
  const url = new URL(`${API_BASE}/tasks`, window.location.origin);
  appendTaskFilterParams(url, filters);

  const response = await customFetch(url.toString());
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch all tasks');
  }
  return response.json();
}

export async function getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    return [];
  }
  if (IS_DEMO_MODE) {
    return demoApi.getTasks(projectId, filters);
  }
  const url = new URL(`${API_BASE}/projects/${projectId}/tasks`, window.location.origin);
  appendTaskFilterParams(url, filters);

  const response = await customFetch(url.toString());
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch tasks');
  }
  return response.json();
}

export async function getTask(projectId: string, id: string): Promise<Task> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    throw new Error('Valid Project ID is required to fetch a task');
  }
  if (IS_DEMO_MODE) {
    return demoApi.getTask(projectId, id);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`);
  if (!response.ok) {
    await handleResponseError(response, `Failed to fetch task ${id}`);
  }
  return response.json();
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
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    throw new Error('Valid Project ID is required to create a task');
  }
  if (IS_DEMO_MODE) {
    return demoApi.createTask(projectId, task);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to create task');
  }
  return response.json();
}

export async function updateTask(projectId: string, id: string, task: Partial<Task>): Promise<Task> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    throw new Error('Valid Project ID is required to update a task');
  }
  if (IS_DEMO_MODE) {
    return demoApi.updateTask(projectId, id, task);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    await handleResponseError(response, `Failed to update task ${id}`);
  }
  return response.json();
}

export async function moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
  if (IS_DEMO_MODE) {
    return demoApi.moveTask(projectId, id, bucket, position);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, position }),
  });
  if (!response.ok) {
    await handleResponseError(response, `Failed to move task ${id}`);
  }
  return response.json();
}

export async function deleteTask(projectId: string, id: string): Promise<void> {
  if (IS_DEMO_MODE) {
    return demoApi.deleteTask(projectId, id);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, `Failed to delete task ${id}`);
  }
}

export async function uploadAttachment(projectId: string, taskId: string, file: File): Promise<Task> {
  if (IS_DEMO_MODE) {
    throw new Error('Attachments not supported in demo mode');
  }
  const formData = new FormData();
  formData.append('file', file);

  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to upload attachment');
  }
  return response.json();
}

export async function deleteAttachment(projectId: string, taskId: string, filename: string): Promise<Task> {
  if (IS_DEMO_MODE) {
    throw new Error('Attachments not supported in demo mode');
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${filename}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to delete attachment');
  }
  return response.json();
}

export function getAttachmentUrl(projectId: string, taskId: string, filename: string): string {
  return `${window.location.origin}${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${filename}`;
}

// ==========================================
// COLUMN (BUCKETS) API
// ==========================================

export async function getBuckets(projectId: string): Promise<Bucket[]> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    return [];
  }
  if (IS_DEMO_MODE) {
    return demoApi.getBuckets(projectId);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets`);
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch columns');
  }
  return response.json();
}

export async function createBucket(
  projectId: string,
  title: string,
  subtitle?: string,
  color?: string | null,
  layout?: 'list' | 'grid-2' | 'grid-3',
  max_tasks?: number | null
): Promise<Bucket> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    throw new Error('Valid Project ID is required to create a column');
  }
  if (IS_DEMO_MODE) {
    return demoApi.createBucket(projectId, title, subtitle, color, layout, max_tasks);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, subtitle, color, layout, max_tasks }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to create column');
  }
  return response.json();
}

export async function updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    throw new Error('Valid Project ID is required to update a column');
  }
  if (IS_DEMO_MODE) {
    return demoApi.updateBucket(projectId, name, bucketUpdates);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bucketUpdates),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to update column');
  }
  return response.json();
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  if (!projectId || projectId === 'null' || projectId === 'undefined') {
    throw new Error('Valid Project ID is required to delete a column');
  }
  if (IS_DEMO_MODE) {
    return demoApi.deleteBucket(projectId, name);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to delete column');
  }
}

// ==========================================
// SYSTEM ROUTER API
// ==========================================

export async function syncSystem(): Promise<{ status: string; synchronized_tasks: number }> {
  if (IS_DEMO_MODE) {
    return demoApi.syncSystem();
  }
  const response = await customFetch(`${API_BASE}/system/sync`, {
    method: 'POST',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to synchronize');
  }
  return response.json();
}

export async function getSystemInfo(): Promise<SystemInfo> {
  if (IS_DEMO_MODE) {
    return demoApi.getSystemInfo();
  }
  const response = await customFetch(`${API_BASE}/system/info`, {
    method: 'GET',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch system info');
  }
  return response.json();
}

export async function getGitHistory(projectId?: string): Promise<GitCommit[]> {
  if (IS_DEMO_MODE) {
    return [];
  }
  const url = new URL(`${API_BASE}/system/history`, window.location.origin);
  if (projectId && projectId !== 'all') {
    url.searchParams.append('projectId', projectId);
  }
  const response = await customFetch(url.toString());
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch git history');
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.history)) {
    return data.history;
  }
  return [];
}

export async function restoreCommit(commitHash: string, projectId?: string): Promise<{ synchronized_tasks: number }> {
  if (IS_DEMO_MODE) {
    return { synchronized_tasks: 0 };
  }
  const response = await customFetch(`${API_BASE}/system/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitHash, projectId }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to restore commit');
  }
  return response.json();
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

  const response = await customFetch(`${API_BASE}/settings`);
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch settings');
  }
  return response.json();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (IS_DEMO_MODE) {
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(settings));
    return;
  }

  const response = await customFetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to save settings');
  }
}

// ---------------------------------------------------------------------------
// Timeblock API
// ---------------------------------------------------------------------------

const DEMO_TIMEBLOCKS_KEY = 'jotter_demo_timeblocks';

function matchesTimeblockDate(tb: Timeblock, targetDateStr: string): boolean {
  if (!tb.recurrence || tb.recurrence === 'none') {
    return tb.date === targetDateStr;
  }
  if (targetDateStr < tb.date) return false;
  const anchor = new Date(tb.date + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  const diffDays = Math.round((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  if (tb.recurrence === 'daily') return true;
  if (tb.recurrence === 'weekdays') {
    const day = target.getDay();
    return day >= 1 && day <= 5;
  }
  if (tb.recurrence === 'weekly') return diffDays % 7 === 0;
  if (tb.recurrence === 'bi-weekly') return diffDays % 14 === 0;
  return false;
}

export async function getTimeblocks(params?: { startDate?: string; endDate?: string }): Promise<Timeblock[]> {
  if (IS_DEMO_MODE) {
    const stored = localStorage.getItem(DEMO_TIMEBLOCKS_KEY);
    const items: Timeblock[] = stored ? JSON.parse(stored) : [];
    if (!params?.startDate && !params?.endDate) {
      return items;
    }
    const results: Timeblock[] = [];
    const startStr = params?.startDate || params?.endDate || '';
    const endStr = params?.endDate || params?.startDate || '';
    if (!startStr || !endStr) return items;
    const curr = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    while (curr <= end) {
      const dStr = curr.toISOString().split('T')[0];
      for (const tb of items) {
        if (matchesTimeblockDate(tb, dStr)) {
          results.push({ ...tb, date: dStr });
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
    return results;
  }

  const url = new URL(`${API_BASE}/timeblocks`, window.location.origin);
  if (params?.startDate) url.searchParams.append('start_date', params.startDate);
  if (params?.endDate) url.searchParams.append('end_date', params.endDate);

  const response = await customFetch(url.toString());
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch time blocks');
  }
  return response.json();
}

export async function getTimeblock(id: string): Promise<Timeblock> {
  if (IS_DEMO_MODE) {
    const list = await getTimeblocks();
    const item = list.find((tb) => tb.id === id);
    if (!item) throw new Error('Time block not found');
    return item;
  }

  const response = await customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(id)}`);
  if (!response.ok) {
    await handleResponseError(response, 'Failed to fetch time block');
  }
  return response.json();
}

export async function createTimeblock(timeblock: Omit<Timeblock, 'id'>): Promise<Timeblock> {
  if (IS_DEMO_MODE) {
    const list = await getTimeblocks();
    const newTb: Timeblock = {
      id: `tb_${Date.now()}`,
      ...timeblock,
      task_ids: timeblock.task_ids || [],
    };
    list.push(newTb);
    localStorage.setItem(DEMO_TIMEBLOCKS_KEY, JSON.stringify(list));
    return newTb;
  }

  const response = await customFetch(`${API_BASE}/timeblocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(timeblock),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to create time block');
  }
  return response.json();
}

export async function updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock> {
  if (IS_DEMO_MODE) {
    const list = await getTimeblocks();
    const idx = list.findIndex((tb) => tb.id === id);
    if (idx === -1) throw new Error('Time block not found');
    list[idx] = { ...list[idx], ...updates };
    localStorage.setItem(DEMO_TIMEBLOCKS_KEY, JSON.stringify(list));
    return list[idx];
  }

  const response = await customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to update time block');
  }
  return response.json();
}

export async function deleteTimeblock(id: string): Promise<void> {
  if (IS_DEMO_MODE) {
    const list = await getTimeblocks();
    const filtered = list.filter((tb) => tb.id !== id);
    localStorage.setItem(DEMO_TIMEBLOCKS_KEY, JSON.stringify(filtered));
    return;
  }

  const response = await customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to delete time block');
  }
}

export async function allocateTaskToTimeblock(timeblockId: string, taskId: string, action: 'add' | 'remove' = 'add'): Promise<Timeblock> {
  if (IS_DEMO_MODE) {
    const list = await getTimeblocks();
    if (action === 'add') {
      // Remove from any other box first
      list.forEach((tb) => {
        tb.task_ids = tb.task_ids.filter((t: string) => t !== taskId);
      });
      const target = list.find((tb) => tb.id === timeblockId);
      if (target && !target.task_ids.includes(taskId)) {
        target.task_ids.push(taskId);
      }
    } else {
      const target = list.find((tb) => tb.id === timeblockId);
      if (target) {
        target.task_ids = target.task_ids.filter((t: string) => t !== taskId);
      }
    }
    localStorage.setItem(DEMO_TIMEBLOCKS_KEY, JSON.stringify(list));
    const updated = list.find((tb) => tb.id === timeblockId);
    if (!updated) throw new Error('Time block not found');
    return updated;
  }

  const response = await customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(timeblockId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, action }),
  });
  if (!response.ok) {
    await handleResponseError(response, 'Failed to allocate task to time block');
  }
  return response.json();
}
