import { CapacitorFs } from './fs';
import { capacitorKeyValue } from './keyValue';
import { VaultRegistry } from './vaults';
import { VaultRepository } from './repository';

export type { Vault } from './vaults';
export type { TaskFilter, NewTask, TaskUpdate, SyncResult } from './repository';
export { VaultRepository } from './repository';

let repository: VaultRepository | null = null;

/** The app's repository, on the real storage. Created on first use. */
export async function getRepository(): Promise<VaultRepository> {
  if (!repository) {
    const fs = new CapacitorFs();
    await fs.init();
    repository = new VaultRepository(fs, new VaultRegistry(fs, capacitorKeyValue));
  }
  return repository;
}
