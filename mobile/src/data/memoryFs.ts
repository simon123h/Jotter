import type { FsEntry, FsPort } from './fs';

/** An in-memory FsPort, for tests. Folders are implied by file paths plus an explicit set. */
export class MemoryFs implements FsPort {
  files = new Map<string, { data: string; mtime: number }>();
  dirs = new Set<string>(['']);
  private clock = 1;
  /** Paths written, in order: lets tests check what was and was not touched. */
  writes: string[] = [];

  private tick() {
    return this.clock++;
  }

  private parent(path: string) {
    return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  }

  private ensureDirs(path: string) {
    for (let dir = this.parent(path); dir; dir = this.parent(dir)) this.dirs.add(dir);
  }

  async list(path: string): Promise<FsEntry[]> {
    if (!this.dirs.has(path)) throw new Error(`No such folder: ${path}`);
    const prefix = path ? `${path}/` : '';
    const out = new Map<string, FsEntry>();
    for (const [file, { data, mtime }] of this.files) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      const name = rest.split('/')[0];
      out.set(name, rest.includes('/') ? { name, type: 'directory', size: 0, mtime: 0 } : { name, type: 'file', size: data.length, mtime });
    }
    for (const dir of this.dirs) {
      if (dir && this.parent(dir) === path)
        out.set(dir.slice(prefix.length), { name: dir.slice(prefix.length), type: 'directory', size: 0, mtime: 0 });
    }
    return [...out.values()];
  }

  async stat(path: string) {
    const f = this.files.get(path);
    if (!f) throw new Error(`No such file: ${path}`);
    return { size: f.data.length, mtime: f.mtime };
  }

  async exists(path: string) {
    return this.files.has(path) || this.dirs.has(path);
  }

  async readText(path: string) {
    const f = this.files.get(path);
    if (!f) throw new Error(`No such file: ${path}`);
    return f.data;
  }

  async writeText(path: string, data: string) {
    this.ensureDirs(path);
    this.files.set(path, { data, mtime: this.tick() });
    this.writes.push(path);
  }

  async writeBase64(path: string, data: string) {
    await this.writeText(path, data);
  }

  async rename(from: string, to: string) {
    this.ensureDirs(to);
    for (const [file, entry] of [...this.files]) {
      if (file === from || file.startsWith(`${from}/`)) {
        this.files.delete(file);
        this.files.set(to + file.slice(from.length), { ...entry, mtime: this.tick() });
      }
    }
    for (const dir of [...this.dirs]) {
      if (dir === from || dir.startsWith(`${from}/`)) {
        this.dirs.delete(dir);
        this.dirs.add(to + dir.slice(from.length));
      }
    }
    this.writes.push(to);
  }

  async remove(path: string) {
    this.files.delete(path);
  }

  async removeDir(path: string) {
    for (const file of [...this.files.keys()]) if (file.startsWith(`${path}/`)) this.files.delete(file);
    for (const dir of [...this.dirs]) if (dir === path || dir.startsWith(`${path}/`)) this.dirs.delete(dir);
  }

  async mkdir(path: string) {
    this.dirs.add(path);
    this.ensureDirs(path);
  }

  fileUrl(path: string) {
    return `memory://${path}`;
  }

  /** Test helper: put a file on disk as another app (desktop, sync tool) would. */
  put(path: string, data: string) {
    this.ensureDirs(path);
    this.files.set(path, { data, mtime: this.tick() });
  }
}
