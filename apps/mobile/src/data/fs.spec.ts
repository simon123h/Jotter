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
});
