import { ref } from 'vue';
import type { Task, Bucket, Project, TaskFilterParams, AppSettings } from '@/types';
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
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create project: ${response.statusText}`);
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update project: ${response.statusText}`);
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete project: ${response.statusText}`);
  }
}

// ==========================================
// SCOPED TASK API
// ==========================================

export async function getAllTasks(filters?: TaskFilterParams): Promise<Task[]> {
  if (IS_DEMO_MODE) {
    return demoApi.getTasks('default', filters); // Demo mode doesn't support global yet
  }
  const url = new URL(`${API_BASE}/tasks`, window.location.origin);
  if (filters) {
    if (filters.exclude_buckets) url.searchParams.append('exclude_buckets', filters.exclude_buckets);
    if (filters.search) url.searchParams.append('search', filters.search);
  }

  const response = await customFetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch all tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
  if (IS_DEMO_MODE) {
    return demoApi.getTasks(projectId, filters);
  }
  const url = new URL(`${API_BASE}/projects/${projectId}/tasks`, window.location.origin);
  if (filters) {
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

  const response = await customFetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function getTask(projectId: string, id: string): Promise<Task> {
  if (IS_DEMO_MODE) {
    return demoApi.getTask(projectId, id);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createTask(
  projectId: string,
  task: {
    title: string;
    bucket: string;
    tags: string[];
    body: string;
    due_date?: string;
    planned_date?: string;
    priority?: string;
    color?: string | null;
  }
): Promise<Task> {
  if (IS_DEMO_MODE) {
    return demoApi.createTask(projectId, task);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }
  return response.json();
}

export async function updateTask(projectId: string, id: string, task: Partial<Task>): Promise<Task> {
  if (IS_DEMO_MODE) {
    return demoApi.updateTask(projectId, id, task);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    throw new Error(`Failed to update task ${id}: ${response.statusText}`);
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
    throw new Error(`Failed to move task ${id}: ${response.statusText}`);
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
    throw new Error(`Failed to delete task: ${response.statusText}`);
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
    throw new Error(`Failed to upload attachment: ${response.statusText}`);
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
    throw new Error(`Failed to delete attachment: ${response.statusText}`);
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
  if (IS_DEMO_MODE) {
    return demoApi.getBuckets(projectId);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch columns: ${response.statusText}`);
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
  if (IS_DEMO_MODE) {
    return demoApi.createBucket(projectId, title, subtitle, color, layout, max_tasks);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, subtitle, color, layout, max_tasks }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create column: ${response.statusText}`);
  }
  return response.json();
}

export async function updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
  if (IS_DEMO_MODE) {
    return demoApi.updateBucket(projectId, name, bucketUpdates);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bucketUpdates),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update column: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  if (IS_DEMO_MODE) {
    return demoApi.deleteBucket(projectId, name);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete column: ${response.statusText}`);
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to synchronize: ${response.statusText}`);
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
  isSidebarOpen: true,
  currentTheme: 'nordic-light',
  thresholdDays: 7,
  pinnedProjectIds: [],
  sortBy: 'alpha',
  hideAddTaskButton: true,
  projectMru: {},
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
    throw new Error(`Failed to fetch settings: ${response.statusText}`);
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
    throw new Error(`Failed to save settings: ${response.statusText}`);
  }
}
