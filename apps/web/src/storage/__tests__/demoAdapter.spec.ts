import { describe, it, expect, beforeEach } from 'vitest';
import { DemoStorageAdapter, clearDemoData } from '../demoAdapter';
import { taskUrl, duplicateOf } from '@jotter/links';
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

  it('returns the tasks of every project that is not archived for getAllTasks', async () => {
    const projects = (await adapter.getProjects()).filter((p) => !p.archived);
    const perProject = (await Promise.all(projects.map((p) => adapter.getTasks(p.id)))).flat();
    expect(perProject.length).toBeGreaterThan(0);

    const other = await adapter.createProject('Another');
    const buckets = await adapter.getBuckets(other.id);
    await adapter.createTask(other.id, { title: 'extra', bucket: buckets[0].name });

    const all = await adapter.getAllTasks();
    expect(all.length).toBe(perProject.length + 1);
  });

  it('starts with projects that show links, postponing and archiving', async () => {
    const projects = await adapter.getProjects();
    expect(projects.map((p) => p.id)).toEqual(['demo-project', 'reading-list', 'summer-trip']);
    expect(projects.filter((p) => p.archived).map((p) => p.id)).toEqual(['summer-trip']);

    // The bookmarks: an address in the notes, one in the title, and a page that the new-task dialog calls "already saved"
    const links = await adapter.getTasks('reading-list');
    expect(links.filter((t) => taskUrl(t)).length).toBeGreaterThanOrEqual(3);
    expect(duplicateOf('https://www.obsidian.md/?utm_source=x', links)?.title).toContain('Obsidian');

    // A task planned far ahead in its own column, a column with a limit, and nothing of the archived project in the "all" view
    const demo = await adapter.getTasks('demo-project');
    expect(demo.find((t) => t.planned_date?.startsWith('20') && t.title.includes('planned for next month'))?.bucket).toBe('todo');
    expect((await adapter.getBuckets('demo-project')).find((b) => b.name === 'in-progress')?.max_tasks).toBe(3);
    expect((await adapter.getAllTasks()).some((t) => t.project_id === 'summer-trip')).toBe(false);
  });

  it('seeds again after the demo is cleared, and when the seed data is newer than the stored copy', async () => {
    const [first] = await adapter.getProjects();
    await adapter.updateProject(first.id, { title: 'Mine' });
    await adapter.createProject('Another');
    expect((await adapter.getProjects()).length).toBe(4);

    clearDemoData();
    expect((await adapter.getProjects()).map((p) => p.title)).toContain('Demo Project');
    expect((await adapter.getProjects()).length).toBe(3);

    await adapter.createProject('Another');
    localStorage.setItem('jotter_demo_seed_version', '0');
    expect((await adapter.getProjects()).length).toBe(3);
  });

  it('clears only what the demo stored', () => {
    localStorage.setItem('jotter_demo_projects', '[]');
    localStorage.setItem('jotter-demo-settings', '{}');
    localStorage.setItem('jotter_demo_canvas_p_list', '[]');
    localStorage.setItem('unrelated', 'kept');
    clearDemoData();
    expect(Object.keys(localStorage)).toEqual(['unrelated']);
  });

  it('reports the build version, marked as demo', async () => {
    const { version, data_dir } = await adapter.getSystemInfo();
    expect(version).toBe(`${__APP_VERSION__} (demo)`);
    expect(version).not.toContain('2.9.1');
    expect(data_dir).toBe('/demo-local-storage');
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
