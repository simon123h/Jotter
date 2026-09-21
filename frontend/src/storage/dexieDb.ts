import Dexie, { type Table } from 'dexie';
import type { Task, Project, Bucket, Timeblock } from '@/types';

export interface CachedSetting {
  key: string;
  value: any;
}

export class JotterDexieDb extends Dexie {
  tasks!: Table<Task, string>;
  projects!: Table<Project, string>;
  buckets!: Table<Bucket & { id?: string; project_id: string }, string>;
  timeblocks!: Table<Timeblock, string>;
  settings!: Table<CachedSetting, string>;

  constructor() {
    super('JotterMobileDb');
    this.version(1).stores({
      tasks: 'id, project_id, bucket, position, due_date, planned_date, priority, *tags',
      projects: 'id, title',
      buckets: '[project_id+name], project_id, position',
      timeblocks: 'id, date',
      settings: 'key',
    });
  }
}

export const db = new JotterDexieDb();
