import { describe, it, expect, beforeEach } from 'vitest';
import { DemoStorageAdapter } from '../demoAdapter';
import { createStorageAdapter, getStorageAdapter, setStorageAdapter } from '../index';
import { HttpStorageAdapter } from '../httpAdapter';

describe('DemoStorageAdapter', () => {
  let adapter: DemoStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new DemoStorageAdapter();
  });

  it('reports itself as online', async () => {
    expect(await adapter.checkStatus()).toBe(true);
  });

  it('returns tasks from every project for getAllTasks', async () => {
    const [seeded] = await adapter.getProjects();
    const perProject = await adapter.getTasks(seeded.id);
    expect(perProject.length).toBeGreaterThan(0);

    const other = await adapter.createProject('Another');
    const buckets = await adapter.getBuckets(other.id);
    await adapter.createTask(other.id, { title: 'extra', bucket: buckets[0].name });

    const all = await adapter.getAllTasks();
    expect(all.length).toBe(perProject.length + 1);
  });

  it('rejects attachment uploads', async () => {
    await expect(adapter.uploadAttachment()).rejects.toThrow('not supported in demo mode');
  });

  it('round-trips settings through localStorage', async () => {
    const settings = { ...(await adapter.getSettings()), currentTheme: 'frost' };
    await adapter.saveSettings(settings);
    expect((await adapter.getSettings()).currentTheme).toBe('frost');
  });

  it('supports timeblock CRUD and task allocation', async () => {
    const created = await adapter.createTimeblock({
      title: 'Focus',
      date: '2026-01-02',
      start_time: '09:00',
      end_time: '10:00',
      task_ids: [],
    });
    expect(await adapter.getTimeblocks({ startDate: '2026-01-02', endDate: '2026-01-02' })).toHaveLength(1);
    expect(await adapter.getTimeblocks({ startDate: '2026-01-03' })).toHaveLength(0);

    const added = await adapter.allocateTaskToTimeblock(created.id, 't1');
    expect(added.task_ids).toEqual(['t1']);
    const removed = await adapter.allocateTaskToTimeblock(created.id, 't1', 'remove');
    expect(removed.task_ids).toEqual([]);

    await adapter.deleteTimeblock(created.id);
    await expect(adapter.getTimeblock(created.id)).rejects.toThrow('not found');
  });
});

describe('storage adapter factory', () => {
  it('defaults to the HTTP adapter outside demo and native mode', () => {
    expect(createStorageAdapter()).toBeInstanceOf(HttpStorageAdapter);
  });

  it('memoises the adapter and allows overriding it', () => {
    setStorageAdapter(null);
    const first = getStorageAdapter();
    expect(getStorageAdapter()).toBe(first);

    const fake = new DemoStorageAdapter();
    setStorageAdapter(fake);
    expect(getStorageAdapter()).toBe(fake);
    setStorageAdapter(null);
  });
});
