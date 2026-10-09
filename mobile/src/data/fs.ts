import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/** One entry of a folder listing. `mtime` is in milliseconds. */
export interface FsEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: number;
}

/**
 * The file operations the vault code needs. Paths are relative to the storage root (the Documents folder on
 * Android). A port instead of direct plugin calls keeps the vault code testable without the plugin.
 */
export interface FsPort {
  /** Lists a folder. Rejects when it does not exist. */
  list(path: string): Promise<FsEntry[]>;
  /** Size and modification time. Rejects when the file does not exist. */
  stat(path: string): Promise<{ size: number; mtime: number }>;
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  /** Writes atomically and creates missing parent folders. */
  writeText(path: string, data: string): Promise<void>;
  /** Same as writeText for binary data given as base64. */
  writeBase64(path: string, data: string): Promise<void>;
  /** Moves a file or a folder. Missing parent folders of the target are created. */
  rename(from: string, to: string): Promise<void>;
  /** Deletes a file. A missing file is not an error. */
  remove(path: string): Promise<void>;
  /** Deletes a folder with its content. A missing folder is not an error. */
  removeDir(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  /** A URL the WebView can load the file from, or '' when unknown. */
  fileUrl(path: string): string;
}

const ROOT = Directory.Documents;

/** The Android implementation, on top of @capacitor/filesystem. */
export class CapacitorFs implements FsPort {
  private baseUri: string | null = null;

  async list(path: string): Promise<FsEntry[]> {
    const { files } = await Filesystem.readdir({ path, directory: ROOT });
    return files.map((f) => ({ name: f.name, type: f.type, size: f.size ?? 0, mtime: f.mtime ?? 0 }));
  }

  async stat(path: string) {
    const s = await Filesystem.stat({ path, directory: ROOT });
    return { size: s.size ?? 0, mtime: s.mtime ?? 0 };
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path, directory: ROOT });
      return true;
    } catch {
      return false;
    }
  }

  async readText(path: string): Promise<string> {
    const { data } = await Filesystem.readFile({ path, directory: ROOT, encoding: Encoding.UTF8 });
    return typeof data === 'string' ? data : await data.text();
  }

  writeText(path: string, data: string): Promise<void> {
    return this.writeAtomic(path, { data, encoding: Encoding.UTF8 });
  }

  writeBase64(path: string, data: string): Promise<void> {
    return this.writeAtomic(path, { data });
  }

  /** Writes to a hidden temporary file next to the target, then renames it over the target. */
  private async writeAtomic(path: string, content: { data: string; encoding?: Encoding }): Promise<void> {
    const slash = path.lastIndexOf('/');
    const tmp = `${path.slice(0, slash + 1)}.${path.slice(slash + 1)}.tmp`;
    await Filesystem.writeFile({ path: tmp, directory: ROOT, recursive: true, ...content });
    try {
      await Filesystem.rename({ from: tmp, to: path, directory: ROOT, toDirectory: ROOT });
    } catch {
      // Some platforms refuse to rename over an existing file: replace it directly instead
      await Filesystem.writeFile({ path, directory: ROOT, recursive: true, ...content });
      await this.remove(tmp);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    await this.mkdir(to.slice(0, to.lastIndexOf('/')));
    await Filesystem.rename({ from, to, directory: ROOT, toDirectory: ROOT });
  }

  async remove(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path, directory: ROOT });
    } catch {
      // Already gone
    }
  }

  async removeDir(path: string): Promise<void> {
    try {
      await Filesystem.rmdir({ path, directory: ROOT, recursive: true });
    } catch {
      // Already gone
    }
  }

  async mkdir(path: string): Promise<void> {
    try {
      await Filesystem.mkdir({ path, directory: ROOT, recursive: true });
    } catch {
      // Already exists
    }
  }

  /** Call once at start-up: the URL base is looked up asynchronously, `fileUrl` is synchronous. */
  async init(): Promise<void> {
    try {
      const { uri } = await Filesystem.getUri({ path: '', directory: ROOT });
      this.baseUri = uri.replace(/\/+$/, '');
    } catch {
      // File URLs stay unavailable
    }
  }

  fileUrl(path: string): string {
    if (this.baseUri === null) return '';
    return Capacitor.convertFileSrc(`${this.baseUri}/${path.split('/').map(encodeURIComponent).join('/')}`);
  }
}
