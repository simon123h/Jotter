import type { Task, Bucket } from './types';

const API_BASE = 'http://localhost:8000';

export async function getTasks(bucket?: string, tag?: string): Promise<Task[]> {
  const url = new URL(`${API_BASE}/tasks`);
  if (bucket) url.searchParams.append('bucket', bucket);
  if (tag) url.searchParams.append('tag', tag);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function getTask(id: number): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function createTask(task: { title: string; bucket: string; tags: string[]; body: string }): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }
  return response.json();
}

export async function updateTask(id: number, task: Partial<Task>): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    throw new Error(`Failed to update task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function moveTask(id: number, bucket: string, position: number): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to move task ${id}: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete task ${id}: ${response.statusText}`);
  }
}

export async function syncSystem(): Promise<{ synchronized_tasks: number }> {
  const response = await fetch(`${API_BASE}/system/sync`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to sync database: ${response.statusText}`);
  }
  return response.json();
}

export async function getBuckets(): Promise<Bucket[]> {
  const response = await fetch(`${API_BASE}/buckets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch columns: ${response.statusText}`);
  }
  return response.json();
}

export async function createBucket(title: string): Promise<Bucket> {
  const response = await fetch(`${API_BASE}/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create column: ${response.statusText}`);
  }
  return response.json();
}

export async function updateBucket(name: string, payload: { title?: string; position?: number }): Promise<Bucket> {
  const response = await fetch(`${API_BASE}/buckets/${name}`, {
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

export async function deleteBucket(name: string): Promise<void> {
  const response = await fetch(`${API_BASE}/buckets/${name}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete column: ${response.statusText}`);
  }
}
