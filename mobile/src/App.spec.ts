import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { locale } from '@/i18n';
import { VaultRepository } from '@/data/repository';
import { VaultRegistry } from '@/data/vaults';
import { VaultDb } from '@/data/db';
import { MemoryFs } from '@/data/memoryFs';
import { MemoryKeyValue } from '@/data/keyValue';

let counter = 0;
let fs: MemoryFs;
let wrapper: VueWrapper;

/** `seed` fills the storage as another app would; with it the vault in `Jotter` is already registered. */
async function start(seed?: (fs: MemoryFs) => void) {
  fs = new MemoryFs();
  seed?.(fs);
  const prefix = `app-${++counter}`;
  const registry = new VaultRegistry(fs, new MemoryKeyValue());
  if (seed) await registry.add({ name: 'Jotter', path: 'Jotter' });
  const repo = new VaultRepository(fs, registry, (name) => new VaultDb(`${prefix}:${name}`));
  const pinia = createPinia();
  setActivePinia(pinia);
  await useAppStore().init(repo);
  wrapper = mount(App, { global: { plugins: [pinia] } });
  await settle();
  return { repo, app: useAppStore(), ui: useUiStore() };
}

const find = (id: string) => wrapper.find(`[data-testid="${id}"]`);
const all = (id: string) => wrapper.findAll(`[data-testid="${id}"]`);
// IndexedDB (fake-indexeddb here) answers on later macrotasks, so flushing promises alone is not enough
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  await flushPromises();
};

async function submit(id: string) {
  const form = find(id).element.closest('form')!;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
}

async function type(id: string, value: string, event = 'input') {
  const el = find(id);
  await el.setValue(value);
  if (event !== 'input') await el.trigger(event);
  await settle();
}

const desktopVault = (f: MemoryFs) => {
  f.put('Jotter/work/index.md', '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n---\n');
  f.put(
    'Jotter/work/a.md',
    '---\ntitle: Write report\nstatus: todo\nposition: 1000\ntags: [office]\npriority: high\n---\nQuarterly numbers\n'
  );
  f.put('Jotter/work/b.md', '---\ntitle: Book flights\nstatus: todo\nposition: 2000\ndue_date: "2020-01-01"\n---\n');
  f.put('Jotter/work/c.md', '---\ntitle: Ship release\nstatus: done\nposition: 1000\n---\n');
};

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  locale.value = 'en';
});

describe('first launch', () => {
  it('asks for a vault folder, then offers to create the first project', async () => {
    await start();
    expect(find('onboarding').exists()).toBe(true);

    await type('vault-path', 'Jotter');
    await submit('vault-submit');

    expect(fs.dirs.has('Jotter')).toBe(true);
    expect(find('onboarding').exists()).toBe(false);
    expect(find('no-projects').exists()).toBe(true);
  });

  it('shows the error when the folder to open does not exist', async () => {
    await start();
    await find('mode-open').trigger('click');
    await type('vault-path', 'Nowhere');
    await submit('vault-submit');

    expect(find('vault-error').text()).toContain('Folder not found');
    expect(find('onboarding').exists()).toBe(true);
  });
});

describe('capturing and editing tasks', () => {
  it('creates a project, adds a task by quick add, edits it and deletes it', async () => {
    await start();
    await type('vault-path', 'Jotter');
    await submit('vault-submit');

    // A project
    await find('no-projects').find('button').trigger('click');
    await type('new-project-input', 'Home');
    await submit('new-project-submit');
    expect(find('open-projects').text()).toContain('Home');
    expect(all('bucket-tab').map((t) => t.text())[0]).toContain('Backlog');

    // Quick add
    await find('fab').trigger('click');
    await type('quick-add-input', 'Buy milk');
    await submit('quick-add-input');
    expect(find('quick-add-added').text()).toContain('Buy milk');
    await find('sheet-backdrop').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(1);
    expect(fs.files.get([...fs.files.keys()].find((k) => k.startsWith('Jotter/home/') && !k.endsWith('index.md'))!)?.data).toContain(
      'title: Buy milk'
    );

    // Edit: change the title and the notes, then close by tapping outside (no blur happens)
    await find('task-card').trigger('click');
    expect((find('task-title').element as HTMLTextAreaElement).value).toBe('Buy milk');
    await find('task-title').setValue('Buy oat milk');
    await find('task-body').setValue('2 litres');
    await find('sheet-backdrop').trigger('click');
    await settle();
    expect(find('task-card').text()).toContain('Buy oat milk');
    const file = [...fs.files.entries()].find(([k]) => k.startsWith('Jotter/home/') && !k.endsWith('index.md'))!;
    expect(file[1].data).toContain('title: Buy oat milk');
    expect(file[1].data).toContain('2 litres');

    // Delete
    await find('task-card').trigger('click');
    await find('task-delete').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(0);
    expect([...fs.files.keys()].filter((k) => k.startsWith('Jotter/home/') && !k.endsWith('index.md'))).toEqual([]);
  });

  it('moves a task to another bucket from its sheet', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    await type('task-bucket', 'done', 'change');
    await find('sheet-backdrop').trigger('click');
    await settle();

    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('status: done');
    expect(all('bucket-tab').map((t) => t.text())).toEqual(['To Do 1', 'Done 2']);
  });

  it('places a moved task at the position it was dropped at', async () => {
    const { app } = await start(desktopVault);

    // Between the two tasks of To Do, then to the end of Done (which is empty by then)
    await app.moveTask('c', 'todo', 1500);
    expect(app.positionsIn('todo')).toEqual([1000, 1500, 2000]);
    expect(fs.files.get('Jotter/work/c.md')?.data).toContain('status: todo');
    expect(fs.files.get('Jotter/work/c.md')?.data).toContain('position: 1500');

    await app.moveTask('a', 'done');
    expect(app.positionsIn('done')).toEqual([1000]);
  });

  it('shows the notes rendered, ticks checklist items in the file, and edits the raw text', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/a.md', '---\ntitle: Write report\nstatus: todo\nposition: 1000\n---\n## Plan\n\n- [ ] draft\n- [x] outline\n');
    });
    await find('task-card').trigger('click');

    expect(find('markdown').html()).toContain('<h2>Plan</h2>');
    expect(find('task-body').exists()).toBe(false);

    await wrapper.findAll('input[type="checkbox"]')[0].trigger('click');
    await settle();
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('- [x] draft');
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('- [x] outline');

    await find('notes-edit').trigger('click');
    expect((find('task-body').element as HTMLTextAreaElement).value).toContain('- [x] draft');
    await find('task-body').setValue('plain again');
    await find('notes-done').trigger('click');
    await settle();
    expect(find('markdown').text()).toBe('plain again');
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('plain again');
  });

  it('adds and removes an attachment', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    const input = find('task-attach').element as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['hello'], 'note.txt')], configurable: true });
    await find('task-attach').trigger('change');
    await settle();

    expect(all('attachment-row')).toHaveLength(1);
    expect(fs.files.has('Jotter/work/attachments/a/note.txt')).toBe(true);

    await all('attachment-row')[0].find('button').trigger('click');
    await settle();
    expect(all('attachment-row')).toHaveLength(0);
    expect(fs.files.has('Jotter/work/attachments/a/note.txt')).toBe(false);
  });
});

describe('board', () => {
  it('shows the buckets of a desktop vault with their tasks and counts', async () => {
    await start(desktopVault);

    expect(find('open-projects').text()).toContain('Work');
    expect(all('bucket-tab').map((t) => t.text())).toEqual(['To Do 2', 'Done 1']);
    const columns = all('column');
    expect(columns[0].text()).toContain('Write report');
    expect(columns[0].text()).toContain('Book flights');
    expect(columns[1].text()).toContain('Ship release');
  });

  it('filters by text, priority and tag, and clears the filters', async () => {
    await start(desktopVault);

    await find('open-filter').trigger('click');
    await type('filter-search', 'flights');
    await find('sheet-backdrop').trigger('click');
    await settle();
    expect(all('task-card').map((c) => c.text())).toEqual([expect.stringContaining('Book flights')]);
    expect(find('filter-active').exists()).toBe(true);

    await find('open-filter').trigger('click');
    await find('filter-clear').trigger('click');
    await type('filter-priority', 'high', 'change');
    await settle();
    expect(all('task-card').map((c) => c.text())).toEqual([expect.stringContaining('Write report')]);

    await type('filter-priority', '', 'change');
    await type('filter-tag', 'office', 'change');
    expect(all('task-card')).toHaveLength(1);
    await find('filter-clear').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(3);
  });

  it('puts tasks whose bucket the project does not define into an extra column', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/d.md', '---\ntitle: Lost task\nstatus: someday-maybe\n---\n');
    });
    expect(all('bucket-tab')).toHaveLength(3);
    expect(all('column')[2].text()).toContain('Lost task');
  });

  it('picks up changes made outside the app on refresh', async () => {
    await start(desktopVault);
    fs.put('Jotter/work/e.md', '---\ntitle: Added by sync\nstatus: done\n---\n');

    await find('refresh').trigger('click');
    await settle();

    expect(all('column')[1].text()).toContain('Added by sync');
  });

  it('refreshes when a column is pulled down from the top, and not on a short pull', async () => {
    await start(desktopVault);
    fs.put('Jotter/work/e.md', '---\ntitle: Added by sync\nstatus: done\n---\n');

    const column = all('column')[0].element;
    const touch = (type: string, y: number, x = 100) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
      column.dispatchEvent(event);
    };

    // Too short: nothing happens
    touch('touchstart', 300);
    touch('touchmove', 316);
    touch('touchend', 316);
    await settle();
    expect(all('column')[1].text()).not.toContain('Added by sync');

    // A real pull
    touch('touchstart', 300);
    touch('touchmove', 440);
    await settle();
    expect(find('pull-indicator').exists()).toBe(true);
    touch('touchend', 440);
    await settle();
    expect(all('column')[1].text()).toContain('Added by sync');
    expect(find('pull-indicator').exists()).toBe(false);
  });

  it('warns about files it could not read', async () => {
    await start(desktopVault);
    fs.put('Jotter/work/broken.md', '---\ntitle: [unclosed\n---\n');
    await find('refresh').trigger('click');
    await settle();
    expect(find('unreadable-banner').exists()).toBe(true);
  });
});

describe('projects and vaults', () => {
  it('switches the project from the project list', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
      f.put('Jotter/home/x.md', '---\ntitle: Water plants\n---\n');
    });
    await find('open-projects').trigger('click');
    const rows = all('project-row');
    expect(rows.map((r) => r.text())).toEqual(expect.arrayContaining([expect.stringContaining('Work'), expect.stringContaining('Home')]));
    await rows
      .find((r) => r.text().includes('Work'))!
      .find('button')
      .trigger('click');
    await settle();

    expect(find('open-projects').text()).toContain('Work');
    // All columns are in the page: two tasks in To Do, one in Done
    expect(all('task-card')).toHaveLength(3);
  });

  it('adds a second vault and switches to it', async () => {
    const { app } = await start(desktopVault);
    fs.mkdir('Other');

    await find('open-projects').trigger('click');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Vaults'))!
      .trigger('click');
    await settle();
    await find('mode-open').trigger('click');
    await type('vault-path', 'Other');
    await submit('vault-submit');
    expect(app.vaults).toHaveLength(2);
    // Adding closes the sheet; open it again to switch
    await find('open-projects').trigger('click');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Vaults'))!
      .trigger('click');
    await settle();

    await all('vault-row')[1]
      .findAll('button')
      .find((b) => b.text() === 'Open')!
      .trigger('click');
    await settle();
    expect(app.vault?.path).toBe('Other');
    expect(find('no-projects').exists()).toBe(true);
  });
});

describe('settings', () => {
  it('switches the language and the theme, and remembers both', async () => {
    await start(desktopVault);
    const settings = useSettingsStore();
    expect(find('open-filter').attributes('aria-label')).toBe('Search');

    await find('open-settings').trigger('click');
    await type('setting-language', 'de', 'change');
    await type('setting-theme', 'dark', 'change');

    expect(wrapper.text()).toContain('Einstellungen');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(JSON.parse(localStorage.getItem('jotter_lite_settings')!)).toEqual({ theme: 'dark', language: 'de' });
    expect(find('open-filter').attributes('aria-label')).toBe('Suchen');

    // Back to the system choice: no explicit theme on the page
    settings.theme = 'system';
    await settle();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('shows the version and links to the vaults', async () => {
    await start(desktopVault);
    await find('open-settings').trigger('click');
    expect(wrapper.text()).toContain('Version');

    await find('setting-vaults').trigger('click');
    await settle();
    expect(all('vault-row')).toHaveLength(1);
  });
});
