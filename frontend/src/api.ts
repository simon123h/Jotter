import { ref } from 'vue';
import type { Task, Bucket, Project } from './types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

// Shared reactive connection state
export const isServerOnline = ref(true);

// Helper to update server online status based on HTTP response status
function updateStatusFromResponse(response: Response) {
  // 502 Bad Gateway, 503 Service Unavailable, and 504 Gateway Timeout
  // indicate the backend is unreachable or down behind a gateway/proxy.
  if ([502, 503, 504].includes(response.status)) {
    isServerOnline.value = false;
  } else {
    isServerOnline.value = true;
  }
}

// Centralized status checker using raw fetch to avoid loop overhead
export async function checkServerStatus(): Promise<boolean> {
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

// Project Management API calls
export async function getProjects(): Promise<Project[]> {
  const response = await customFetch(`${API_BASE}/projects`);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  return response.json();
}

export async function createProject(title: string): Promise<Project> {
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

export async function updateProject(id: string, title: string): Promise<Project> {
  const response = await customFetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update project: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  const response = await customFetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete project: ${response.statusText}`);
  }
}

// Scoped Task API calls
export async function getTasks(projectId: string, bucket?: string, tag?: string, excludeBucket?: string): Promise<Task[]> {
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
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createTask(
  projectId: string,
  task: { title: string; bucket: string; tags: string[]; body: string; due_date?: string; priority?: string }
): Promise<Task> {
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
  const response = await customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete task ${id}: ${response.statusText}`);
  }
}

// Scoped Buckets API calls
export async function getBuckets(projectId: string): Promise<Bucket[]> {
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

export async function updateBucket(
  projectId: string,
  name: string,
  payload: {
    title?: string;
    subtitle?: string;
    position?: number;
    color?: string | null;
    layout?: 'list' | 'grid-2' | 'grid-3';
    max_tasks?: number | null;
    is_default?: boolean;
  }
): Promise<Bucket> {
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update column: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  const response = await customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete column: ${response.statusText}`);
  }
}

// System endpoints
export async function syncSystem(): Promise<{ synchronized_tasks: number }> {
  const response = await customFetch(`${API_BASE}/system/sync`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to sync database: ${response.statusText}`);
  }
  return response.json();
}
