import Dexie, { type Table } from 'dexie';
import type { Task, Project, Bucket } from '@jotter/vault-format';

/** Cache columns: the file a row was read from, to skip unchanged files on the next scan. */
export interface FileStamp {
  file: string;
  size: number;
  mtime: number;
}

/** `legacy_day`: the day a file with a planning keyword was read, since the day it stands for moves with the calendar. */
export type CachedTask = Task & FileStamp & { legacy_day?: string };
export type CachedProject = Project & { size: number; mtime: number };
export type CachedBucket = Bucket & { project_id: string };

/**
 * The index of one vault, rebuilt from its files at any time. There is one database per vault, so switching
 * vaults never mixes rows.
 */
export class VaultDb extends Dexie {
  tasks!: Table<CachedTask, [string, string]>;
  projects!: Table<CachedProject, string>;
  buckets!: Table<CachedBucket, [string, string]>;

  constructor(name: string) {
    super(name);
    const stores = {
      tasks: '[project_id+id], [project_id+file], project_id, bucket, *tags',
      projects: 'id',
      buckets: '[project_id+name], project_id',
    };
    this.version(1).stores(stores);
    // The planned date changed shape (a day, a week or a month, no keywords, no postponed_until): rows read by the older
    // parser are dropped, so that the next scan reads every file again.
    this.version(2)
      .stores(stores)
      .upgrade((tx) => tx.table('tasks').clear());
  }
}
