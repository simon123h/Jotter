import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Filesystem } from '@capacitor/filesystem';
import { CapacitorFs } from './fs';

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue({}),
    rename: vi.fn().mockResolvedValue({}),
    deleteFile: vi.fn().mockResolvedValue({}),
  },
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
}));

describe('CapacitorFs writes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a hidden temporary file next to the target and renames it over the target', async () => {
    await new CapacitorFs().writeText('Jotter/work/a.md', 'hello');

    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'Jotter/work/.a.md.tmp', data: 'hello', recursive: true })
    );
    expect(Filesystem.rename).toHaveBeenCalledWith(expect.objectContaining({ from: 'Jotter/work/.a.md.tmp', to: 'Jotter/work/a.md' }));
  });

  it('falls back to writing the target directly when the rename is refused, and cleans up', async () => {
    vi.mocked(Filesystem.rename).mockRejectedValueOnce(new Error('exists'));

    await new CapacitorFs().writeBase64('Jotter/work/attachments/a/pic.png', 'AAAA');

    expect(Filesystem.writeFile).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'Jotter/work/attachments/a/pic.png', data: 'AAAA' })
    );
    expect(Filesystem.deleteFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'Jotter/work/attachments/a/.pic.png.tmp' }));
  });

  it('writes to the same path one after the other, so they never share the temporary file at once', async () => {
    const order: string[] = [];
    vi.mocked(Filesystem.writeFile).mockImplementation(async (o) => {
      order.push(`write ${o.data}`);
      await Promise.resolve();
      return {} as never;
    });
    vi.mocked(Filesystem.rename).mockImplementation(async () => {
      order.push('rename');
      return undefined as never;
    });
    const fs = new CapacitorFs();

    await Promise.all([fs.writeText('Jotter/work/a.md', '1'), fs.writeText('Jotter/work/a.md', '2')]);

    expect(order).toEqual(['write 1', 'rename', 'write 2', 'rename']);
  });
});
