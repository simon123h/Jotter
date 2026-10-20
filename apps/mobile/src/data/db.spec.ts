import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect } from 'vitest';
import { VaultDb } from './db';

describe('VaultDb', () => {
  it('drops the tasks read by an older parser, so that the next scan reads every file again', async () => {
    const name = 'db-upgrade-test';
    // A cache as the version before the planned date change left it: a keyword that is no longer a planned value
    const old = new Dexie(name);
    old.version(1).stores({
      tasks: '[project_id+id], [project_id+file], project_id, bucket, *tags',
      projects: 'id',
      buckets: '[project_id+name], project_id',
    });
    await old.table('tasks').put({ project_id: 'p', id: 't', file: 't', size: 1, mtime: 1, tags: [], planned_date: 'thisMonth' });
    await old.table('projects').put({ id: 'p', title: 'P', size: 1, mtime: 1 });
    old.close();

    const db = new VaultDb(name);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.projects.count()).toBe(1); // only the tasks were read by the parser that changed
    db.close();
  });
});
