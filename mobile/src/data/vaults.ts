import type { FsPort } from './fs';
import type { KeyValue } from './keyValue';

export interface Vault {
  id: string;
  name: string;
  /** Folder below the storage root, for example `Jotter` or `Work/Jotter`. */
  path: string;
  created_at: string;
}

interface Registry {
  vaults: Vault[];
  active: string | null;
}

const KEY = 'jotter_lite_vaults';

const slug = (text: string, fallback: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback;

/** Vaults are plain folders below the storage root; reject anything that could escape it. */
export function normalizeVaultPath(path: string): string {
  const clean = path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!clean) throw new Error('Vault folder cannot be empty');
  if (clean.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')) {
    throw new Error('Vault folder must be a path inside Documents');
  }
  return clean;
}

/** The list of vaults and which one is open, kept in key/value storage. */
export class VaultRegistry {
  private cache: Registry | null = null;
  private readonly fs: FsPort;
  private readonly kv: KeyValue;

  constructor(fs: FsPort, kv: KeyValue) {
    this.fs = fs;
    this.kv = kv;
  }

  private async load(): Promise<Registry> {
    if (this.cache) return this.cache;
    let registry: Registry = { vaults: [], active: null };
    try {
      const raw = await this.kv.get(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.vaults)) registry = parsed;
    } catch {
      // A corrupt registry starts empty: the vault folders themselves are untouched
    }
    if (registry.active && !registry.vaults.some((v) => v.id === registry.active)) registry.active = null;
    this.cache = registry;
    return registry;
  }

  private async save(registry: Registry): Promise<void> {
    this.cache = registry;
    await this.kv.set(KEY, JSON.stringify(registry));
  }

  async list(): Promise<Vault[]> {
    return [...(await this.load()).vaults];
  }

  async active(): Promise<Vault | null> {
    const registry = await this.load();
    return registry.vaults.find((v) => v.id === registry.active) ?? null;
  }

  /** Adds a vault. `create` makes the folder, otherwise it must already exist. The first vault becomes active. */
  async add(input: { name: string; path: string; create?: boolean }): Promise<Vault> {
    const registry = await this.load();
    const path = normalizeVaultPath(input.path);
    const name = input.name.trim() || path.split('/').pop()!;
    if (registry.vaults.some((v) => v.path === path)) throw new Error('A vault for this folder already exists');

    if (input.create) {
      await this.fs.mkdir(path);
    } else if (!(await this.fs.exists(path))) {
      throw new Error('Folder not found in Documents');
    }

    const base = slug(name, 'vault');
    let id = base;
    for (let n = 2; registry.vaults.some((v) => v.id === id); n++) id = `${base}-${n}`;

    const vault: Vault = { id, name, path, created_at: new Date().toISOString() };
    registry.vaults.push(vault);
    registry.active ??= vault.id;
    await this.save(registry);
    return vault;
  }

  async rename(id: string, name: string): Promise<Vault> {
    const registry = await this.load();
    const vault = registry.vaults.find((v) => v.id === id);
    if (!vault) throw new Error('Vault not found');
    const clean = name.trim();
    if (!clean) throw new Error('Vault name cannot be empty');
    vault.name = clean;
    await this.save(registry);
    return vault;
  }

  async activate(id: string): Promise<Vault> {
    const registry = await this.load();
    const vault = registry.vaults.find((v) => v.id === id);
    if (!vault) throw new Error('Vault not found');
    registry.active = id;
    await this.save(registry);
    return vault;
  }

  /** Forgets a vault. Its folder and files stay on disk. If it was open, the next vault (if any) becomes active. */
  async remove(id: string): Promise<void> {
    const registry = await this.load();
    if (!registry.vaults.some((v) => v.id === id)) throw new Error('Vault not found');
    registry.vaults = registry.vaults.filter((v) => v.id !== id);
    if (registry.active === id) registry.active = registry.vaults[0]?.id ?? null;
    await this.save(registry);
  }
}
