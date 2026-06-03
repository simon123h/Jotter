import type { Task, Bucket, Project } from './types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

// Project Management API calls
export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  return response.json();
}

export async function createProject(title: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
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
  const response = await fetch(`${API_BASE}/projects/${id}`, {
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
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete project: ${response.statusText}`);
  }
}

// Scoped Task API calls
export async function getTasks(projectId: string, bucket?: string, tag?: string): Promise<Task[]> {
  const url = new URL(`${API_BASE}/projects/${projectId}/tasks`);
  if (bucket) url.searchParams.append('bucket', bucket);
  if (tag) url.searchParams.append('tag', tag);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function getTask(projectId: string, id: number): Promise<Task> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/tasks/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createTask(
  projectId: string,
  task: { title: string; bucket: string; tags: string[]; body: string; due_date?: string; priority?: string }
): Promise<Task> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
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
  const response = await fetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
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
  const response = await fetch(`${API_BASE}/projects/${projectId}/tasks/${id}/move`, {
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
  const response = await fetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete task ${id}: ${response.statusText}`);
  }
}

// Scoped Buckets API calls
export async function getBuckets(projectId: string): Promise<Bucket[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/buckets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch columns: ${response.statusText}`);
  }
  return response.json();
}

export async function createBucket(projectId: string, title: string, subtitle?: string): Promise<Bucket> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, subtitle }),
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
  payload: { title?: string; subtitle?: string; position?: number }
): Promise<Bucket> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
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
  const response = await fetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete column: ${response.statusText}`);
  }
}

// System endpoints
export async function syncSystem(): Promise<{ synchronized_tasks: number }> {
  const response = await fetch(`${API_BASE}/system/sync`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to sync database: ${response.statusText}`);
  }
  return response.json();
}
