import { describe, it, expect, beforeEach } from 'vitest';
import { VaultRepository } from './repository';
import { VaultRegistry } from './vaults';
import { VaultDb } from './db';
import { MemoryFs } from './memoryFs';
import { MemoryKeyValue } from './keyValue';

let counter = 0;
let fs: MemoryFs;
let repo: VaultRepository;

const newRepo = (files: MemoryFs) => {
  const prefix = `test-${++counter}`;
  return new VaultRepository(files, new VaultRegistry(files, new MemoryKeyValue()), (name) => new VaultDb(`${prefix}:${name}`));
};

/** A vault another app (desktop, a sync tool) already wrote. */
const seedDesktopVault = (files: MemoryFs) => {
  files.put(
    'Jotter/work/index.md',
    '---\ntitle: Work\nowner: sam\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n---\n\n# Work\n\nKeep this text.\n'
  );
  files.put('Jotter/work/a.md', '---\ntitle: Alpha\nstatus: todo\nposition: 1000\ntags: [x, y]\nassignee: sam\n---\nAlpha body\n');
  files.put('Jotter/work/b.md', '---\ntitle: Beta\nstatus: done\nposition: 2000\npriority: high\n---\nBeta body\n');
};

beforeEach(() => {
  fs = new MemoryFs();
  repo = newRepo(fs);
});

describe('vaults', () => {
  it('starts empty on first launch and opens the first vault that is added', async () => {
    expect(await repo.open()).toBeNull();
    expect(await repo.listVaults()).toEqual([]);

    const vault = await repo.addVault({ name: 'Notes', path: 'Jotter', create: true });

    expect(vault).toMatchObject({ id: 'notes', path: 'Jotter' });
    expect((await repo.activeVault())?.id).toBe('notes');
    expect(await repo.listProjects()).toEqual([]);
    expect(await fs.exists('Jotter')).toBe(true);
  });

  it('refuses a missing folder, a duplicate, and paths that leave Documents', async () => {
    await expect(repo.addVault({ name: 'Ghost', path: 'Ghost' })).rejects.toThrow('Folder not found');
    await repo.addVault({ name: 'A', path: 'A', create: true });
    await expect(repo.addVault({ name: 'Again', path: 'A', create: true })).rejects.toThrow('already exists');
    await expect(repo.addVault({ name: 'Evil', path: '../outside', create: true })).rejects.toThrow('inside Documents');
  });

  it('keeps a separate cache per vault and leaves the files when a vault is removed', async () => {
    seedDesktopVault(fs);
    await repo.addVault({ name: 'Jotter', path: 'Jotter' });
    await repo.addVault({ name: 'Other', path: 'Other', create: true });
    expect((await repo.listProjects()).map((p) => p.id)).toEqual(['work']);

    await repo.switchVault('other');
    expect(await repo.listProjects()).toEqual([]);
    await repo.createProject('Elsewhere');

    await repo.switchVault('jotter');
    expect((await repo.listProjects()).map((p) => p.id)).toEqual(['work']);

    await repo.removeVault('other');
    expect((await repo.listVaults()).map((v) => v.id)).toEqual(['jotter']);
    expect(fs.files.has('Other/elsewhere/index.md')).toBe(true);
  });
});

describe('scan', () => {
  beforeEach(async () => {
    seedDesktopVault(fs);
    await repo.addVault({ name: 'Jotter', path: 'Jotter' });
  });

  it('reads the projects, buckets and tasks another app wrote', async () => {
    expect((await repo.listProjects()).map((p) => p.title)).toEqual(['Work']);
    expect((await repo.listBuckets('work')).map((b) => b.name)).toEqual(['todo', 'done']);
    const tasks = await repo.listTasks('work');
    expect(tasks.map((t) => [t.id, t.title, t.bucket])).toEqual([
      ['a', 'Alpha', 'todo'],
      ['b', 'Beta', 'done'],
    ]);
  });

  it('only reads files that changed since the last scan', async () => {
    expect((await repo.sync()).read).toBe(0);

    fs.put('Jotter/work/a.md', '---\ntitle: Alpha 2\nstatus: todo\n---\n');
    expect((await repo.sync()).read).toBe(1);
    expect((await repo.getTask('work', 'a')).title).toBe('Alpha 2');
  });

  it('says whether a scan found anything, so that a quiet scan can leave the screen alone', async () => {
    expect((await repo.sync()).changed).toBe(false);

    fs.put('Jotter/work/a.md', '---\ntitle: Alpha 2\nstatus: todo\n---\n');
    expect((await repo.sync()).changed).toBe(true);
    expect((await repo.sync()).changed).toBe(false);

    fs.put('Jotter/work/new.md', '---\ntitle: New\n---\n');
    expect((await repo.sync()).changed).toBe(true);
    expect((await repo.sync()).changed).toBe(false);

    fs.put('Jotter/work/index.md', '---\ntitle: Work renamed\n---\n');
    expect((await repo.sync()).changed).toBe(true);

    fs.files.delete('Jotter/work/b.md');
    expect((await repo.sync()).changed).toBe(true);

    await fs.removeDir('Jotter/work');
    expect((await repo.sync()).changed).toBe(true);
    expect((await repo.sync()).changed).toBe(false);
  });

  it('does not report its own writes as changes', async () => {
    await repo.createTask('work', { title: 'Mine', bucket: 'todo' });
    await repo.updateTask('work', 'a', { title: 'Alpha, edited' });
    expect((await repo.sync()).changed).toBe(false);
  });

  it('forgets files and projects that disappeared', async () => {
    fs.files.delete('Jotter/work/b.md');
    await repo.sync();
    expect((await repo.listTasks('work')).map((t) => t.id)).toEqual(['a']);

    await fs.removeDir('Jotter/work');
    await repo.sync();
    expect(await repo.listProjects()).toEqual([]);
  });

  it('reads a project without index.md with defaults and does not write one', async () => {
    fs.put('Jotter/bare/t.md', '---\ntitle: Loose\n---\n');
    fs.writes.length = 0;

    await repo.sync();

    expect((await repo.listProjects()).find((p) => p.id === 'bare')?.title).toBe('Bare');
    expect((await repo.listBuckets('bare')).map((b) => b.name)).toContain('backlog');
    expect(fs.writes).toEqual([]);
  });

  it('leaves a file with invalid YAML untouched, uncached and still syncs the rest', async () => {
    fs.put('Jotter/work/broken.md', '---\ntitle: [unclosed\n---\nPrecious\n');
    fs.writes.length = 0;

    const result = await repo.sync();

    expect(result.unreadable).toEqual(['Jotter/work/broken.md']);
    expect((await repo.listTasks('work')).map((t) => t.id)).toEqual(['a', 'b']);
    expect(fs.writes).toEqual([]);
    expect(fs.files.get('Jotter/work/broken.md')?.data).toContain('Precious');
  });
});

describe('tasks', () => {
  beforeEach(async () => {
    seedDesktopVault(fs);
    await repo.addVault({ name: 'Jotter', path: 'Jotter' });
  });

  it('creates a task file with a ULID name at the end of its bucket', async () => {
    const first = await repo.createTask('work', { title: '  New one  ', bucket: 'todo', tags: ['t'] });
    const second = await repo.createTask('work', { title: 'Second', bucket: 'todo' });

    expect(first.title).toBe('New one');
    expect(first.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(second.position).toBe(first.position + 1000);
    expect(first.position).toBeGreaterThan(1000);
    expect(fs.files.get(`Jotter/work/${first.id}.md`)?.data).toContain('title: New one');
    expect((await repo.getTask('work', first.id)).tags).toEqual(['t']);
  });

  it('uses the default bucket and refuses empty titles and unknown projects', async () => {
    const task = await repo.createTask('work', { title: 'No bucket given' });
    expect(['todo', 'done']).toContain(task.bucket);
    await expect(repo.createTask('work', { title: '   ' })).rejects.toThrow('empty');
    await expect(repo.createTask('nope', { title: 'x' })).rejects.toThrow('not found');
  });

  it('keeps frontmatter keys it does not know when a task is edited', async () => {
    await repo.updateTask('work', 'a', { title: 'Alpha, edited' });

    const written = fs.files.get('Jotter/work/a.md')!.data;
    expect(written).toContain('title: Alpha, edited');
    expect(written).toContain('assignee: sam');
    expect(written).toContain('Alpha body');
  });

  it('moves and deletes tasks, taking their attachments along', async () => {
    const moved = await repo.moveTask('work', 'a', 'done', 5000);
    expect([moved.bucket, moved.position]).toEqual(['done', 5000]);

    await repo.addAttachment('work', 'a', new File(['x'], 'pic.png'));
    await repo.deleteTask('work', 'a');

    expect(fs.files.has('Jotter/work/a.md')).toBe(false);
    expect([...fs.files.keys()].some((f) => f.includes('attachments/a/'))).toBe(false);
    await expect(repo.getTask('work', 'a')).rejects.toThrow('not found');
  });

  it('filters by bucket, tags, priority and text, sorted by position', async () => {
    expect((await repo.listTasks('work', { bucket: 'done' })).map((t) => t.id)).toEqual(['b']);
    expect((await repo.listTasks('work', { tags: ['x', 'y'] })).map((t) => t.id)).toEqual(['a']);
    expect((await repo.listTasks('work', { tags: ['x', 'nope'] })).length).toBe(0);
    expect((await repo.listTasks('work', { priority: 'high' })).map((t) => t.id)).toEqual(['b']);
    expect((await repo.listTasks(null, { search: 'BETA body' })).map((t) => t.id)).toEqual(['b']);
  });
});

describe('projects and buckets', () => {
  beforeEach(async () => {
    seedDesktopVault(fs);
    await repo.addVault({ name: 'Jotter', path: 'Jotter' });
  });

  it('creates a project folder with a manifest and the default buckets, with unique ids', async () => {
    const first = await repo.createProject('Home & Garden');
    const second = await repo.createProject('Home & Garden');

    expect([first.id, second.id]).toEqual(['home-garden', 'home-garden-2']);
    expect(fs.files.get('Jotter/home-garden/index.md')?.data).toContain('type: project');
    expect((await repo.listBuckets('home-garden')).map((b) => b.name)).toEqual(['backlog', 'todo', 'in-progress', 'done', 'archive']);
  });

  it('keeps the index.md text and unknown keys when buckets change', async () => {
    const bucket = await repo.createBucket('work', { title: 'Review' });
    await repo.updateBucket('work', 'done', { title: 'Finished' });

    const manifest = fs.files.get('Jotter/work/index.md')!.data;
    expect(bucket).toMatchObject({ name: 'review', position: 3000 });
    expect(manifest).toContain('owner: sam');
    expect(manifest).toContain('Keep this text.');
    expect(manifest).toContain('title: Finished');
    expect(manifest).toContain('name: review');
  });

  it('only deletes an empty bucket', async () => {
    await expect(repo.deleteBucket('work', 'todo')).rejects.toThrow('Move or delete');
    await repo.createBucket('work', { title: 'Empty' });
    await repo.deleteBucket('work', 'empty');
    expect((await repo.listBuckets('work')).map((b) => b.name)).toEqual(['todo', 'done']);
  });

  it('renames and deletes projects, deleting only that folder', async () => {
    const renamed = await repo.updateProject('work', { title: 'Office' });
    expect(renamed.title).toBe('Office');
    expect(fs.files.get('Jotter/work/index.md')?.data).toContain('title: Office');

    await repo.deleteProject('work');
    expect(await repo.listProjects()).toEqual([]);
    expect([...fs.files.keys()].filter((f) => f.startsWith('Jotter/work'))).toEqual([]);
  });
});

describe('attachments', () => {
  beforeEach(async () => {
    seedDesktopVault(fs);
    await repo.addVault({ name: 'Jotter', path: 'Jotter' });
  });

  it('stores the file below the project attachments folder and records its name', async () => {
    const task = await repo.addAttachment('work', 'a', new File(['hello'], 'note.txt'));

    expect(task.attachments).toEqual(['note.txt']);
    expect(fs.files.get('Jotter/work/attachments/a/note.txt')?.data).toBe(btoa('hello'));
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('note.txt');
    expect(repo.attachmentUrl('work', 'a', 'note.txt')).toBe('memory://Jotter/work/attachments/a/note.txt');
  });

  it('strips directories from names and does not list a file twice', async () => {
    await repo.addAttachment('work', 'a', new File(['1'], '../../evil.txt'));
    const again = await repo.addAttachment('work', 'a', new File(['2'], 'evil.txt'));

    expect(again.attachments).toEqual(['evil.txt']);
    expect(fs.files.has('Jotter/work/attachments/a/evil.txt')).toBe(true);
  });

  it('removes the file and the reference', async () => {
    await repo.addAttachment('work', 'a', new File(['x'], 'a.png'));
    const task = await repo.removeAttachment('work', 'a', 'a.png');

    expect(task.attachments).toEqual([]);
    expect(fs.files.has('Jotter/work/attachments/a/a.png')).toBe(false);
  });
});
