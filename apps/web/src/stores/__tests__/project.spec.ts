import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/project';
import { useSettingsStore } from '@/stores/settings';
import * as api from '@/api';
import { createMockTask } from '@/__tests__/factories';
import type { Bucket, Project } from '@/types';

vi.mock('@/api', () => ({
  getProjects: vi.fn(),
  deleteProject: vi.fn(),
  getBuckets: vi.fn(),
  getTasks: vi.fn(),
  getTask: vi.fn(),
  getAllTasks: vi.fn(),
  updateTask: vi.fn(),
  restoreCommit: vi.fn(),
  // The settings store loads these when it is created
  getSettings: vi.fn(() => Promise.resolve({})),
  saveSettings: vi.fn(() => Promise.resolve()),
}));

const timeblocks = { fetchTimeblocks: vi.fn(() => Promise.resolve()) };
vi.mock('@/features/timeblock/stores/timeblock', () => ({ useTimeblockStore: () => timeblocks }));

const project = (id: string): Project => ({ id, title: id.toUpperCase(), created_at: '' });
const bucket = (name: string, position: number, extra: Partial<Bucket> = {}): Bucket => ({
  name,
  title: name,
  subtitle: '',
  position,
  ...extra,
});

describe('project store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.getProjects).mockResolvedValue([project('work'), project('home')]);
    vi.mocked(api.getBuckets).mockResolvedValue([]);
    vi.mocked(api.getTasks).mockResolvedValue([]);
    vi.mocked(api.getAllTasks).mockResolvedValue([]);
    timeblocks.fetchTimeblocks.mockResolvedValue(undefined);
  });

  describe('projects', () => {
    it('loads the projects, and keeps the message of a failure', async () => {
      const store = useProjectStore();
      await store.fetchProjects();
      expect(store.projects.map((p) => p.id)).toEqual(['work', 'home']);
      expect(store.projectsLoaded).toBe(true);

      vi.mocked(api.getProjects).mockRejectedValueOnce(new Error('offline'));
      await store.fetchProjects();
      expect(store.error).toBe('offline');
    });

    it('drops a project from the list at once when it is deleted, then loads the list again', async () => {
      const store = useProjectStore();
      await store.fetchProjects();
      let during: string[] = [];
      vi.mocked(api.deleteProject).mockImplementationOnce(async () => {
        during = store.projects.map((p) => p.id);
      });
      vi.mocked(api.getProjects).mockResolvedValueOnce([project('home')]);

      await store.removeProject('work');

      expect(during).toEqual(['work', 'home']);
      expect(store.projects.map((p) => p.id)).toEqual(['home']);
    });
  });

  describe('columns', () => {
    it('loads the columns of a project, and none for an unusable id or a project that is gone', async () => {
      const store = useProjectStore();
      vi.mocked(api.getBuckets).mockResolvedValue([bucket('todo', 1)]);
      await store.fetchBuckets('work');
      expect(store.buckets.map((b) => b.name)).toEqual(['todo']);

      for (const id of ['', 'null', 'undefined']) {
        await store.fetchBuckets(id);
        expect(store.buckets).toEqual([]);
      }

      await store.fetchProjects();
      vi.mocked(api.getBuckets).mockClear();
      await store.fetchBuckets('gone');
      expect(store.buckets).toEqual([]);
      expect(api.getBuckets).not.toHaveBeenCalled();
    });

    it('keeps the message when the columns cannot be loaded', async () => {
      const store = useProjectStore();
      vi.mocked(api.getBuckets).mockRejectedValueOnce(new Error('boom'));
      await store.fetchBuckets('work');
      expect(store.error).toBe('boom');
    });

    it('merges the columns of all projects by name, in order, and survives a project that fails', async () => {
      const store = useProjectStore();
      vi.mocked(api.getBuckets).mockImplementation(async (id: string) => {
        if (id === 'work') return [bucket('todo', 2, { title: 'Work todo' }), bucket('done', 9)];
        throw new Error('404');
      });
      await store.fetchBuckets('all'); // loads the projects first

      expect(api.getProjects).toHaveBeenCalled();
      expect(store.buckets.map((b) => [b.name, b.title])).toEqual([
        ['todo', 'Work todo'],
        ['done', 'done'],
      ]);
    });

    it('keeps the first column of a name when projects share it', async () => {
      const store = useProjectStore();
      await store.fetchProjects();
      vi.mocked(api.getBuckets).mockImplementation(async (id: string) => [bucket('todo', 1, { title: id })]);
      await store.fetchBuckets('all');
      expect(store.buckets).toHaveLength(1);
      expect(store.buckets[0].title).toBe('work');
    });
  });

  describe('tasks', () => {
    it('loads the tasks of a project without the columns that are hidden', async () => {
      const settings = useSettingsStore();
      settings.hideDoneColumn = true;
      settings.hideArchiveColumn = false;
      vi.mocked(api.getTasks).mockResolvedValue([createMockTask({ id: 'a' })]);
      const store = useProjectStore();

      await store.fetchTasks({ projectId: 'work' });

      expect(api.getTasks).toHaveBeenCalledWith('work', { exclude_buckets: 'done' });
      expect(store.tasks.map((t) => t.id)).toEqual(['a']);
      expect(store.loading).toBe(false);
    });

    it('loads all tasks for the "all" view and for a global query, with the columns of the query', async () => {
      const store = useProjectStore();
      await store.fetchTasks({ projectId: 'all', excludeBuckets: 'done' });
      expect(api.getAllTasks).toHaveBeenLastCalledWith({ exclude_buckets: 'done' });

      await store.fetchTasks({ projectId: 'work', isGlobal: true, excludeBuckets: '' });
      expect(api.getAllTasks).toHaveBeenLastCalledWith({ exclude_buckets: undefined });
      expect(api.getTasks).not.toHaveBeenCalled();
    });

    it('does not ask again for a query it has loaded, unless told to', async () => {
      const store = useProjectStore();
      await store.fetchTasks({ projectId: 'work', excludeBuckets: '' });
      await store.fetchTasks({ projectId: 'work', excludeBuckets: '' });
      expect(api.getTasks).toHaveBeenCalledTimes(1);

      await store.fetchTasks({ projectId: 'work', excludeBuckets: '' }, true);
      expect(api.getTasks).toHaveBeenCalledTimes(2);

      await store.fetchTasks({ projectId: 'home', excludeBuckets: '' });
      expect(api.getTasks).toHaveBeenCalledTimes(3);
    });

    it('shows no tasks for an unusable project id, or one that is gone', async () => {
      const store = useProjectStore();
      store.tasks = [createMockTask({ id: 'old' })];
      await store.fetchTasks({ projectId: 'null' });
      expect(store.tasks).toEqual([]);

      await store.fetchProjects();
      store.tasks = [createMockTask({ id: 'old' })];
      await store.fetchTasks({ projectId: 'gone' });
      expect(store.tasks).toEqual([]);
      expect(api.getTasks).not.toHaveBeenCalled();
    });

    it('keeps the answer of the newest request when an older one comes back later', async () => {
      const store = useProjectStore();
      let finishOld: (tasks: ReturnType<typeof createMockTask>[]) => void = () => undefined;
      vi.mocked(api.getTasks).mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)));
      vi.mocked(api.getTasks).mockResolvedValueOnce([createMockTask({ id: 'new' })]);

      const old = store.fetchTasks({ projectId: 'work', excludeBuckets: '' });
      await store.fetchTasks({ projectId: 'home', excludeBuckets: '' });
      finishOld([createMockTask({ id: 'old' })]);
      await old;

      expect(store.tasks.map((t) => t.id)).toEqual(['new']);
      expect(store.loading).toBe(false);
    });

    it('keeps the message when the tasks cannot be loaded', async () => {
      const store = useProjectStore();
      vi.mocked(api.getTasks).mockRejectedValueOnce(new Error('timeout'));
      await store.fetchTasks({ projectId: 'work' });
      expect(store.error).toBe('timeout');
      expect(store.loading).toBe(false);
    });

    it('loads the query again, and the timeblocks, when invalidated', async () => {
      const store = useProjectStore();
      await store.invalidate();
      expect(api.getTasks).not.toHaveBeenCalled();
      expect(timeblocks.fetchTimeblocks).toHaveBeenCalledTimes(1);

      await store.fetchTasks({ projectId: 'work', excludeBuckets: '' });
      await store.invalidate();
      expect(api.getTasks).toHaveBeenCalledTimes(2);

      timeblocks.fetchTimeblocks.mockRejectedValueOnce(new Error('x'));
      await expect(store.invalidate()).resolves.toBeUndefined();
    });

    it('adds a task, or replaces the one it has, and loads a task on demand', async () => {
      const store = useProjectStore();
      store.upsertTask(createMockTask({ id: 'a', title: 'One' }));
      store.upsertTask(createMockTask({ id: 'a', title: 'Two' }));
      store.upsertTask(createMockTask({ id: 'b' }));
      expect(store.tasks.map((t) => t.title)).toContain('Two');
      expect(store.tasks).toHaveLength(2);

      expect(await store.ensureTaskLoaded('work', 'a')).toBe(store.tasks[0]);
      expect(api.getTask).not.toHaveBeenCalled();

      vi.mocked(api.getTask).mockResolvedValueOnce(createMockTask({ id: 'c' }));
      expect((await store.ensureTaskLoaded('work', 'c'))?.id).toBe('c');
      expect(store.tasks.map((t) => t.id)).toContain('c');

      vi.mocked(api.getTask).mockRejectedValueOnce(new Error('404'));
      expect(await store.ensureTaskLoaded('work', 'nope')).toBeUndefined();
    });
  });

  describe('moving tasks to another project', () => {
    it('moves each task that is in another project, and leaves the ones that are already there', async () => {
      const store = useProjectStore();
      store.tasks = [createMockTask({ id: 'a', project_id: 'work' }), createMockTask({ id: 'b', project_id: 'home' })];

      await store.moveTasksToProject(['a', 'b'], 'home');

      expect(api.updateTask).toHaveBeenCalledTimes(1);
      expect(api.updateTask).toHaveBeenCalledWith('work', 'a', { project_id: 'home' });
    });

    it('puts them in the default column of the target on request, or its first, or todo', async () => {
      const store = useProjectStore();
      store.tasks = [createMockTask({ id: 'a', project_id: 'work' })];

      vi.mocked(api.getBuckets).mockResolvedValueOnce([bucket('one', 1), bucket('main', 2, { is_default: true })]);
      await store.moveTasksToProject(['a'], 'home', { resetToDefaultBucket: true });
      expect(api.updateTask).toHaveBeenLastCalledWith('work', 'a', { project_id: 'home', bucket: 'main', position: 1000 });

      vi.mocked(api.getBuckets).mockResolvedValueOnce([bucket('one', 1)]);
      await store.moveTasksToProject(['a'], 'home', { resetToDefaultBucket: true });
      expect(api.updateTask).toHaveBeenLastCalledWith('work', 'a', { project_id: 'home', bucket: 'one', position: 1000 });

      vi.mocked(api.getBuckets).mockResolvedValueOnce([]);
      await store.moveTasksToProject(['a'], 'home', { resetToDefaultBucket: true });
      expect(api.updateTask).toHaveBeenLastCalledWith('work', 'a', { project_id: 'home', bucket: 'todo', position: 1000 });
    });

    it('uses the current project for a task it does not hold', async () => {
      const store = useProjectStore();
      await store.moveTasksToProject(['unknown'], 'home', { currentProjectId: 'work' });
      expect(api.updateTask).toHaveBeenCalledWith('work', 'unknown', { project_id: 'home' });

      vi.mocked(api.updateTask).mockClear();
      await store.moveTasksToProject(['unknown'], 'home');
      expect(api.updateTask).not.toHaveBeenCalled();
    });
  });

  describe('vault switch and restore', () => {
    it('forgets everything of the vault on reset', async () => {
      const store = useProjectStore();
      await store.fetchProjects();
      await store.fetchTasks({ projectId: 'work', excludeBuckets: '' });
      store.error = 'old';

      store.reset();

      expect([store.projects, store.buckets, store.tasks]).toEqual([[], [], []]);
      expect(store.projectsLoaded).toBe(false);
      expect(store.cachedQueryKey).toBeNull();
      expect(store.error).toBeNull();
    });

    it('restores a commit, then loads projects, columns and tasks again', async () => {
      const store = useProjectStore();
      await store.fetchTasks({ projectId: 'work', excludeBuckets: '' });
      vi.mocked(api.getProjects).mockClear();
      vi.mocked(api.getTasks).mockClear();

      await store.restoreToCommit('abc123', 'work');

      expect(api.restoreCommit).toHaveBeenCalledWith('abc123', 'work');
      expect(api.getProjects).toHaveBeenCalled();
      expect(api.getBuckets).toHaveBeenCalledWith('work');
      expect(api.getTasks).toHaveBeenCalled();
      expect(store.syncSuccess).toBe(true);
      expect(store.syncLoading).toBe(false);
    });

    it('keeps the message and passes the error on when a restore fails', async () => {
      const store = useProjectStore();
      vi.mocked(api.restoreCommit).mockRejectedValueOnce(new Error('bad commit'));
      await expect(store.restoreToCommit('zzz')).rejects.toThrow('bad commit');
      expect(store.error).toBe('bad commit');
      expect(store.syncLoading).toBe(false);
      expect(store.syncSuccess).toBe(false);
    });
  });
});
