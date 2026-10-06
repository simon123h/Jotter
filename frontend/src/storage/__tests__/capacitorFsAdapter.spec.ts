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
    rename: vi.fn().mockResolvedValue({}),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
    getUri: vi.fn().mockResolvedValue({ uri: 'file:///storage/emulated/0/Documents' }),
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
    it('is not supported on mobile: lists nothing and rejects writes', async () => {
      expect(await adapter.getTimeblocks()).toEqual([]);
      await expect(
        adapter.createTimeblock({ title: 'Focus', date: '2026-09-22', start_time: '09:00', end_time: '11:00', task_ids: [] })
      ).rejects.toThrow('not supported');
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
        pinnedProjectIds: ['work-proj'],
      });

      const updated = await adapter.getSettings();
      expect(updated.currentTheme).toBe('theme-midnight');
      expect(updated.thresholdDays).toBe(14);
      expect(updated.pinnedProjectIds).toEqual(['work-proj']);

      // Clear Dexie to simulate Android WebView clearing cache/IndexedDB
      await db.settings.clear();
      const restored = await adapter.getSettings();
      expect(restored.currentTheme).toBe('theme-midnight');
      expect(restored.thresholdDays).toBe(14);
      expect(restored.pinnedProjectIds).toEqual(['work-proj']);
    });

    it('provides mock system info and git history for mobile', async () => {
      const info = await adapter.getSystemInfo();
      // Falls back to the build version when the native app info is unavailable
      expect(info.version).toBe(`${__APP_VERSION__} (Mobile)`);
      expect(info.version).not.toContain('3.9.5');

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

  describe('Attachments', () => {
    beforeEach(async () => {
      await Preferences.clear();
    });

    const makeTask = async () => {
      const proj = await adapter.createProject('Attach Proj');
      const task = await adapter.createTask(proj.id, { title: 'With files', bucket: 'todo' });
      return { proj, task };
    };

    it('writes the file below the project attachments folder and records it on the task', async () => {
      const { proj, task } = await makeTask();
      const file = new File(['hello'], 'note.txt', { type: 'text/plain' });

      const updated = await adapter.uploadAttachment(proj.id, task.id, file);

      expect(updated.attachments).toEqual(['note.txt']);
      expect(Filesystem.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: `Jotter/${proj.id}/attachments/${task.id}/note.txt`, data: btoa('hello'), recursive: true })
      );
      expect((await adapter.getTask(proj.id, task.id)).attachments).toEqual(['note.txt']);
    });

    it('strips directories from uploaded file names and does not duplicate references', async () => {
      const { proj, task } = await makeTask();
      await adapter.uploadAttachment(proj.id, task.id, new File(['a'], '../../evil.txt'));
      const again = await adapter.uploadAttachment(proj.id, task.id, new File(['b'], 'evil.txt'));
      expect(again.attachments).toEqual(['evil.txt']);
      expect(Filesystem.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: `Jotter/${proj.id}/attachments/${task.id}/evil.txt` })
      );
    });

    it('deletes the file and the reference', async () => {
      const { proj, task } = await makeTask();
      await adapter.uploadAttachment(proj.id, task.id, new File(['x'], 'a.png'));

      const updated = await adapter.deleteAttachment(proj.id, task.id, 'a.png');

      expect(updated.attachments).toEqual([]);
      expect(Filesystem.deleteFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: `Jotter/${proj.id}/attachments/${task.id}/a.png` })
      );
    });

    it('removes the attachment folder when the task is deleted', async () => {
      const { proj, task } = await makeTask();
      await adapter.deleteTask(proj.id, task.id);
      expect(Filesystem.rmdir).toHaveBeenCalledWith(
        expect.objectContaining({ path: `Jotter/${proj.id}/attachments/${task.id}`, recursive: true })
      );
    });

    it('moves the attachment folder when the task changes project', async () => {
      const { proj, task } = await makeTask();
      await adapter.uploadAttachment(proj.id, task.id, new File(['x'], 'a.png'));
      vi.mocked(Filesystem.rename).mockClear();

      await adapter.updateTask(proj.id, task.id, { project_id: 'other' });

      expect(Filesystem.rename).toHaveBeenCalledWith(
        expect.objectContaining({
          from: `Jotter/${proj.id}/attachments/${task.id}`,
          to: `Jotter/other/attachments/${task.id}`,
        })
      );
    });

    it('does not rename anything when the task has no attachment folder', async () => {
      const { proj, task } = await makeTask();
      vi.mocked(Filesystem.rename).mockClear();
      vi.mocked(Filesystem.readdir).mockRejectedValueOnce(new Error('missing'));
      await adapter.updateTask(proj.id, task.id, { project_id: 'other' });
      expect(Filesystem.rename).not.toHaveBeenCalled();
    });

    it('builds a loadable URL for an attachment once initialized', async () => {
      const { proj, task } = await makeTask();
      const url = adapter.getAttachmentUrl(proj.id, task.id, 'my photo.png');
      expect(url).toContain(`Documents/Jotter/${proj.id}/attachments/${task.id}/my%20photo.png`);
    });
  });

  describe('Vaults', () => {
    beforeEach(async () => {
      await Preferences.clear();
      vi.mocked(Filesystem.readdir).mockResolvedValue({ files: [] } as any);
    });

    it('migrates the legacy vault path into a single active default vault', async () => {
      await Preferences.set({ key: PREF_VAULT_PATH, value: 'Notes/Jotter' });
      const vaults = await adapter.getVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0]).toMatchObject({ id: 'default', name: 'Jotter', path: 'Notes/Jotter', is_active: true, is_git: false });
    });

    it('creates a vault folder and rejects duplicates and paths escaping Documents', async () => {
      const created = await adapter.createVault({ name: 'Work', path: 'Work/Jotter', create_dir: true });
      expect(created).toMatchObject({ id: 'work', path: 'Work/Jotter', is_active: false });
      expect(Filesystem.mkdir).toHaveBeenCalledWith(expect.objectContaining({ path: 'Work/Jotter', recursive: true }));
      await expect(adapter.createVault({ name: 'Again', path: 'Work/Jotter' })).rejects.toThrow('already exists');
      await expect(adapter.createVault({ name: 'Evil', path: '../outside' })).rejects.toThrow('inside Documents');
    });

    it('refuses to open a folder that does not exist', async () => {
      vi.mocked(Filesystem.readdir).mockRejectedValueOnce(new Error('missing'));
      await expect(adapter.createVault({ name: 'Ghost', path: 'Ghost' })).rejects.toThrow('Folder not found');
    });

    it('switches vaults, rebuilds the index and keeps settings per vault', async () => {
      await adapter.getVaults();
      await adapter.saveSettings({ ...(await adapter.getSettings()), thresholdDays: 3 });
      await db.projects.put({ id: 'old', title: 'Old', created_at: '' });
      await adapter.createVault({ name: 'Work', path: 'Work', create_dir: true });

      vi.mocked(Filesystem.readdir).mockImplementation((async ({ path }: { path: string }) =>
        path === 'Work' ? { files: [{ name: 'newproj', type: 'directory' }] } : { files: [] }) as any);
      vi.mocked(Filesystem.readFile).mockRejectedValue(new Error('none'));

      const switched = await adapter.switchVault('work');
      expect(switched.is_active).toBe(true);
      expect((await adapter.getVaults()).find((v) => v.id === 'default')?.is_active).toBe(false);
      expect((await db.projects.toArray()).map((p) => p.id)).toEqual(['newproj']);
      expect((await adapter.getSettings()).thresholdDays).not.toBe(3);

      await adapter.switchVault('default');
      expect((await adapter.getSettings()).thresholdDays).toBe(3);
    });

    it('renames vaults and refuses to remove the last one', async () => {
      await adapter.getVaults();
      expect((await adapter.renameVault('default', 'Home')).name).toBe('Home');
      await expect(adapter.deleteVault('default')).rejects.toThrow('last vault');
    });

    it('removes a vault registration and falls back to another vault when it was active', async () => {
      await adapter.getVaults();
      await adapter.createVault({ name: 'Work', path: 'Work', create_dir: true });
      await adapter.switchVault('work');
      await adapter.deleteVault('work');
      const vaults = await adapter.getVaults();
      expect(vaults.map((v) => v.id)).toEqual(['default']);
      expect(vaults[0].is_active).toBe(true);
      expect(Filesystem.rmdir).not.toHaveBeenCalled();
    });
  });
});
