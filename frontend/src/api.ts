import { ref } from 'vue';
import type { Task, Bucket, Project } from './types';
import * as demoApi from './api.demo';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

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
    const response = await fetch(input, init);
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

export async function createProject(title: string): Promise<Project> {
  if (IS_DEMO_MODE) {
    return demoApi.createProject(title);
  }
  const response = await customFetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create project: ${response.statusText}`);
  }
  return response.json();
}

export async function updateProject(id: string, updates: { title?: string; done_clean_period?: number | null }): Promise<Project> {
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

export async function getTasks(projectId: string, bucket?: string, tag?: string, excludeBucket?: string): Promise<Task[]> {
  if (IS_DEMO_MODE) {
    return demoApi.getTasks(projectId, bucket, tag, excludeBucket);
  }
  const url = new URL(`${API_BASE}/projects/${projectId}/tasks`, window.location.origin);
  if (bucket) url.searchParams.append('bucket', bucket);
  if (tag) url.searchParams.append('tag', tag);
  if (excludeBucket) url.searchParams.append('exclude_bucket', excludeBucket);

  const response = await customFetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function getTask(projectId: string, id: number): Promise<Task> {
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
  task: { title: string; bucket: string; tags: string[]; body: string; due_date?: string; priority?: string; color?: string | null }
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

export async function updateTask(projectId: string, id: number, task: Partial<Task>): Promise<Task> {
  if (IS_DEMO_MODE) {
    return demoApi.updateTask(projectId, id, task);
  }
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    throw new Error(`Failed to update task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function moveTask(projectId: string, id: number, bucket: string, position: number): Promise<Task> {
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

export async function deleteTask(projectId: string, id: number): Promise<void> {
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
