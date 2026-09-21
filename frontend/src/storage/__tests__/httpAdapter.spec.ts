import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpStorageAdapter } from '../httpAdapter';
import { isServerOnline } from '../connectionState';

describe('HttpStorageAdapter', () => {
  let adapter: HttpStorageAdapter;
  let fetchMock: any;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    isServerOnline.value = true;
    adapter = new HttpStorageAdapter();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('checkStatus', () => {
    it('sets isServerOnline to true if status check returns 200', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
      const online = await adapter.checkStatus();
      expect(online).toBe(true);
      expect(isServerOnline.value).toBe(true);
    });

    it('sets isServerOnline to false on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network offline'));
      const online = await adapter.checkStatus();
      expect(online).toBe(false);
      expect(isServerOnline.value).toBe(false);
    });
  });

  describe('Project & Task REST calls', () => {
    it('fetches, creates, updates, and deletes projects', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'proj-1', title: 'P1' }] });
      const projects = await adapter.getProjects();
      expect(projects).toEqual([{ id: 'proj-1', title: 'P1' }]);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 'proj-2', title: 'P2' }) });
      const created = await adapter.createProject('P2');
      expect(created.title).toBe('P2');

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'proj-2', title: 'P2 Updated' }) });
      const updated = await adapter.updateProject('proj-2', { title: 'P2 Updated' });
      expect(updated.title).toBe('P2 Updated');

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      await expect(adapter.deleteProject('proj-2')).resolves.toBeUndefined();
    });

    it('handles tasks, filtering, attachments, and moves', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 't1', title: 'Task 1' }] });
      const tasks = await adapter.getTasks('proj-1', { bucket: 'todo', tag: 'urgent', search: 'test' });
      expect(tasks).toHaveLength(1);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 't1', title: 'Task 1' }) });
      const single = await adapter.getTask('proj-1', 't1');
      expect(single.id).toBe('t1');

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 't1', bucket: 'done', position: 100 }) });
      const moved = await adapter.moveTask('proj-1', 't1', 'done', 100);
      expect(moved.bucket).toBe('done');

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      await expect(adapter.deleteTask('proj-1', 't1')).resolves.toBeUndefined();
    });

    it('manages buckets and settings', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ name: 'todo', title: 'To Do' }] });
      const buckets = await adapter.getBuckets('proj-1');
      expect(buckets).toHaveLength(1);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ currentTheme: 'midnight' }) });
      const settings = await adapter.getSettings();
      expect(settings.currentTheme).toBe('midnight');

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      await expect(adapter.saveSettings(settings as any)).resolves.toBeUndefined();
    });

    it('manages timeblocks, allocations, and git history', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'tb-1', title: 'Focus' }] });
      const tbs = await adapter.getTimeblocks({ startDate: '2026-09-01', endDate: '2026-09-30' });
      expect(tbs).toHaveLength(1);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'tb-1', task_ids: ['t1'] }) });
      const alloc = await adapter.allocateTaskToTimeblock('tb-1', 't1', 'add');
      expect(alloc.task_ids).toContain('t1');

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ hash: 'abc1234', message: 'commit 1' }] });
      const history = await adapter.getGitHistory('proj-1');
      expect(history).toHaveLength(1);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ synchronized_tasks: 5 }) });
      const syncRes = await adapter.syncSystem();
      expect(syncRes.synchronized_tasks).toBe(5);
    });
  });
});
