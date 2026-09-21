import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import type { StorageAdapter } from './types';
import type { Task, Bucket, Project, TaskFilterParams, AppSettings, SystemInfo, GitCommit, Timeblock } from '@/types';
import { db } from './dexieDb';
import { parseTaskMarkdown, dumpTaskMarkdown, parseProjectManifest, dumpProjectManifest, DEFAULT_MOBILE_BUCKETS } from './markdownParser';

export const PREF_VAULT_PATH = 'jotter_vault_path';
export const PREF_VAULT_DIR = 'jotter_vault_dir'; // Directory enum name if relative

const DEFAULT_SETTINGS: AppSettings = {
  hideDoneColumn: true,
  hideArchiveColumn: true,
  hidePostponedColumn: true,
  isSidebarOpen: false, // mobile defaults to closed
  currentTheme: 'nordic-light',
  thresholdDays: 7,
  pinnedProjectIds: [],
  sortBy: 'alpha',
  hideAddTaskButton: true,
  projectOrder: [],
  gitRemoteUrl: '',
};

export class CapacitorFsStorageAdapter implements StorageAdapter {
  private vaultPath = 'Jotter';
  private vaultDirectory = Directory.Documents;
  private isInitialized = false;

  async checkStatus(): Promise<boolean> {
    return true; // Always online for local mobile storage
  }

  async setVaultPath(path: string, directory: Directory = Directory.Documents): Promise<void> {
    this.vaultPath = path;
    this.vaultDirectory = directory;
    await Preferences.set({ key: PREF_VAULT_PATH, value: path });
    await Preferences.set({ key: PREF_VAULT_DIR, value: directory });
    await this.syncSystem();
  }

  async getVaultPath(): Promise<string> {
    const { value } = await Preferences.get({ key: PREF_VAULT_PATH });
    return value || 'Jotter';
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    const { value: savedPath } = await Preferences.get({ key: PREF_VAULT_PATH });
    if (savedPath) {
      this.vaultPath = savedPath;
    }
    const { value: savedDir } = await Preferences.get({ key: PREF_VAULT_DIR });
    if (savedDir) {
      this.vaultDirectory = savedDir as Directory;
    }

    try {
      // Ensure vault directory exists
      await Filesystem.mkdir({
        path: this.vaultPath,
        directory: this.vaultDirectory,
        recursive: true,
      });
    } catch {
      // Ignore if already exists
    }

    this.isInitialized = true;
    await this.syncSystem();
  }

  // ==========================================
  // PROJECTS
  // ==========================================

  async getProjects(): Promise<Project[]> {
    await this.ensureInitialized();
    let projects = await db.projects.toArray();
    if (projects.length === 0) {
      // Seed default project
      const defProj: Project = {
        id: 'default',
        title: 'Default',
        created_at: new Date().toISOString(),
      };
      await this.createProject(defProj.title);
      projects = [defProj];
    }
    return projects.sort((a, b) => a.title.localeCompare(b.title));
  }

  async createProject(title: string, git_remote?: string | null): Promise<Project> {
    await this.ensureInitialized();
    const cleanTitle = title.trim();
    const id =
      cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'project';

    const project: Project = {
      id,
      title: cleanTitle,
      created_at: new Date().toISOString(),
      git_remote: git_remote || undefined,
    };

    const projDir = `${this.vaultPath}/${id}`;
    try {
      await Filesystem.mkdir({
        path: projDir,
        directory: this.vaultDirectory,
        recursive: true,
      });
    } catch {
      // Exists
    }

    // Write index.md manifest
    const manifestContent = dumpProjectManifest(project, DEFAULT_MOBILE_BUCKETS);
    await Filesystem.writeFile({
      path: `${projDir}/index.md`,
      directory: this.vaultDirectory,
      data: manifestContent,
      encoding: Encoding.UTF8,
    });

    // Save to Dexie cache
    await db.projects.put(project);
    for (const b of DEFAULT_MOBILE_BUCKETS) {
      await db.buckets.put({ ...b, project_id: id });
    }

    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    await this.ensureInitialized();
    const existing = await db.projects.get(id);
    if (!existing) throw new Error(`Project ${id} not found`);

    const updated: Project = { ...existing, ...updates };
    await db.projects.put(updated);

    // Update index.md
    const buckets = await this.getBuckets(id);
    const manifestContent = dumpProjectManifest(updated, buckets);
    await Filesystem.writeFile({
      path: `${this.vaultPath}/${id}/index.md`,
      directory: this.vaultDirectory,
      data: manifestContent,
      encoding: Encoding.UTF8,
    });

    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    await this.ensureInitialized();
    await db.projects.delete(id);
    await db.buckets.where('project_id').equals(id).delete();
    await db.tasks.where('project_id').equals(id).delete();

    try {
      await Filesystem.rmdir({
        path: `${this.vaultPath}/${id}`,
        directory: this.vaultDirectory,
        recursive: true,
      });
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // TASKS
  // ==========================================

  async getAllTasks(filters?: TaskFilterParams): Promise<Task[]> {
    await this.ensureInitialized();
    const query = db.tasks.toCollection();
    const tasks = await query.toArray();

    return this.applyFilters(tasks, filters);
  }

  async getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
    if (!projectId || projectId === 'null' || projectId === 'undefined') return [];
    await this.ensureInitialized();
    const tasks = await db.tasks.where('project_id').equals(projectId).toArray();
    return this.applyFilters(tasks, filters);
  }

  async getTask(_projectId: string, id: string): Promise<Task> {
    await this.ensureInitialized();
    const task = await db.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);
    return task;
  }

  async createTask(projectId: string, taskData: any): Promise<Task> {
    await this.ensureInitialized();
    const nowIso = new Date().toISOString();
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const task: Task = {
      id,
      project_id: projectId,
      title: taskData.title.trim(),
      bucket: taskData.bucket || 'todo',
      position: typeof taskData.position === 'number' ? taskData.position : Date.now(),
      tags: taskData.tags || [],
      attachments: taskData.attachments || [],
      body: taskData.body || '',
      due_date: taskData.due_date,
      planned_date: taskData.planned_date,
      priority: taskData.priority,
      color: taskData.color,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Write file to disk
    const content = dumpTaskMarkdown(task);
    await Filesystem.writeFile({
      path: `${this.vaultPath}/${projectId}/${id}.md`,
      directory: this.vaultDirectory,
      data: content,
      encoding: Encoding.UTF8,
    });

    // Update Dexie
    await db.tasks.put(task);
    return task;
  }

  async updateTask(_projectId: string, id: string, updates: Partial<Task>): Promise<Task> {
    await this.ensureInitialized();
    const existing = await db.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found`);

    const updated: Task = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // If project changed, move file
    if (updates.project_id && updates.project_id !== existing.project_id) {
      try {
        await Filesystem.deleteFile({
          path: `${this.vaultPath}/${existing.project_id}/${id}.md`,
          directory: this.vaultDirectory,
        });
      } catch (_e) {
        // File may not exist yet
      }
    }

    const content = dumpTaskMarkdown(updated);
    await Filesystem.writeFile({
      path: `${this.vaultPath}/${updated.project_id}/${id}.md`,
      directory: this.vaultDirectory,
      data: content,
      encoding: Encoding.UTF8,
    });

    await db.tasks.put(updated);
    return updated;
  }

  async moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
    return this.updateTask(projectId, id, { bucket, position });
  }

  async deleteTask(projectId: string, id: string): Promise<void> {
    await this.ensureInitialized();
    await db.tasks.delete(id);

    try {
      await Filesystem.deleteFile({
        path: `${this.vaultPath}/${projectId}/${id}.md`,
        directory: this.vaultDirectory,
      });
    } catch {
      // File may already be removed
    }
  }

  private applyFilters(tasks: Task[], filters?: TaskFilterParams): Task[] {
    if (!filters) return tasks.sort((a, b) => a.position - b.position);

    let result = tasks;

    if (filters.bucket) {
      result = result.filter((t) => t.bucket === filters.bucket);
    }
    if (filters.buckets) {
      const bList = filters.buckets.split(',').map((b) => b.trim().toLowerCase());
      result = result.filter((t) => bList.includes(t.bucket.toLowerCase()));
    }
    if (filters.exclude_bucket) {
      result = result.filter((t) => t.bucket !== filters.exclude_bucket);
    }
    if (filters.exclude_buckets) {
      const ebList = filters.exclude_buckets.split(',').map((b) => b.trim().toLowerCase());
      result = result.filter((t) => !ebList.includes(t.bucket.toLowerCase()));
    }
    if (filters.tag) {
      result = result.filter((t) => t.tags.includes(filters.tag!.toLowerCase()));
    }
    if (filters.tags) {
      const tList = filters.tags.split(',').map((t) => t.trim().toLowerCase());
      if (filters.tag_mode === 'all') {
        result = result.filter((t) => tList.every((tag) => t.tags.includes(tag)));
      } else {
        result = result.filter((t) => tList.some((tag) => t.tags.includes(tag)));
      }
    }
    if (filters.priorities) {
      const pList = filters.priorities.split(',').map((p) => p.trim().toLowerCase());
      result = result.filter((t) => {
        if (!t.priority && pList.includes('none')) return true;
        return t.priority && pList.includes(t.priority.toLowerCase());
      });
    }
    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.body.toLowerCase().includes(term) ||
          t.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    }
    if (filters.due_before) {
      result = result.filter((t) => t.due_date && t.due_date <= filters.due_before!);
    }
    if (filters.due_after) {
      result = result.filter((t) => t.due_date && t.due_date >= filters.due_after!);
    }
    if (filters.planned_date) {
      result = result.filter((t) => t.planned_date === filters.planned_date);
    }
    if (filters.has_due_date === true) {
      result = result.filter((t) => Boolean(t.due_date));
    } else if (filters.has_due_date === false) {
      result = result.filter((t) => !t.due_date);
    }

    return result.sort((a, b) => a.position - b.position);
  }

  // ==========================================
  // BUCKETS
  // ==========================================

  async getBuckets(projectId: string): Promise<Bucket[]> {
    if (!projectId || projectId === 'null' || projectId === 'undefined') return [];
    await this.ensureInitialized();
    const buckets = await db.buckets.where('project_id').equals(projectId).toArray();
    if (buckets.length === 0) {
      for (const b of DEFAULT_MOBILE_BUCKETS) {
        await db.buckets.put({ ...b, project_id: projectId });
      }
      return DEFAULT_MOBILE_BUCKETS;
    }
    return buckets.sort((a, b) => a.position - b.position);
  }

  async createBucket(
    projectId: string,
    title: string,
    subtitle = '',
    color?: string | null,
    layout: 'list' | 'grid-2' | 'grid-3' = 'list',
    max_tasks?: number | null
  ): Promise<Bucket> {
    await this.ensureInitialized();
    const name =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'col';
    const existing = await this.getBuckets(projectId);
    const maxPos = existing.reduce((max, b) => Math.max(max, b.position), 0);

    const bucket: Bucket = {
      name,
      title: title.trim(),
      subtitle: subtitle.trim(),
      position: maxPos + 1000.0,
      color: color || null,
      layout,
      max_tasks: max_tasks ?? null,
      is_default: false,
    };

    await db.buckets.put({ ...bucket, project_id: projectId });
    await this.persistProjectManifest(projectId);
    return bucket;
  }

  async updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
    await this.ensureInitialized();
    const existing = await db.buckets.where('[project_id+name]').equals([projectId, name]).first();
    if (!existing) throw new Error(`Column ${name} not found`);

    const updated: Bucket = { ...existing, ...bucketUpdates };
    await db.buckets.put({ ...updated, project_id: projectId });
    await this.persistProjectManifest(projectId);
    return updated;
  }

  async deleteBucket(projectId: string, name: string): Promise<void> {
    await this.ensureInitialized();
    await db.buckets.where('[project_id+name]').equals([projectId, name]).delete();
    await this.persistProjectManifest(projectId);
  }

  private async persistProjectManifest(projectId: string): Promise<void> {
    const project = await db.projects.get(projectId);
    if (!project) return;
    const buckets = await this.getBuckets(projectId);
    const content = dumpProjectManifest(project, buckets);

    try {
      await Filesystem.writeFile({
        path: `${this.vaultPath}/${projectId}/index.md`,
        directory: this.vaultDirectory,
        data: content,
        encoding: Encoding.UTF8,
      });
    } catch (_e) {
      // Manifest write error handling
    }
  }

  // ==========================================
  // SETTINGS
  // ==========================================

  async getSettings(): Promise<AppSettings> {
    const settingRow = await db.settings.get('app_settings');
    if (settingRow) {
      return { ...DEFAULT_SETTINGS, ...settingRow.value };
    }
    return { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await db.settings.put({ key: 'app_settings', value: settings });
  }

  // ==========================================
  // TIMEBLOCKS
  // ==========================================

  async getTimeblocks(params?: { startDate?: string; endDate?: string }): Promise<Timeblock[]> {
    await this.ensureInitialized();
    let timeblocks = await db.timeblocks.toArray();
    if (params?.startDate && params?.endDate) {
      timeblocks = timeblocks.filter((t) => t.date >= params.startDate! && t.date <= params.endDate!);
    }
    return timeblocks.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  async getTimeblock(id: string): Promise<Timeblock> {
    await this.ensureInitialized();
    const tb = await db.timeblocks.get(id);
    if (!tb) throw new Error('Timeblock not found');
    return tb;
  }

  async createTimeblock(data: Omit<Timeblock, 'id'>): Promise<Timeblock> {
    await this.ensureInitialized();
    const id = `tb_${Date.now()}`;
    const tb: Timeblock = { id, ...data, task_ids: data.task_ids || [] };
    await db.timeblocks.put(tb);
    return tb;
  }

  async updateTimeblock(id: string, updates: Partial<Timeblock>): Promise<Timeblock> {
    await this.ensureInitialized();
    const existing = await db.timeblocks.get(id);
    if (!existing) throw new Error('Timeblock not found');
    const updated: Timeblock = { ...existing, ...updates };
    await db.timeblocks.put(updated);
    return updated;
  }

  async deleteTimeblock(id: string): Promise<void> {
    await this.ensureInitialized();
    await db.timeblocks.delete(id);
  }

  async allocateTaskToTimeblock(timeblockId: string, taskId: string, action: 'add' | 'remove' = 'add'): Promise<Timeblock> {
    await this.ensureInitialized();
    const all = await db.timeblocks.toArray();
    if (action === 'add') {
      for (const tb of all) {
        if (tb.task_ids.includes(taskId)) {
          tb.task_ids = tb.task_ids.filter((t) => t !== taskId);
          await db.timeblocks.put(tb);
        }
      }
      const target = await db.timeblocks.get(timeblockId);
      if (target) {
        target.task_ids.push(taskId);
        await db.timeblocks.put(target);
        return target;
      }
    } else {
      const target = await db.timeblocks.get(timeblockId);
      if (target) {
        target.task_ids = target.task_ids.filter((t) => t !== taskId);
        await db.timeblocks.put(target);
        return target;
      }
    }
    throw new Error('Timeblock not found');
  }

  // ==========================================
  // SYSTEM & DISK SYNCHRONIZATION
  // ==========================================

  async syncSystem(): Promise<{ status: string; synchronized_tasks: number }> {
    let syncedCount = 0;
    try {
      const rootEntries = await Filesystem.readdir({
        path: this.vaultPath,
        directory: this.vaultDirectory,
      });

      const diskProjects: string[] = [];

      for (const entry of rootEntries.files) {
        const isDir = entry.type === 'directory';
        const name = entry.name;
        if (isDir && !name.startsWith('.') && name !== 'tasks.db') {
          diskProjects.push(name);
          const projPath = `${this.vaultPath}/${name}`;

          // Read index.md if present
          let project: Project = { id: name, title: name.charAt(0).toUpperCase() + name.slice(1), created_at: new Date().toISOString() };
          let buckets: Bucket[] = [...DEFAULT_MOBILE_BUCKETS];

          try {
            const indexFile = await Filesystem.readFile({
              path: `${projPath}/index.md`,
              directory: this.vaultDirectory,
              encoding: Encoding.UTF8,
            });
            if (typeof indexFile.data === 'string') {
              const parsed = parseProjectManifest(indexFile.data, name);
              project = parsed.project;
              buckets = parsed.buckets;
            }
          } catch {
            // Write default index.md if absent
            const initialManifest = dumpProjectManifest(project, buckets);
            await Filesystem.writeFile({
              path: `${projPath}/index.md`,
              directory: this.vaultDirectory,
              data: initialManifest,
              encoding: Encoding.UTF8,
            });
          }

          await db.projects.put(project);
          for (const b of buckets) {
            await db.buckets.put({ ...b, project_id: name });
          }

          // Scan task markdown files
          try {
            const projFiles = await Filesystem.readdir({
              path: projPath,
              directory: this.vaultDirectory,
            });

            const diskTaskIds = new Set<string>();

            for (const f of projFiles.files) {
              if (f.type === 'file' && f.name.endsWith('.md') && f.name !== 'index.md') {
                try {
                  const taskFile = await Filesystem.readFile({
                    path: `${projPath}/${f.name}`,
                    directory: this.vaultDirectory,
                    encoding: Encoding.UTF8,
                  });
                  if (typeof taskFile.data === 'string') {
                    const task = parseTaskMarkdown(taskFile.data, name, f.name);
                    diskTaskIds.add(task.id);
                    await db.tasks.put(task);
                    syncedCount++;
                  }
                } catch (_e) {
                  // Skip unreadable files
                }
              }
            }

            // Remove deleted tasks from cache
            const cachedTasks = await db.tasks.where('project_id').equals(name).toArray();
            for (const ct of cachedTasks) {
              if (!diskTaskIds.has(ct.id)) {
                await db.tasks.delete(ct.id);
              }
            }
          } catch (_e) {
            // Skip directory if unreadable
          }
        }
      }

      // Cleanup deleted projects from cache
      const cachedProjects = await db.projects.toArray();
      for (const cp of cachedProjects) {
        if (!diskProjects.includes(cp.id)) {
          await db.projects.delete(cp.id);
          await db.buckets.where('project_id').equals(cp.id).delete();
          await db.tasks.where('project_id').equals(cp.id).delete();
        }
      }
    } catch {
      // Vault path may not exist yet
    }

    return { status: 'ok', synchronized_tasks: syncedCount };
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return {
      version: '3.8.3 (Mobile)',
      data_dir: `${this.vaultPath} (Android Documents)`,
    };
  }

  async getGitHistory(): Promise<GitCommit[]> {
    return [];
  }

  async restoreCommit(): Promise<{ synchronized_tasks: number }> {
    return { synchronized_tasks: 0 };
  }
}
