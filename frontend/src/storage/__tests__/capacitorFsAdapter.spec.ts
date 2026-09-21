import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CapacitorFsStorageAdapter, PREF_VAULT_PATH, PREF_VAULT_DIR } from '../capacitorFsAdapter';
import { db } from '../dexieDb';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

// Mock Capacitor plugins
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    mkdir: vi.fn().mockResolvedValue({}),
    writeFile: vi.fn().mockResolvedValue({}),
    readFile: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue({}),
    rmdir: vi.fn().mockResolvedValue({}),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
  },
  Directory: {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
  },
  Encoding: {
    UTF8: 'utf8',
  },
}));

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) || null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

describe('CapacitorFsStorageAdapter', () => {
  let adapter: CapacitorFsStorageAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.tasks.clear();
    await db.projects.clear();
    await db.buckets.clear();
    await db.timeblocks.clear();
    await db.settings.clear();

    adapter = new CapacitorFsStorageAdapter();
  });

  describe('Initialization and Status', () => {
    it('always returns true for checkStatus', async () => {
      expect(await adapter.checkStatus()).toBe(true);
    });

    it('can set and get vault path', async () => {
      await adapter.setVaultPath('CustomVault', Directory.Data);
      const currentPath = await adapter.getVaultPath();
      expect(currentPath).toBe('CustomVault');
      expect(Preferences.set).toHaveBeenCalledWith({
        key: PREF_VAULT_PATH,
        value: 'CustomVault',
      });
      expect(Preferences.set).toHaveBeenCalledWith({
        key: PREF_VAULT_DIR,
        value: Directory.Data,
      });
    });
  });

  describe('Project Management', () => {
    it('creates and reads projects', async () => {
      const proj = await adapter.createProject('My Mobile Project');
      expect(proj.title).toBe('My Mobile Project');
      expect(proj.id).toBe('my-mobile-project');

      const all = await adapter.getProjects();
      expect(all.some((p) => p.id === 'my-mobile-project')).toBe(true);

      expect(Filesystem.mkdir).toHaveBeenCalled();
      expect(Filesystem.writeFile).toHaveBeenCalled();
    });

    it('updates a project and its manifest', async () => {
      const proj = await adapter.createProject('Test Project');
      const updated = await adapter.updateProject(proj.id, { title: 'Updated Project Title' });
      expect(updated.title).toBe('Updated Project Title');

      const dbProj = await db.projects.get(proj.id);
      expect(dbProj?.title).toBe('Updated Project Title');
    });

    it('deletes a project and its associated data', async () => {
      const proj = await adapter.createProject('Delete Me');
      await adapter.createTask(proj.id, { title: 'Task to be deleted', bucket: 'todo' });

      await adapter.deleteProject(proj.id);

      const dbProj = await db.projects.get(proj.id);
      expect(dbProj).toBeUndefined();

      const tasks = await db.tasks.where('project_id').equals(proj.id).toArray();
      expect(tasks).toHaveLength(0);

      expect(Filesystem.rmdir).toHaveBeenCalled();
    });
  });

  describe('Task Operations', () => {
    it('creates, retrieves, updates, moves, and deletes tasks', async () => {
      const proj = await adapter.createProject('Task Proj');

      // Create
      const task = await adapter.createTask(proj.id, {
        title: 'Mobile Task',
        bucket: 'todo',
        tags: ['mobile', 'sync'],
        body: 'Task body details',
        due_date: '2026-10-01',
        priority: 'high',
      });

      expect(task.title).toBe('Mobile Task');
      expect(task.bucket).toBe('todo');
      expect(task.tags).toEqual(['mobile', 'sync']);
      expect(Filesystem.writeFile).toHaveBeenCalled();

      // Retrieve
      const single = await adapter.getTask(proj.id, task.id);
      expect(single.id).toBe(task.id);

      const list = await adapter.getTasks(proj.id);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(task.id);

      // Update
      const updated = await adapter.updateTask(proj.id, task.id, { title: 'Updated Mobile Task' });
      expect(updated.title).toBe('Updated Mobile Task');

      // Move
      const moved = await adapter.moveTask(proj.id, task.id, 'done', 500);
      expect(moved.bucket).toBe('done');
      expect(moved.position).toBe(500);

      // Filters
      const filtered = await adapter.getAllTasks({ bucket: 'done' });
      expect(filtered).toHaveLength(1);

      const notFoundFiltered = await adapter.getAllTasks({ bucket: 'todo' });
      expect(notFoundFiltered).toHaveLength(0);

      // Delete
      await adapter.deleteTask(proj.id, task.id);
      expect(Filesystem.deleteFile).toHaveBeenCalled();
      const afterDelete = await db.tasks.get(task.id);
      expect(afterDelete).toBeUndefined();
    });

    it('applies complex task filters correctly', async () => {
      const proj = await adapter.createProject('Filter Proj');
      await adapter.createTask(proj.id, {
        title: 'Alpha task',
        bucket: 'todo',
        tags: ['work', 'urgent'],
        due_date: '2026-05-01',
        priority: 'high',
      });
      await adapter.createTask(proj.id, {
        title: 'Beta task',
        bucket: 'in-progress',
        tags: ['work'],
        due_date: '2026-06-01',
        priority: 'medium',
      });
      await adapter.createTask(proj.id, { title: 'Gamma task', bucket: 'done', tags: ['home'], planned_date: '2026-07-01' });

      // Filter by tag
      const tagFiltered = await adapter.getTasks(proj.id, { tag: 'urgent' });
      expect(tagFiltered).toHaveLength(1);
      expect(tagFiltered[0].title).toBe('Alpha task');

      // Filter by multiple tags with all mode
      const multiTagAnd = await adapter.getTasks(proj.id, { tags: 'work,urgent', tag_mode: 'all' });
      expect(multiTagAnd).toHaveLength(1);

      // Filter by multiple tags with any mode
      const multiTagOr = await adapter.getTasks(proj.id, { tags: 'home,urgent', tag_mode: 'any' });
      expect(multiTagOr).toHaveLength(2);

      // Filter by search keyword
      const searched = await adapter.getTasks(proj.id, { search: 'beta' });
      expect(searched).toHaveLength(1);
      expect(searched[0].title).toBe('Beta task');

      // Filter by date ranges
      const dueBefore = await adapter.getTasks(proj.id, { due_before: '2026-05-15' });
      expect(dueBefore).toHaveLength(1);

      const hasDueDate = await adapter.getTasks(proj.id, { has_due_date: false });
      expect(hasDueDate).toHaveLength(1);
      expect(hasDueDate[0].title).toBe('Gamma task');
    });
  });

  describe('Bucket Management', () => {
    it('creates, updates, and deletes buckets', async () => {
      const proj = await adapter.createProject('Bucket Proj');

      const initialBuckets = await adapter.getBuckets(proj.id);
      expect(initialBuckets.length).toBeGreaterThan(0);

      // Create new bucket
      const newBucket = await adapter.createBucket(proj.id, 'Testing Column', 'QA bucket', '#ff0000');
      expect(newBucket.title).toBe('Testing Column');
      expect(newBucket.name).toBe('testing-column');

      // Update bucket
      const updatedBucket = await adapter.updateBucket(proj.id, newBucket.name, { title: 'QA Column' });
      expect(updatedBucket.title).toBe('QA Column');

      // Delete bucket
      await adapter.deleteBucket(proj.id, newBucket.name);
      const afterDelete = await adapter.getBuckets(proj.id);
      expect(afterDelete.some((b) => b.name === newBucket.name)).toBe(false);
    });
  });

  describe('Timeblock Operations', () => {
    it('creates, updates, filters, and deletes timeblocks', async () => {
      const tb = await adapter.createTimeblock({
        title: 'Focus Sprint',
        date: '2026-09-22',
        start_time: '09:00',
        end_time: '11:00',
        task_ids: [],
      });

      expect(tb.id).toBeDefined();
      expect(tb.title).toBe('Focus Sprint');

      const single = await adapter.getTimeblock(tb.id);
      expect(single.title).toBe('Focus Sprint');

      const rangeList = await adapter.getTimeblocks({
        startDate: '2026-09-20',
        endDate: '2026-09-25',
      });
      expect(rangeList).toHaveLength(1);

      // Allocate task
      const withAlloc = await adapter.allocateTaskToTimeblock(tb.id, 'task-123', 'add');
      expect(withAlloc.task_ids).toContain('task-123');

      // Remove task
      const withoutAlloc = await adapter.allocateTaskToTimeblock(tb.id, 'task-123', 'remove');
      expect(withoutAlloc.task_ids).not.toContain('task-123');

      // Delete timeblock
      await adapter.deleteTimeblock(tb.id);
      await expect(adapter.getTimeblock(tb.id)).rejects.toThrow();
    });
  });

  describe('Settings & System Info', () => {
    it('saves and reads app settings', async () => {
      const defaultSettings = await adapter.getSettings();
      expect(defaultSettings.currentTheme).toBe('nordic-light');

      await adapter.saveSettings({
        ...defaultSettings,
        currentTheme: 'theme-midnight',
        thresholdDays: 14,
      });

      const updated = await adapter.getSettings();
      expect(updated.currentTheme).toBe('theme-midnight');
      expect(updated.thresholdDays).toBe(14);
    });

    it('provides mock system info and git history for mobile', async () => {
      const info = await adapter.getSystemInfo();
      expect(info.version).toBeDefined();

      const history = await adapter.getGitHistory();
      expect(history).toEqual([]);

      const restore = await adapter.restoreCommit('abcd123');
      expect(restore.synchronized_tasks).toBe(0);
    });
  });

  describe('System Synchronization (Disk Scan)', () => {
    it('scans and parses project files from filesystem into database', async () => {
      (Filesystem.readdir as any).mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'Jotter') {
          return {
            files: [{ name: 'demo-proj', type: 'directory' }],
          };
        }
        if (path === 'Jotter/demo-proj') {
          return {
            files: [
              { name: 'index.md', type: 'file' },
              { name: 'task1.md', type: 'file' },
            ],
          };
        }
        return { files: [] };
      });

      (Filesystem.readFile as any).mockImplementation(async ({ path }: { path: string }) => {
        if (path === 'Jotter/demo-proj/index.md') {
          return {
            data: `---\nid: demo-proj\ntitle: Demo Project\n---\n# Buckets\n- todo: To Do`,
          };
        }
        if (path === 'Jotter/demo-proj/task1.md') {
          return {
            data: `---\nid: task1\nproject_id: demo-proj\ntitle: Synced Task 1\nbucket: todo\n---\nHello from sync!`,
          };
        }
        return { data: '' };
      });

      const result = await adapter.syncSystem();
      expect(result.status).toBe('ok');
      expect(result.synchronized_tasks).toBe(1);

      const proj = await db.projects.get('demo-proj');
      expect(proj?.title).toBe('Demo Project');

      const task = await db.tasks.get('task1');
      expect(task?.title).toBe('Synced Task 1');
    });
  });
});
