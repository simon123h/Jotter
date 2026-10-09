import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { useSettingsStore } from '@/stores/settings';
import { locale } from '@/i18n';
import { autoRefresh } from '@/composables/useAutoRefresh';
import { holdConfig } from '@/composables/useCardDrag';
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
  // Attached to the page like the real app: the drag code looks things up through document
  wrapper?.unmount();
  wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body });
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

/** Opens the navigation drawer from the app bar. */
async function openDrawer() {
  await find('open-menu').trigger('click');
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

afterEach(() => {
  autoRefresh.intervalMs = 60_000;
  holdConfig.ms = 350;
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

beforeEach(() => {
  holdConfig.ms = 30; // a hold is a few milliseconds in tests
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
    expect(find('app-bar-title').text()).toBe('Home');
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

  it('sets the colour and the planned date, and shows them on the card', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');

    await find('color-blue').trigger('click');
    await type('task-planned', 'thisWeek', 'change');
    await settle();

    const file = () => fs.files.get('Jotter/work/a.md')!.data;
    expect(file()).toContain('color: blue');
    expect(file()).toContain('planned_date: thisWeek');
    expect(find('color-blue').attributes('aria-checked')).toBe('true');

    await find('sheet-backdrop').trigger('click');
    await settle();
    const card = all('task-card')[0];
    expect(card.find('[data-testid="row-color"]').attributes('style')).toContain('rgb(59, 130, 246)');
    expect(card.find('[data-testid="card-planned"]').text()).toBe('This week');

    // And back to nothing: both keys leave the file
    await card.trigger('click');
    await find('color-none').trigger('click');
    await type('task-planned', '', 'change');
    await settle();
    expect(file()).not.toContain('color:');
    expect(file()).not.toContain('planned_date');
  });

  it('keeps a planned date and a colour that another tool wrote outside the menus', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/a.md', '---\ntitle: Odd values\nstatus: todo\nplanned_date: next-week\ncolor: "#12ab34"\n---\n');
    });
    await find('task-card').trigger('click');

    expect((find('task-planned').element as HTMLSelectElement).value).toBe('next-week');
    expect(find('task-planned').text()).toContain('Next week');
    expect(find('color-custom').exists()).toBe(true);

    // Editing something else must not touch them
    await find('task-title').setValue('Odd values, renamed');
    await find('sheet-backdrop').trigger('click');
    await settle();
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('planned_date: next-week');
    expect(fs.files.get('Jotter/work/a.md')?.data).toMatch(/color: ['"]?#12ab34/);
  });

  it('shows the postponed date for a task in the postponed bucket', async () => {
    await start((f) => {
      f.put(
        'Jotter/work/index.md',
        '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: postponed\n    title: Postponed\n---\n'
      );
      f.put('Jotter/work/a.md', '---\ntitle: Later\nstatus: postponed\npostponed_until: "2030-01-31"\n---\n');
    });
    expect(find('card-postponed').text()).toBe('2030-01-31');

    await find('task-card').trigger('click');
    expect((find('task-postponed').element as HTMLInputElement).value).toBe('2030-01-31');
    await type('task-postponed', '2031-02-01', 'change');
    await settle();
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('postponed_until: 2031-02-01');
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

    expect(find('app-bar-title').text()).toBe('Work');
    expect(all('bucket-tab').map((t) => t.text())).toEqual(['To Do 2', 'Done 1']);
    const columns = all('column');
    expect(columns[0].text()).toContain('Write report');
    expect(columns[0].text()).toContain('Book flights');
    expect(columns[1].text()).toContain('Ship release');
  });

  it('searches in the app bar and filters by priority and tag, and clears everything on closing the search', async () => {
    await start(desktopVault);

    await find('open-search').trigger('click');
    await type('search-input', 'flights');
    expect(all('task-card').map((c) => c.text())).toEqual([expect.stringContaining('Book flights')]);

    await find('clear-search').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(3);

    await find('open-filter').trigger('click');
    await type('filter-priority', 'high', 'change');
    expect(all('task-card').map((c) => c.text())).toEqual([expect.stringContaining('Write report')]);
    expect(find('filter-active').exists()).toBe(true);

    await type('filter-priority', '', 'change');
    await type('filter-tag', 'office', 'change');
    expect(all('task-card')).toHaveLength(1);
    await find('sheet-backdrop').trigger('click');

    // The back arrow drops the search and every filter
    await find('close-search').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(3);
    expect(find('search-input').exists()).toBe(false);
    expect(find('filter-active').exists()).toBe(false);
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

    await openDrawer();
    await find('drawer-rescan').trigger('click');
    await settle();

    expect(all('column')[1].text()).toContain('Added by sync');
  });

  it('warns about files it could not read', async () => {
    await start(desktopVault);
    fs.put('Jotter/work/broken.md', '---\ntitle: [unclosed\n---\n');
    await openDrawer();
    await find('drawer-rescan').trigger('click');
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
    await openDrawer();
    const rows = all('drawer-project');
    expect(rows.map((r) => r.text())).toEqual(expect.arrayContaining([expect.stringContaining('Work'), expect.stringContaining('Home')]));
    await rows.find((r) => r.text().includes('Work'))!.trigger('click');
    await settle();
    expect(find('drawer').exists()).toBe(false);

    expect(find('app-bar-title').text()).toBe('Work');
    // All columns are in the page: two tasks in To Do, one in Done
    expect(all('task-card')).toHaveLength(3);
  });

  it('adds a second vault and switches to it', async () => {
    const { app } = await start(desktopVault);
    fs.mkdir('Other');

    await openDrawer();
    await find('drawer-vault').trigger('click');
    await settle();
    await find('mode-open').trigger('click');
    await type('vault-path', 'Other');
    await submit('vault-submit');
    expect(app.vaults).toHaveLength(2);
    // Adding closes the sheet; open it again to switch
    await openDrawer();
    await find('drawer-vault').trigger('click');
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

describe('managing columns', () => {
  const openColumns = async () => {
    await openDrawer();
    await find('drawer-manage-columns').trigger('click');
    await settle();
  };
  const tabs = () => all('bucket-tab').map((t) => t.text());

  it('renames a column, and tasks stay in it', async () => {
    await start(desktopVault);
    await openColumns();
    await find('column-rename').trigger('click');
    await type('column-edit', 'Next up');
    await find('column-edit').element.closest('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(tabs()[0]).toContain('Next up');
    expect(fs.files.get('Jotter/work/index.md')?.data).toContain('Next up');
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('status: todo');
  });

  it('reorders the columns', async () => {
    await start(desktopVault);
    await openColumns();
    await all('column-down')[0]!.trigger('click');
    await settle();

    expect(tabs()[0]).toContain('Done');
    expect(tabs()[1]).toContain('To Do');
    const manifest = fs.files.get('Jotter/work/index.md')?.data ?? '';
    expect(manifest.indexOf('name: done')).toBeLessThan(manifest.indexOf('name: todo'));
  });

  it('adds a column at the end', async () => {
    await start(desktopVault);
    await openColumns();
    await type('new-column-input', 'Waiting');
    await submit('new-column-submit');
    await settle();

    expect(tabs()).toHaveLength(3);
    expect(tabs()[2]).toContain('Waiting');
  });

  it('refuses to delete a column that still has tasks, and deletes an empty one', async () => {
    await start(desktopVault);
    await openColumns();
    await type('new-column-input', 'Waiting');
    await submit('new-column-submit');
    await settle();

    // Done holds a task
    expect(all('column-delete')).toHaveLength(3);
    await all('column-delete')[1]!.trigger('click');
    await settle();
    expect(tabs()).toHaveLength(3);
    expect(find('toast').exists()).toBe(true);

    await all('column-delete')[2]!.trigger('click');
    await settle();
    expect(tabs()).toHaveLength(2);
  });
});

describe('settings', () => {
  it('switches the language and the theme, and remembers both', async () => {
    await start(desktopVault);
    const settings = useSettingsStore();
    expect(find('open-search').attributes('aria-label')).toBe('Search');

    await openDrawer();
    await find('drawer-settings').trigger('click');
    await settle();
    await type('setting-language', 'de', 'change');
    await type('setting-theme', 'dark', 'change');

    expect(wrapper.text()).toContain('Einstellungen');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(JSON.parse(localStorage.getItem('jotter_lite_settings')!)).toEqual({ theme: 'dark', language: 'de' });
    expect(find('open-search').attributes('aria-label')).toBe('Suchen');

    // Back to the system choice: no explicit theme on the page
    settings.theme = 'system';
    await settle();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('shows the version and links to the vaults', async () => {
    await start(desktopVault);
    await openDrawer();
    await find('drawer-settings').trigger('click');
    await settle();
    expect(wrapper.text()).toContain('Version');

    await find('setting-vaults').trigger('click');
    await settle();
    expect(all('vault-row')).toHaveLength(1);
  });
});

describe('navigation', () => {
  it('opens the drawer with the vault, the projects, settings and rescan, and closes it again', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
    });
    expect(find('drawer').exists()).toBe(false);

    await openDrawer();
    expect(find('drawer').exists()).toBe(true);
    expect(find('drawer-vault').text()).toContain('Jotter');
    expect(all('drawer-project').map((r) => r.text())).toEqual(['Home', 'Work']);
    // The first project in alphabetical order is the one that opens
    const current = (title: string) =>
      all('drawer-project')
        .find((r) => r.text() === title)!
        .attributes('aria-current');
    expect(current('Home')).toBe('page');
    expect(current('Work')).toBeUndefined();
    expect(find('drawer-settings').exists()).toBe(true);
    expect(find('drawer-rescan').exists()).toBe(true);

    await find('drawer-scrim').trigger('click');
    await settle();
    expect(find('drawer').exists()).toBe(false);
  });

  it('opens settings and the vault list from the drawer', async () => {
    await start(desktopVault);
    await openDrawer();
    await find('drawer-settings').trigger('click');
    await settle();
    expect(find('setting-theme').exists()).toBe(true);
    expect(find('drawer').exists()).toBe(false);
  });

  it('manages projects from the drawer', async () => {
    await start(desktopVault);
    await openDrawer();
    await find('drawer-manage-projects').trigger('click');
    await settle();
    expect(all('project-row')).toHaveLength(1);

    await type('new-project-input', 'Errands');
    await submit('new-project-submit');
    expect(find('app-bar-title').text()).toBe('Errands');
  });

  it('marks the tab of the column in view while swiping, and scrolls to a column when its tab is tapped', async () => {
    await start(desktopVault);
    const scroller = find('columns').element as HTMLElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 390, configurable: true });
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;

    const selected = () => all('bucket-tab').map((t) => t.attributes('aria-selected'));
    expect(selected()).toEqual(['true', 'false']);

    // Swiped most of the way to the second column
    Object.defineProperty(scroller, 'scrollLeft', { value: 300, configurable: true });
    await find('columns').trigger('scroll');
    expect(selected()).toEqual(['false', 'true']);
    expect(find('tab-indicator').exists()).toBe(true);

    await all('bucket-tab')[0].trigger('click');
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 0 }));
  });

  it('steps to the previous or next column with a sideways swipe on the tab strip', async () => {
    await start(desktopVault);
    const scroller = find('columns').element as HTMLElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 390, configurable: true });
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    const strip = find('tab-strip').element;
    const swipeStrip = (from: number, to: number, dy = 2) => {
      strip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: from, clientY: 100 }));
      strip.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: to, clientY: 100 + dy }));
    };

    swipeStrip(300, 100);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 390 }));

    swipeStrip(300, 330); // too short: that is a tap
    swipeStrip(300, 100, 200); // mostly vertical
    expect(scrollTo).toHaveBeenCalledTimes(1);

    useUiStore().activeColumn = 1;
    swipeStrip(100, 300);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
  });

  it('keeps the add button, and quick add files the task in the column in view', async () => {
    await start(desktopVault);
    expect(find('fab').exists()).toBe(true);
    useUiStore().activeColumn = 1;

    await find('fab').trigger('click');
    await type('quick-add-input', 'Into done');
    await submit('quick-add-input');
    await find('sheet-backdrop').trigger('click');
    await settle();

    expect(all('column')[1].text()).toContain('Into done');
  });
});

const file = (name: string) => fs.files.get(`Jotter/work/${name}.md`)!.data;
const row = (title: string) => all('task-row').find((c) => c.text().includes(title))!;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The list item (the thing that holds the long-press handler) of a task row. */
const itemOf = (title: string) => row(title).element.closest('[data-task-id]') as HTMLElement;

/** Selects a task the way a user does: press and hold, then let go without moving. */
async function holdSelect(title: string) {
  itemOf(title).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 100 }));
  await wait(90); // holdConfig.ms is 30 in tests
  window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 100 }));
  await settle();
}

/**
 * A finger on a row: down, then sideways in two steps, then up. The events arrive in one tick, so anything that
 * moves 40px or more counts as a fling and triggers; tests that only look at the swipe use shorter pulls.
 */
async function swipe(title: string, dx: number, { release = true, dy = 2 } = {}) {
  const content = row(title).find('[data-testid="task-card"]').element;
  content.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 100 }));
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 200 + dx / 2, clientY: 100 + dy / 2 }));
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 200 + dx, clientY: 100 + dy }));
  await settle();
  if (release) {
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 200 + dx, clientY: 100 + dy }));
    await wait(250); // the row slides out before it acts
    await settle();
  }
}

describe('finishing, archiving and moving', () => {
  it('selects a task by pressing and holding it, and the tap that ends the hold does not open it', async () => {
    await start(desktopVault);
    const before = file('a');
    expect(row('Write report').find('[data-testid="task-card"]').attributes('data-selected')).toBeUndefined();

    await holdSelect('Write report');

    expect(row('Write report').find('[data-testid="task-card"]').attributes('data-selected')).toBe('true');
    expect(find('selection-count').text()).toBe('1 selected');
    expect(find('task-title').exists()).toBe(false);
    expect(file('a')).toBe(before);
    // A click arrives right after the finger lifts; it must not open the task
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    await settle();
    expect(find('task-title').exists()).toBe(false);
  });

  it('does nothing when the checkbox is tapped, for now', async () => {
    await start(desktopVault);
    const before = file('a');
    await row('Write report').find('[data-testid="row-check"]').trigger('click');
    await settle();

    expect(file('a')).toBe(before);
    expect(find('selection-count').exists()).toBe(false);
    expect(find('task-title').exists()).toBe(false); // and it does not open the task either
    expect(find('toast').exists()).toBe(false);
  });

  it('shows what a swipe will do while the finger is down, and nothing for a vertical move', async () => {
    await start(desktopVault);
    await swipe('Write report', 30, { release: false });
    expect(find('swipe-right-bg').text()).toContain('Done');
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 230, clientY: 102 }));
    await wait(50);

    await swipe('Write report', -30, { release: false });
    expect(find('swipe-left-bg').text()).toContain('Move');
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 170, clientY: 102 }));
    await wait(50);

    // A done task offers to be reopened instead
    await swipe('Ship release', 30, { release: false });
    expect(find('swipe-right-bg').text()).toContain('Reopen');
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 230, clientY: 102 }));
    await wait(50);

    // Mostly vertical: that is scrolling
    await swipe('Write report', 12, { release: false, dy: 60 });
    expect(find('swipe-right-bg').exists()).toBe(false);
    expect(find('swipe-left-bg').exists()).toBe(false);
  });

  it('marks a task done by swiping it to the right', async () => {
    await start(desktopVault);
    await swipe('Write report', 150);

    expect(file('a')).toContain('status: done');
    expect(find('toast').text()).toContain('Marked done');
  });

  it('does nothing for a short swipe, and the tap that ends it does not open the task', async () => {
    await start(desktopVault);
    const before = file('a');
    await swipe('Write report', 30);
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    await settle();

    expect(file('a')).toBe(before);
    expect(find('task-title').exists()).toBe(false);
  });

  it('takes a done task back to the inbox by swiping it to the right, and can undo', async () => {
    await start(desktopVault);
    await swipe('Ship release', 150);

    expect(file('c')).toContain('status: todo'); // the first open bucket
    expect(find('toast').text()).toContain('Reopened');
    expect(all('bucket-tab').map((t) => t.text())).toEqual(['To Do 3', 'Done 0']);

    await find('toast-action').trigger('click');
    await settle();
    expect(file('c')).toContain('status: done');
  });

  it('marks an archived task done by swiping it to the right, and can undo', async () => {
    await start((f) => {
      f.put(
        'Jotter/work/index.md',
        '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n  - name: archive\n    title: Archive\n---\n'
      );
      f.put('Jotter/work/a.md', '---\ntitle: Old\nstatus: archive\n---\n');
    });
    await swipe('Old', 150);

    expect(file('a')).toContain('status: done');
    expect(find('toast').text()).toContain('Marked done');

    await find('toast-action').trigger('click');
    await settle();
    expect(file('a')).toContain('status: archive');
  });

  it('shows done as struck through and archived as muted but open', async () => {
    await start((f) => {
      f.put(
        'Jotter/work/index.md',
        '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n  - name: archive\n    title: Archive\n---\n'
      );
      f.put('Jotter/work/a.md', '---\ntitle: Finished\nstatus: done\n---\n');
      f.put('Jotter/work/b.md', '---\ntitle: Shelved\nstatus: archive\n---\n');
    });
    const heading = (title: string) => row(title).find('[data-testid="row-title"]');

    expect(heading('Finished').classes()).toContain('line-through');
    expect(heading('Shelved').classes()).not.toContain('line-through');
    expect(heading('Shelved').classes()).toContain('text-muted');
  });

  it('keeps archiving to the task sheet and the column picker, not the swipe', async () => {
    await start(desktopVault);
    await row('Ship release').find('[data-testid="task-card"]').trigger('click');
    expect(find('task-archive').exists()).toBe(true);
    await find('task-archive').trigger('click');
    await settle();
    expect(file('c')).toContain('status: archive');
    expect(find('toast').text()).toContain('Archived');
  });

  it('moves a task to a column of its choice by swiping it to the left', async () => {
    await start(desktopVault);
    await swipe('Write report', -150);

    expect(find('move-list').exists()).toBe(true);
    expect(find('move-to-todo').attributes('disabled')).toBeDefined(); // where it is now
    await find('move-to-done').trigger('click');
    await settle();

    expect(file('a')).toContain('status: done');
    expect(find('move-list').exists()).toBe(false);
    expect(find('toast').text()).toContain('Moved to Done');

    await find('toast-action').trigger('click');
    await settle();
    expect(file('a')).toContain('status: todo');
  });

  it('finishes and archives from the task sheet, keeping what was typed', async () => {
    await start(desktopVault);
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    await find('task-title').setValue('Write the final report');
    await find('task-done').trigger('click');
    await settle();

    expect(find('task-title').exists()).toBe(false);
    expect(file('a')).toContain('title: Write the final report');
    expect(file('a')).toContain('status: done');
    // The sheet closing must not move the task back to where its draft still said it was
    expect(file('a')).not.toContain('status: todo');

    await row('Write the final report').find('[data-testid="task-card"]').trigger('click');
    expect(find('task-done').exists()).toBe(false);
    await find('task-archive').trigger('click');
    await settle();
    expect(file('a')).toContain('status: archive');
  });
});

describe('rearranging by drag and drop', () => {
  const rect = (left: number, right: number, top: number, bottom: number) =>
    ({ left, right, top, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  /** jsdom has no layout: two rows in the To Do column (a on top, b below) and the Done column to its right. */
  function stubLayout() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.column === 'todo') return rect(0, 390, 60, 690);
      if (this.dataset.column === 'done') return rect(390, 780, 60, 690);
      if (this.dataset.taskId === 'a') return rect(10, 380, 70, 140);
      if (this.dataset.taskId === 'b') return rect(10, 380, 150, 220);
      return rect(0, 0, 0, 0);
    });
  }

  const pointer = (type: string, x: number, y: number, target: EventTarget = window) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));

  /** Press, hold, then move a little: that lifts the row. */
  async function lift(taskId: string, y = 100) {
    pointer('pointerdown', 50, y, wrapper.find(`[data-task-id="${taskId}"]`).element);
    await new Promise((resolve) => setTimeout(resolve, 90)); // holdConfig.ms is 30 in tests
    pointer('pointermove', 50, y + 10);
    await settle();
  }

  it('puts a row above another by dragging it there, and writes only that task', async () => {
    await start(desktopVault);
    stubLayout();
    fs.writes.length = 0;

    await lift('b', 180);
    expect(find('drag-ghost').exists()).toBe(true);
    pointer('pointermove', 50, 90); // above the middle of "a"
    await settle();
    expect(find('drop-line').exists()).toBe(true);
    pointer('pointerup', 50, 90);
    await settle();

    expect(fs.writes).toEqual(['Jotter/work/b.md']);
    expect(file('b')).toContain('position: 0');
    expect(file('b')).toContain('status: todo');
    expect(
      all('task-row')
        .map((r) => r.find('[data-testid="row-title"]').text())
        .slice(0, 2)
    ).toEqual(['Book flights', 'Write report']);
  });

  it('never changes the column of a row, even when it is dragged far to the side', async () => {
    await start(desktopVault);
    stubLayout();

    await lift('a');
    pointer('pointermove', 600, 650); // over the Done column, below everything
    await settle();
    pointer('pointerup', 600, 650);
    await settle();

    expect(file('a')).toContain('status: todo'); // still in To Do
    expect(file('a')).toContain('position: 3000'); // but moved to the end of it
  });

  it('selects instead of dragging when the hold is let go without moving, and a drag does not select', async () => {
    await start(desktopVault);
    stubLayout();

    // Hold and move: a drag, nothing selected afterwards
    await lift('b', 180);
    pointer('pointermove', 50, 90);
    pointer('pointerup', 50, 90);
    await settle();
    expect(find('selection-count').exists()).toBe(false);
    expect(file('b')).toContain('position: 0');

    // Hold and let go: a selection, and no row moved
    const before = file('a');
    pointer('pointerdown', 50, 100, wrapper.find('[data-task-id="a"]').element);
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(find('drag-ghost').exists()).toBe(false); // armed, not lifted yet
    pointer('pointerup', 50, 100);
    await settle();
    expect(find('selection-count').text()).toBe('1 selected');
    expect(file('a')).toBe(before);
  });

  it('is only a scroll or a swipe when the finger moves before the hold is over', async () => {
    holdConfig.ms = 120;
    await start(desktopVault);
    stubLayout();
    pointer('pointerdown', 50, 100, wrapper.find('[data-task-id="a"]').element);
    pointer('pointermove', 50, 140); // moves straight away
    await new Promise((resolve) => setTimeout(resolve, 200));
    pointer('pointerup', 50, 140);
    await settle();

    expect(find('selection-count').exists()).toBe(false);
    expect(find('drag-ghost').exists()).toBe(false);
  });

  it('does not swipe the row sideways once the hold has fired', async () => {
    await start(desktopVault);
    stubLayout();
    pointer('pointerdown', 50, 100, wrapper.find('[data-task-id="a"]').element);
    await new Promise((resolve) => setTimeout(resolve, 90));
    pointer('pointermove', 150, 102); // sideways after the hold
    pointer('pointermove', 250, 104);
    await settle();

    expect(find('swipe-right-bg').exists()).toBe(false);
    expect(find('drag-ghost').exists()).toBe(true); // it is a drag now, not a swipe
    pointer('pointerup', 250, 104);
    await settle();
  });

  it('has no drop dock and no add button while a row is dragged', async () => {
    await start(desktopVault);
    stubLayout();
    await lift('a');

    expect(find('drop-dock').exists()).toBe(false);
    expect(find('fab').exists()).toBe(false);
  });

  it('does not start a drag, or show the ghost, for a quick tap', async () => {
    await start(desktopVault);
    stubLayout();
    pointer('pointerdown', 50, 100, wrapper.find('[data-task-id="a"]').element);
    pointer('pointerup', 50, 100);
    await new Promise((resolve) => setTimeout(resolve, 450));
    await settle();
    expect(find('drag-ghost').exists()).toBe(false);
  });
});

describe('selecting tasks', () => {
  const selectedIds = () => useAppStore().selection;

  it('ticks and unticks tasks, shows how many in the bar, and a tap on a row ticks while selecting', async () => {
    await start(desktopVault);
    expect(find('selection-count').exists()).toBe(false);

    await holdSelect('Write report');
    await holdSelect('Book flights');
    await settle();
    expect(find('selection-count').text()).toBe('2 selected');
    expect(row('Write report').find('[data-testid="task-card"]').attributes('data-selected')).toBe('true');

    // While tasks are selected a tap on a row ticks it instead of opening it
    await wait(450); // the click that ends a hold is ignored for a moment
    await row('Ship release').find('[data-testid="task-card"]').trigger('click');
    await settle();
    expect(find('task-title').exists()).toBe(false);
    expect(find('selection-count').text()).toBe('3 selected');

    // A tap ticks it off again
    await row('Ship release').find('[data-testid="task-card"]').trigger('click');
    await settle();
    expect(find('selection-count').text()).toBe('2 selected');

    await find('clear-selection').trigger('click');
    await settle();
    expect(find('selection-count').exists()).toBe(false);
    expect(selectedIds()).toEqual([]);
    // Nothing selected: a tap opens a task again
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    expect(find('task-title').exists()).toBe(true);
  });

  it('selects every task of the column in view', async () => {
    await start(desktopVault);
    await holdSelect('Write report');
    await find('select-all').trigger('click');
    await settle();
    expect(find('selection-count').text()).toBe('2 selected'); // the two in To Do, not the one in Done
  });

  it('keeps the selection across columns, and drops it on another project', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
    });
    await useAppStore().selectProject('work'); // the first project in alphabetical order, Home, opens otherwise
    await settle();
    await holdSelect('Write report');
    useUiStore().activeColumn = 1;
    await settle();
    expect(find('selection-count').text()).toBe('1 selected');

    await useAppStore().selectProject('home');
    await settle();
    expect(find('selection-count').exists()).toBe(false);
  });

  it('hides the add button and shows the bulk actions in a floating toolbar while tasks are selected', async () => {
    await start(desktopVault);
    expect(find('fab').exists()).toBe(true);
    expect(find('bulk-tag').exists()).toBe(false);

    await holdSelect('Write report');
    await settle();
    expect(find('fab').exists()).toBe(false);
    expect(['bulk-tag', 'bulk-priority', 'bulk-project', 'bulk-more'].every((id) => find(id).exists())).toBe(true);

    await find('clear-selection').trigger('click');
    await settle();
    expect(find('fab').exists()).toBe(true);
    expect(find('bulk-tag').exists()).toBe(false);
  });
});

describe('bulk actions on the selection', () => {
  const pick = async (...titles: string[]) => {
    for (const title of titles) await holdSelect(title);
  };

  it('marks all selected tasks done when one of them is swiped right, and can undo them together', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await swipe('Write report', 150);

    expect(file('a')).toContain('status: done');
    expect(file('b')).toContain('status: done');
    expect(find('toast').text()).toContain('2 tasks marked done');
    expect(find('selection-count').exists()).toBe(false); // the selection ends with the action
    expect(all('bucket-tab').map((t) => t.text())).toEqual(['To Do 0', 'Done 3']);

    await find('toast-action').trigger('click');
    await settle();
    expect(file('a')).toContain('status: todo');
    expect(file('b')).toContain('status: todo');
  });

  it('shows the count on the swipe background of a selected row', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await swipe('Write report', 30, { release: false });
    expect(find('swipe-right-bg').text()).toContain('2');
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 230, clientY: 102 }));
    await wait(50);
  });

  it('moves all selected tasks to the column chosen in the picker when one is swiped left', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await swipe('Book flights', -150);

    expect(find('move-list').exists()).toBe(true);
    await find('move-to-done').trigger('click');
    await settle();

    expect(file('a')).toContain('status: done');
    expect(file('b')).toContain('status: done');
    expect(find('toast').text()).toContain('2 tasks moved to Done');
  });

  it('acts on just the swiped task when it is not one of the selected ones', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await swipe('Ship release', 150); // done -> reopen, alone

    expect(file('c')).toContain('status: todo');
    expect(file('a')).toContain('status: todo');
    expect(file('b')).toContain('status: todo');
    expect(find('selection-count').text()).toBe('2 selected');
  });

  it('sets the priority of all selected tasks, and can undo it', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await find('bulk-priority').trigger('click');
    await settle();
    await find('priority-urgent').trigger('click');
    await settle();

    expect(file('a')).toContain('priority: urgent');
    expect(file('b')).toContain('priority: urgent');
    expect(find('toast').text()).toContain('Priority set for 2 tasks');
    expect(find('selection-count').text()).toBe('2 selected'); // edits keep the selection

    await find('toast-action').trigger('click');
    await settle();
    expect(file('a')).toContain('priority: high'); // what it was before
    expect(file('b')).not.toContain('priority:');
  });

  it('adds a tag to all selected tasks and removes it again', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await find('bulk-tag').trigger('click');
    await settle();

    await type('tags-input', '#Urgent, errands');
    await submit('tags-add');
    expect(file('a')).toContain('urgent');
    expect(file('b')).toContain('errands');
    // Tags that were already there stay
    expect(file('a')).toContain('office');
    expect(find('tags-on-tasks').text()).toContain('#urgent');

    await find('tag-remove-urgent').trigger('click');
    await settle();
    expect(file('a')).not.toContain('urgent');
    expect(file('b')).toContain('errands');
  });

  it('moves the selected tasks into another project, with their attachments', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\nbuckets:\n  - name: todo\n    title: To Do\n---\n');
    });
    await useAppStore().selectProject('work');
    await settle();
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    const input = find('task-attach').element as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['hello'], 'note.txt')], configurable: true });
    await find('task-attach').trigger('change');
    await settle();
    await find('sheet-backdrop').trigger('click');
    await settle();

    await pick('Write report', 'Book flights');
    await find('bulk-project').trigger('click');
    await settle();
    expect(all('project-list')).toHaveLength(1);
    await find('project-home').trigger('click');
    await settle();

    expect(fs.files.has('Jotter/work/a.md')).toBe(false);
    expect(fs.files.get('Jotter/home/a.md')?.data).toContain('project_id: home');
    expect(fs.files.get('Jotter/home/attachments/a/note.txt')?.data).toBe(btoa('hello'));
    expect(fs.files.has('Jotter/home/b.md')).toBe(true);
    expect(find('toast').text()).toContain('2 tasks moved to Home');
    expect(find('selection-count').exists()).toBe(false);
  });

  it('offers more bulk actions: archive, due date, planned date, colour, delete', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');

    await find('bulk-more').trigger('click');
    await settle();
    await find('more-due').trigger('click');
    await type('more-due-input', '2031-05-06', 'input');
    await find('more-due-apply').trigger('click');
    await settle();
    expect(file('a')).toMatch(/due_date: ['"]?2031-05-06/);
    expect(file('b')).toMatch(/due_date: ['"]?2031-05-06/);

    await find('bulk-more').trigger('click');
    await settle();
    await find('more-color').trigger('click');
    await find('more-color-green').trigger('click');
    await settle();
    expect(file('a')).toContain('color: green');
    expect(file('b')).toContain('color: green');

    await find('bulk-more').trigger('click');
    await settle();
    await find('more-archive').trigger('click');
    await settle();
    expect(file('a')).toContain('status: archive');
    expect(file('b')).toContain('status: archive');
    expect(find('selection-count').exists()).toBe(false);
  });

  it('deletes the selected tasks after asking', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await find('bulk-more').trigger('click');
    await settle();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await find('more-delete').trigger('click');
    await settle();
    expect(fs.files.has('Jotter/work/a.md')).toBe(true);

    await find('more-delete').trigger('click');
    await settle();
    expect(fs.files.has('Jotter/work/a.md')).toBe(false);
    expect(fs.files.has('Jotter/work/b.md')).toBe(false);
    expect(fs.files.has('Jotter/work/c.md')).toBe(true);
    expect(find('toast').text()).toContain('2 tasks deleted');
  });
});

describe('automatic rescan', () => {
  const wait = async (ms: number) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await settle();
  };
  const external = (name: string, title: string) => fs.put(`Jotter/work/${name}.md`, `---\ntitle: ${title}\nstatus: todo\n---\n`);
  const titles = () => all('task-card').map((c) => c.text());

  it('picks up changes made by other apps by itself', async () => {
    autoRefresh.intervalMs = 40;
    await start(desktopVault);
    expect(titles().join()).not.toContain('Added by sync');

    external('e', 'Added by sync');
    await wait(250);

    expect(titles().join()).toContain('Added by sync');
  });

  it('leaves the screen alone when nothing changed', async () => {
    autoRefresh.intervalMs = 40;
    const { repo } = await start(desktopVault);
    const listTasks = vi.spyOn(repo, 'listTasks');

    await wait(250);
    expect(listTasks).not.toHaveBeenCalled();

    external('e', 'Added by sync');
    await wait(250);
    expect(listTasks).toHaveBeenCalled();
  });

  it('waits while a task is open or a card is dragged, and catches up afterwards', async () => {
    autoRefresh.intervalMs = 40;
    const { ui } = await start(desktopVault);

    await find('task-card').trigger('click');
    external('e', 'Added while editing');
    await wait(250);
    expect(titles().join()).not.toContain('Added while editing');

    await find('sheet-backdrop').trigger('click');
    ui.dragging = true;
    await wait(250);
    expect(titles().join()).not.toContain('Added while editing');

    ui.dragging = false;
    await wait(250);
    expect(titles().join()).toContain('Added while editing');
  });

  it('does not scan while the app is hidden, and scans as soon as it is visible again', async () => {
    autoRefresh.intervalMs = 40;
    await start(desktopVault);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    external('e', 'Added in the background');
    await wait(250);
    expect(titles().join()).not.toContain('Added in the background');

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(150);
    expect(titles().join()).toContain('Added in the background');
  });
});
