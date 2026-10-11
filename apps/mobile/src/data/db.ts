import Dexie, { type Table } from 'dexie';
import type { Task, Project, Bucket } from '@jotter/vault-format';

/** Cache columns: the file a row was read from, to skip unchanged files on the next scan. */
export interface FileStamp {
  file: string;
  size: number;
  mtime: number;
}

export type CachedTask = Task & FileStamp;
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
    this.version(1).stores({
      tasks: '[project_id+id], [project_id+file], project_id, bucket, *tags',
      projects: 'id',
      buckets: '[project_id+name], project_id',
    });
  }
}
