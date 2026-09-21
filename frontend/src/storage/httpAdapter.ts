import type { StorageAdapter } from './types';
import type { Task, Bucket, Project, TaskFilterParams, AppSettings, SystemInfo, GitCommit, Timeblock } from '@/types';
import { isServerOnline } from './connectionState';

const API_BASE = '/api';

export class HttpStorageAdapter implements StorageAdapter {
  private async handleResponseError(response: Response, fallbackPrefix: string): Promise<never> {
    let detail: string | undefined;
    try {
      const errorData = await response.json();
      if (errorData && errorData.detail) {
        detail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Ignore
    }
    throw new Error(detail || `${fallbackPrefix}: ${response.statusText || response.status}`);
  }

  private async customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      let target = input;
      if (typeof target === 'string' && target.startsWith('/')) {
        const base =
          typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'http://localhost';
        target = new URL(target, base).toString();
      }
      const response = await fetch(target, init);
      if ([502, 503, 504].includes(response.status)) {
        isServerOnline.value = false;
      } else {
        isServerOnline.value = true;
      }
      return response;
    } catch (error) {
      isServerOnline.value = false;
      throw error;
    }
  }

  async checkStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/projects`, { method: 'GET' });
      // 500 status still means backend server is up and reachable
      if (response.status === 500) {
        isServerOnline.value = true;
        return true;
      }
      isServerOnline.value = response.ok;
      return isServerOnline.value;
    } catch {
      isServerOnline.value = false;
      return false;
    }
  }

  async getProjects(): Promise<Project[]> {
    const res = await this.customFetch(`${API_BASE}/projects`);
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch projects');
    return res.json();
  }

  async createProject(title: string, git_remote?: string | null): Promise<Project> {
    const res = await this.customFetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, git_remote }),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to create project');
    return res.json();
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const res = await this.customFetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to update project');
    return res.json();
  }

  async deleteProject(id: string): Promise<void> {
    const res = await this.customFetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) await this.handleResponseError(res, 'Failed to delete project');
  }

  private appendTaskFilterParams(url: URL, filters?: TaskFilterParams) {
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

  async getAllTasks(filters?: TaskFilterParams): Promise<Task[]> {
    const url = new URL(`${API_BASE}/tasks`, window.location.origin);
    this.appendTaskFilterParams(url, filters);
    const res = await this.customFetch(url.toString());
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch all tasks');
    return res.json();
  }

  async getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
    if (!projectId || projectId === 'null' || projectId === 'undefined') return [];
    const url = new URL(`${API_BASE}/projects/${projectId}/tasks`, window.location.origin);
    this.appendTaskFilterParams(url, filters);
    const res = await this.customFetch(url.toString());
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch tasks');
    return res.json();
  }

  async getTask(projectId: string, id: string): Promise<Task> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`);
    if (!res.ok) await this.handleResponseError(res, `Failed to fetch task ${id}`);
    return res.json();
  }

  async createTask(projectId: string, task: any): Promise<Task> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to create task');
    return res.json();
  }

  async updateTask(projectId: string, id: string, updates: Partial<Task>): Promise<Task> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) await this.handleResponseError(res, `Failed to update task ${id}`);
    return res.json();
  }

  async moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, position }),
    });
    if (!res.ok) await this.handleResponseError(res, `Failed to move task ${id}`);
    return res.json();
  }

  async deleteTask(projectId: string, id: string): Promise<void> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) await this.handleResponseError(res, `Failed to delete task ${id}`);
  }

  async uploadAttachment(projectId: string, taskId: string, file: File): Promise<Task> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to upload attachment');
    return res.json();
  }

  async deleteAttachment(projectId: string, taskId: string, filename: string): Promise<Task> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${filename}`, {
      method: 'DELETE',
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to delete attachment');
    return res.json();
  }

  getAttachmentUrl(projectId: string, taskId: string, filename: string): string {
    return `${window.location.origin}${API_BASE}/projects/${projectId}/tasks/${taskId}/attachments/${filename}`;
  }

  async getBuckets(projectId: string): Promise<Bucket[]> {
    if (!projectId || projectId === 'null' || projectId === 'undefined') return [];
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/buckets`);
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch columns');
    return res.json();
  }

  async createBucket(
    projectId: string,
    title: string,
    subtitle?: string,
    color?: string | null,
    layout?: 'list' | 'grid-2' | 'grid-3',
    max_tasks?: number | null
  ): Promise<Bucket> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/buckets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle, color, layout, max_tasks }),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to create column');
    return res.json();
  }

  async updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bucketUpdates),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to update column');
    return res.json();
  }

  async deleteBucket(projectId: string, name: string): Promise<void> {
    const res = await this.customFetch(`${API_BASE}/projects/${projectId}/buckets/${name}`, { method: 'DELETE' });
    if (!res.ok) await this.handleResponseError(res, 'Failed to delete column');
  }

  async getSettings(): Promise<AppSettings> {
    const res = await this.customFetch(`${API_BASE}/settings`);
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch settings');
    return res.json();
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const res = await this.customFetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to save settings');
  }

  async getTimeblocks(params?: { startDate?: string; endDate?: string }): Promise<Timeblock[]> {
    const url = new URL(`${API_BASE}/timeblocks`, window.location.origin);
    if (params?.startDate) url.searchParams.append('start_date', params.startDate);
    if (params?.endDate) url.searchParams.append('end_date', params.endDate);
    const res = await this.customFetch(url.toString());
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch time blocks');
    return res.json();
  }

  async getTimeblock(id: string): Promise<Timeblock> {
    const res = await this.customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(id)}`);
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch time block');
    return res.json();
  }

  async createTimeblock(timeblock: Omit<Timeblock, 'id'>): Promise<Timeblock> {
    const res = await this.customFetch(`${API_BASE}/timeblocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timeblock),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to create time block');
    return res.json();
  }

  async updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock> {
    const res = await this.customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to update time block');
    return res.json();
  }

  async deleteTimeblock(id: string): Promise<void> {
    const res = await this.customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) await this.handleResponseError(res, 'Failed to delete time block');
  }

  async allocateTaskToTimeblock(timeblockId: string, taskId: string, action: 'add' | 'remove' = 'add'): Promise<Timeblock> {
    const res = await this.customFetch(`${API_BASE}/timeblocks/${encodeURIComponent(timeblockId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, action }),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to allocate task');
    return res.json();
  }

  async syncSystem(): Promise<{ status: string; synchronized_tasks: number }> {
    const res = await this.customFetch(`${API_BASE}/system/sync`, { method: 'POST' });
    if (!res.ok) await this.handleResponseError(res, 'Failed to synchronize');
    return res.json();
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const res = await this.customFetch(`${API_BASE}/system/info`);
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch system info');
    return res.json();
  }

  async updateDataDir(dataDir: string): Promise<{ status: string; data_dir: string; synced?: number }> {
    const res = await this.customFetch(`${API_BASE}/system/data-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_dir: dataDir }),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to update data directory');
    return res.json();
  }

  async getGitHistory(projectId?: string): Promise<GitCommit[]> {
    const url = new URL(`${API_BASE}/system/history`, window.location.origin);
    if (projectId && projectId !== 'all') url.searchParams.append('projectId', projectId);
    const res = await this.customFetch(url.toString());
    if (!res.ok) await this.handleResponseError(res, 'Failed to fetch git history');
    const data = await res.json();
    return Array.isArray(data) ? data : data?.history || [];
  }

  async restoreCommit(commitHash: string, projectId?: string): Promise<{ synchronized_tasks: number }> {
    const res = await this.customFetch(`${API_BASE}/system/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash, projectId }),
    });
    if (!res.ok) await this.handleResponseError(res, 'Failed to restore commit');
    return res.json();
  }
}
