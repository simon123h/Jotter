import {
  parseTaskMarkdown,
  dumpTaskMarkdown,
  parseProjectManifest,
  dumpProjectManifest,
  rollOver,
  DEFAULT_MOBILE_BUCKETS,
  type Task,
  type Project,
  type Bucket,
} from '@jotter/vault-format';
import { filterTasks, type TaskFilter } from '@jotter/task-filter';
import { VaultDb, type CachedTask } from './db';
import type { FsPort } from './fs';
import { isoDay } from '@/dates';
import { ulid } from './ulid';
import { VaultRegistry, type Vault } from './vaults';

export interface NewTask {
  title: string;
  /** Defaults to the project's default bucket. */
  bucket?: string;
  body?: string;
  tags?: string[];
  due_date?: string;
  planned_date?: string;
  postponed_until?: string;
  priority?: string;
  color?: string | null;
}

export type TaskUpdate = Partial<Omit<Task, 'id' | 'project_id' | 'created_at' | 'updated_at' | 'extra_frontmatter'>>;

export interface SyncResult {
  /** Task files read (new or changed since the last scan). */
  read: number;
  /** Task files that could not be read (for example invalid YAML). They are left untouched. */
  unreadable: string[];
  /** Anything the cache learned from the files: a changed, new or removed task, manifest or project. */
  changed: boolean;
}

const slug = (text: string, fallback: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback;

const NO_INDEX = -1;

const isTaskFile = (entry: { name: string; type: string }) => {
  const lower = entry.name.toLowerCase();
  return entry.type === 'file' && lower.endsWith('.md') && !entry.name.startsWith('.') && lower !== 'index.md' && lower !== 'readme.md';
};

/** A reminder that has not come yet, with what a notification shows. */
export interface UpcomingReminder {
  projectId: string;
  projectTitle: string;
  taskId: string;
  title: string;
  /** Local date-time, `YYYY-MM-DDTHH:mm`. */
  at: string;
}

function toTask(row: CachedTask): Task {
  const { file, size, mtime, ...task } = row;
  return task;
}

/**
 * Reads and writes the open vault: its files are the source of truth, an IndexedDB cache makes listing and
 * filtering fast. Every write goes to the file first, then to the cache.
 */
export class VaultRepository {
  private db: VaultDb | null = null;
  private vault: Vault | null = null;
  private readonly fs: FsPort;
  private readonly registry: VaultRegistry;
  private readonly openDb: (name: string) => VaultDb;

  constructor(fs: FsPort, registry: VaultRegistry, openDb: (name: string) => VaultDb = (name) => new VaultDb(name)) {
    this.fs = fs;
    this.registry = registry;
    this.openDb = openDb;
  }

  private current() {
    if (!this.db || !this.vault) throw new Error('No vault is open');
    return { db: this.db, vault: this.vault };
  }

  private projectDir(projectId: string) {
    return `${this.current().vault.path}/${projectId}`;
  }

  // ==========================================
  // VAULTS
  // ==========================================

  listVaults(): Promise<Vault[]> {
    return this.registry.list();
  }

  /** The vault that is open, or null on first launch. */
  activeVault(): Promise<Vault | null> {
    return this.registry.active();
  }

  /** Opens the active vault and scans it. Returns null when there is no vault yet. */
  async open(): Promise<Vault | null> {
    const vault = await this.registry.active();
    this.vault = vault;
    this.db = vault ? this.openDb(`jotter:${vault.id}`) : null;
    if (vault) await this.sync();
    return vault;
  }

  async addVault(input: { name: string; path: string; create?: boolean }): Promise<Vault> {
    const hadActive = this.vault !== null;
    const vault = await this.registry.add(input);
    if (!hadActive) await this.open();
    return vault;
  }

  renameVault(id: string, name: string): Promise<Vault> {
    return this.registry.rename(id, name);
  }

  async switchVault(id: string): Promise<Vault> {
    const vault = await this.registry.activate(id);
    await this.open();
    return vault;
  }

  /** Forgets a vault and its cache. The folder and its files stay on disk. */
  async removeVault(id: string): Promise<void> {
    const wasOpen = this.vault?.id === id;
    await this.registry.remove(id);
    await this.openDb(`jotter:${id}`).delete();
    if (wasOpen) await this.open();
  }

  // ==========================================
  // SETTINGS (settings.json in the vault, shared with the desktop app)
  // ==========================================

  private settingsWrites: Promise<unknown> = Promise.resolve();

  private async readSettingsFile(path: string): Promise<Record<string, unknown>> {
    if (!(await this.fs.exists(path))) return {};
    const parsed: unknown = JSON.parse(await this.fs.readText(path));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  }

  /** The vault's settings.json as an object. A missing or unreadable file reads as empty. */
  async readSettings(): Promise<Record<string, unknown>> {
    try {
      return await this.readSettingsFile(`${this.current().vault.path}/settings.json`);
    } catch {
      return {};
    }
  }

  /**
   * Changes some keys of settings.json and keeps all others (the desktop app has many more). A file that cannot be
   * read is not overwritten. Writes run one after the other, so two quick changes do not lose each other.
   */
  updateSettings(patch: Record<string, unknown>): Promise<void> {
    const path = `${this.current().vault.path}/settings.json`;
    const write = this.settingsWrites.then(async () => {
      const current = await this.readSettingsFile(path);
      await this.fs.writeText(path, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`);
    });
    this.settingsWrites = write.catch(() => undefined);
    return write;
  }

  // ==========================================
  // SCAN: files -> cache
  // ==========================================

  /** Brings the cache in line with the files. Only files whose size or modification time changed are read. */
  async sync(): Promise<SyncResult> {
    const { db, vault } = this.current();
    const result: SyncResult = { read: 0, unreadable: [], changed: false };

    const entries = await this.fs.list(vault.path);
    const projectIds = entries.filter((e) => e.type === 'directory' && !e.name.startsWith('.') && e.name !== 'tasks.db').map((e) => e.name);
    for (const id of projectIds) await this.syncProject(id, result);

    for (const cached of await db.projects.toArray()) {
      if (!projectIds.includes(cached.id)) {
        await this.dropProjectCache(cached.id);
        result.changed = true;
      }
    }
    return result;
  }

  private async dropProjectCache(id: string) {
    const { db } = this.current();
    await db.tasks.where('project_id').equals(id).delete();
    await db.buckets.where('project_id').equals(id).delete();
    await db.projects.delete(id);
  }

  private async syncProject(id: string, result: SyncResult) {
    const { db } = this.current();
    const dir = this.projectDir(id);
    const entries = await this.fs.list(dir);

    // The manifest: a missing one behaves like an empty one and is not written just for reading
    const index = entries.find((e) => e.type === 'file' && e.name === 'index.md');
    const stamp = index ? { size: index.size, mtime: index.mtime } : { size: NO_INDEX, mtime: NO_INDEX };
    const cached = await db.projects.get(id);
    if (!cached || cached.size !== stamp.size || cached.mtime !== stamp.mtime) {
      const { project, buckets } = parseProjectManifest(index ? await this.fs.readText(`${dir}/index.md`) : '', id);
      result.changed = true;
      await db.projects.put({ ...project, ...stamp });
      await db.buckets.where('project_id').equals(id).delete();
      await db.buckets.bulkPut(buckets.map((b) => ({ ...b, project_id: id })));
    }

    const seen = new Set<string>();
    for (const entry of entries.filter(isTaskFile)) {
      const file = entry.name.slice(0, -3);
      seen.add(file);
      const row = await db.tasks.where('[project_id+file]').equals([id, file]).first();
      if (row && row.size === entry.size && row.mtime === entry.mtime) continue;
      try {
        const task = parseTaskMarkdown(await this.fs.readText(`${dir}/${entry.name}`), id, entry.name);
        if (row && row.id !== task.id) await db.tasks.delete([id, row.id]);
        await db.tasks.put({ ...task, file, size: entry.size, mtime: entry.mtime });
        result.read++;
        result.changed = true;
      } catch {
        // Unreadable (invalid YAML, say): never cached, so it can never be edited and overwritten
        result.unreadable.push(`${dir}/${entry.name}`);
        if (row) {
          await db.tasks.delete([id, row.id]);
          result.changed = true;
        }
      }
    }
    const gone = await db.tasks
      .where('project_id')
      .equals(id)
      .filter((t) => !seen.has(t.file))
      .delete();
    if (gone > 0) result.changed = true;
  }

  // ==========================================
  // PROJECTS AND BUCKETS
  // ==========================================

  async listProjects(): Promise<Project[]> {
    const { db } = this.current();
    const rows = await db.projects.toArray();

    return rows.map(({ size, mtime, ...project }) => project).sort((a, b) => a.title.localeCompare(b.title));
  }

  async createProject(title: string): Promise<Project> {
    const { db } = this.current();
    const clean = title.trim();
    if (!clean) throw new Error('Project title cannot be empty');

    const base = slug(clean, 'project');
    let id = base;
    for (let n = 2; (await db.projects.get(id)) || (await this.fs.exists(this.projectDir(id))); n++) id = `${base}-${n}`;

    const project: Project = { id, title: clean, created_at: new Date().toISOString() };
    const buckets = DEFAULT_MOBILE_BUCKETS.map((b) => ({ ...b }));
    await this.fs.mkdir(this.projectDir(id));
    await db.projects.put({ ...project, size: NO_INDEX, mtime: NO_INDEX });
    await db.buckets.bulkPut(buckets.map((b) => ({ ...b, project_id: id })));
    await this.persistManifest(id);
    return project;
  }

  async updateProject(id: string, updates: Partial<Pick<Project, 'title' | 'description' | 'done_clean_period'>>): Promise<Project> {
    const { db } = this.current();
    const existing = await db.projects.get(id);
    if (!existing) throw new Error(`Project ${id} not found`);
    if (updates.title !== undefined && !updates.title.trim()) throw new Error('Project title cannot be empty');
    await db.projects.put({ ...existing, ...updates, title: updates.title?.trim() ?? existing.title });
    await this.persistManifest(id);
    return (await this.listProjects()).find((p) => p.id === id)!;
  }

  /** Deletes the project's folder with all its tasks and attachments. */
  async deleteProject(id: string): Promise<void> {
    await this.fs.removeDir(this.projectDir(id));
    await this.dropProjectCache(id);
  }

  async listBuckets(projectId: string): Promise<Bucket[]> {
    const { db } = this.current();
    const rows = await db.buckets.where('project_id').equals(projectId).toArray();
    return rows.map(({ project_id: _project, ...bucket }) => bucket).sort((a, b) => a.position - b.position);
  }

  async createBucket(projectId: string, input: { title: string; color?: string | null; layout?: Bucket['layout'] }): Promise<Bucket> {
    const { db } = this.current();
    const title = input.title.trim();
    if (!title) throw new Error('Bucket title cannot be empty');
    const existing = await this.listBuckets(projectId);

    const base = slug(title, 'bucket');
    let name = base;
    for (let n = 2; existing.some((b) => b.name === name); n++) name = `${base}-${n}`;

    const bucket: Bucket = {
      name,
      title,
      subtitle: '',
      position: Math.max(0, ...existing.map((b) => b.position)) + 1000,
      color: input.color ?? null,
      layout: input.layout ?? 'list',
      max_tasks: null,
      is_default: false,
    };
    await db.buckets.put({ ...bucket, project_id: projectId });
    await this.persistManifest(projectId);
    return bucket;
  }

  async updateBucket(projectId: string, name: string, updates: Partial<Omit<Bucket, 'name'>>): Promise<Bucket> {
    const { db } = this.current();
    const existing = await db.buckets.get([projectId, name]);
    if (!existing) throw new Error(`Bucket ${name} not found`);
    const updated = { ...existing, ...updates };
    await db.buckets.put(updated);
    await this.persistManifest(projectId);
    const { project_id: _project, ...bucket } = updated;
    return bucket;
  }

  /** Refuses while tasks are still in the bucket, so no task is left pointing at a bucket that is gone. */
  async deleteBucket(projectId: string, name: string): Promise<void> {
    const { db } = this.current();
    const inUse = await db.tasks
      .where('project_id')
      .equals(projectId)
      .filter((t) => t.bucket === name)
      .count();
    if (inUse > 0) throw new Error('Move or delete the tasks in this bucket first');
    await db.buckets.delete([projectId, name]);
    await this.persistManifest(projectId);
  }

  /** Rewrites index.md from the cache. Its body and unknown keys are kept (they live on the project row). */
  private async persistManifest(projectId: string) {
    const { db } = this.current();
    const row = await db.projects.get(projectId);
    if (!row) return;
    const path = `${this.projectDir(projectId)}/index.md`;

    const { size, mtime, ...project } = row;
    await this.fs.writeText(path, dumpProjectManifest(project, await this.listBuckets(projectId)));
    await db.projects.put({ ...row, ...(await this.stamp(path)) });
  }

  // ==========================================
  // TASKS
  // ==========================================

  /** Tasks of one project, or of all projects when `projectId` is null. Sorted by position. */
  async listTasks(projectId: string | null, filter: TaskFilter = {}): Promise<Task[]> {
    const { db } = this.current();
    const rows = projectId === null ? await db.tasks.toArray() : await db.tasks.where('project_id').equals(projectId).toArray();
    return filterTasks(rows, filter)
      .sort((a, b) => a.position - b.position)
      .map(toTask);
  }

  /**
   * The reminders of open tasks in all projects that are due at `from` (`YYYY-MM-DDTHH:mm`, local time) or later,
   * the nearest first. Done and archived tasks do not remind.
   */
  async upcomingReminders(from: string, limit = 100): Promise<UpcomingReminder[]> {
    const projects = new Map((await this.listProjects()).map((p) => [p.id, p.title]));
    const found: UpcomingReminder[] = [];
    for (const task of await this.listTasks(null)) {
      if (task.bucket === 'done' || task.bucket === 'archive') continue;
      for (const at of task.reminders ?? []) {
        if (at >= from)
          found.push({
            projectId: task.project_id,
            projectTitle: projects.get(task.project_id) ?? task.project_id,
            taskId: task.id,
            title: task.title,
            at,
          });
      }
    }
    return found.sort((a, b) => a.at.localeCompare(b.at) || a.taskId.localeCompare(b.taskId)).slice(0, limit);
  }

  async getTask(projectId: string, id: string): Promise<Task> {
    return toTask(await this.row(projectId, id));
  }

  private async row(projectId: string, id: string): Promise<CachedTask> {
    const row = await this.current().db.tasks.get([projectId, id]);
    if (!row) throw new Error(`Task ${id} not found`);
    return row;
  }

  async createTask(projectId: string, input: NewTask): Promise<Task> {
    const { db } = this.current();
    const title = input.title.trim();
    if (!title) throw new Error('Task title cannot be empty');
    if (!(await db.projects.get(projectId))) throw new Error(`Project ${projectId} not found`);

    const buckets = await this.listBuckets(projectId);
    const bucket = input.bucket || (buckets.find((b) => b.is_default) ?? buckets[0])?.name || 'todo';
    const inBucket = await db.tasks
      .where('project_id')
      .equals(projectId)
      .filter((t) => t.bucket === bucket)
      .toArray();
    const now = new Date().toISOString();
    const id = ulid();

    const task: Task = {
      id,
      project_id: projectId,
      title,
      bucket,
      position: Math.max(0, ...inBucket.map((t) => t.position)) + 1000,
      tags: input.tags ?? [],
      attachments: [],
      body: input.body ?? '',
      due_date: input.due_date,
      planned_date: input.planned_date,
      postponed_until: input.postponed_until,
      priority: input.priority,
      color: input.color ?? undefined,
      created_at: now,
      updated_at: now,
      extra_frontmatter: {},
    };
    await this.writeTask(task, id);
    return task;
  }

  async updateTask(projectId: string, id: string, updates: TaskUpdate): Promise<Task> {
    const row = await this.row(projectId, id);
    if (updates.title !== undefined && !updates.title.trim()) throw new Error('Task title cannot be empty');
    const current = toTask(row);
    const edited: Task = { ...current, ...updates, updated_at: new Date().toISOString() };
    // Moving a recurring task into Done rolls it over instead: it stays where it is and comes back on its next day
    const completes = !!current.repeat && updates.bucket === 'done' && current.bucket !== 'done';
    const task = completes
      ? rollOver({ ...edited, bucket: current.bucket, position: current.position }, isoDay(), current.bucket, current.bucket)
      : edited;
    await this.writeTask(task, row.file);
    return task;
  }

  moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
    return this.updateTask(projectId, id, { bucket, position });
  }

  async deleteTask(projectId: string, id: string): Promise<void> {
    const row = await this.row(projectId, id);
    await this.fs.remove(`${this.projectDir(projectId)}/${row.file}.md`);
    await this.fs.removeDir(`${this.projectDir(projectId)}/attachments/${id}`);
    await this.current().db.tasks.delete([projectId, id]);
  }

  /**
   * Moves a task, with its attachments, into another project. It keeps its bucket when the target has one of that
   * name, otherwise it goes to the target's default bucket, and lands at the end of it. The new file is written
   * first and the old one removed last, so a failure in between leaves a copy, never a loss.
   */
  async moveToProject(projectId: string, id: string, targetProjectId: string): Promise<Task> {
    const { db } = this.current();
    const row = await this.row(projectId, id);
    if (projectId === targetProjectId) return toTask(row);
    if (!(await db.projects.get(targetProjectId))) throw new Error(`Project ${targetProjectId} not found`);

    const buckets = await this.listBuckets(targetProjectId);
    const bucket = buckets.some((b) => b.name === row.bucket)
      ? row.bucket
      : ((buckets.find((b) => b.is_default) ?? buckets[0])?.name ?? row.bucket);
    const inBucket = await db.tasks
      .where('project_id')
      .equals(targetProjectId)
      .filter((t) => t.bucket === bucket)
      .toArray();
    const newPath = `${this.projectDir(targetProjectId)}/${row.file}.md`;
    if (await this.fs.exists(newPath)) throw new Error('A task with the same id is already in that project');

    const task: Task = {
      ...toTask(row),
      project_id: targetProjectId,
      bucket,
      position: Math.max(0, ...inBucket.map((t) => t.position)) + 1000,
      updated_at: new Date().toISOString(),
    };
    await this.fs.writeText(newPath, dumpTaskMarkdown(task));

    const oldAttachments = `${this.projectDir(projectId)}/attachments/${id}`;
    if (await this.fs.exists(oldAttachments)) await this.fs.rename(oldAttachments, `${this.projectDir(targetProjectId)}/attachments/${id}`);

    await this.fs.remove(`${this.projectDir(projectId)}/${row.file}.md`);
    await db.tasks.delete([projectId, id]);
    await db.tasks.put({ ...task, file: row.file, ...(await this.stamp(newPath)) });
    return task;
  }

  private async writeTask(task: Task, file: string) {
    const { db } = this.current();
    const path = `${this.projectDir(task.project_id)}/${file}.md`;
    await this.fs.writeText(path, dumpTaskMarkdown(task));
    await db.tasks.put({ ...task, file, ...(await this.stamp(path)) });
  }

  /**
   * Size and modification time of a file just written, for the cache. They are only bookkeeping: when the file cannot
   * be statted (a sync tool replaced it that moment), the stamp matches nothing, so the next scan reads it again.
   */
  private async stamp(path: string): Promise<{ size: number; mtime: number }> {
    try {
      return await this.fs.stat(path);
    } catch {
      return { size: NO_INDEX, mtime: NO_INDEX };
    }
  }

  // ==========================================
  // ATTACHMENTS
  // ==========================================

  private attachmentPath(projectId: string, taskId: string, name: string) {
    return `${this.projectDir(projectId)}/attachments/${taskId}/${name}`;
  }

  /** Keeps only the file name: no directories, no traversal. */
  private safeName(name: string): string {
    const base = name.split(/[\\/]/).pop()?.trim() ?? '';
    if (!base || base === '.' || base === '..') throw new Error('Invalid attachment file name');
    return base;
  }

  async addAttachment(projectId: string, taskId: string, file: File): Promise<Task> {
    const task = await this.getTask(projectId, taskId);
    const name = this.safeName(file.name || 'attachment');
    await this.fs.writeBase64(this.attachmentPath(projectId, taskId, name), await readAsBase64(file));
    const attachments = task.attachments.includes(name) ? task.attachments : [...task.attachments, name];
    return this.updateTask(projectId, taskId, { attachments });
  }

  async removeAttachment(projectId: string, taskId: string, name: string): Promise<Task> {
    const task = await this.getTask(projectId, taskId);
    const clean = this.safeName(name);
    await this.fs.remove(this.attachmentPath(projectId, taskId, clean));
    return this.updateTask(projectId, taskId, { attachments: task.attachments.filter((a) => a !== clean) });
  }

  attachmentUrl(projectId: string, taskId: string, name: string): string {
    return this.fs.fileUrl(this.attachmentPath(projectId, taskId, name));
  }
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}
