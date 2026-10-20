import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { isoDay, today, weekOf } from '@jotter/task-filter';
import { capacitorKeyValue } from '@/data/keyValue';
import { runShortcut, shortcutAction, sharedDraft } from '@/shortcuts';
import { useSettingsStore } from '@/stores/settings';
import { linkTitles } from '@/linkTitle';
import { locale } from '@/i18n';
import { autoRefresh } from '@/composables/useAutoRefresh';
import { holdConfig } from '@/composables/useCardDrag';
import { MemoryNotifications, armDelay, forgetArmedReminders, localDateTime, notifications } from '@/reminders';
import { VaultRepository } from '@/data/repository';
import { VaultRegistry } from '@/data/vaults';
import { VaultDb } from '@/data/db';
import { MemoryFs } from '@/data/memoryFs';
import { MemoryKeyValue } from '@/data/keyValue';

let counter = 0;
let fs: MemoryFs;
let wrapper: VueWrapper;
let memoryNotifications: MemoryNotifications;
const realNotifications = notifications.port;
const realLinkTitles = linkTitles.port;

/** `seed` fills the storage as another app would; with it the vault in `Jotter` is already registered. */
async function start(seed?: (fs: MemoryFs) => void) {
  // No test loads a page: the look-up of a title is on for every bare address, so the real port is replaced
  if (linkTitles.port === realLinkTitles) linkTitles.port = vi.fn(async () => null);
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

/** Closes the open sheet the way a user does: the arrow of the task page, or a tap on the dimmed area of a bottom sheet. */
async function closeSheet() {
  if (wrapper.find('[data-testid="task-back"]').exists()) await find('task-back').trigger('click');
  else await find('sheet-backdrop').trigger('click');
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
  notifications.port = realNotifications;
  linkTitles.port = realLinkTitles;
  armDelay.ms = 800;
  autoRefresh.intervalMs = 60_000;
  holdConfig.ms = 350;
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

beforeEach(() => {
  memoryNotifications = new MemoryNotifications();
  notifications.port = memoryNotifications;
  armDelay.ms = 0;
  forgetArmedReminders();
  holdConfig.ms = 30; // a hold is a few milliseconds in tests
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.clear();
  document.documentElement.className = '';
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
    await closeSheet();
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
    await closeSheet();
    await settle();
    expect(find('task-card').text()).toContain('Buy oat milk');
    const file = [...fs.files.entries()].find(([k]) => k.startsWith('Jotter/home/') && !k.endsWith('index.md'))!;
    expect(file[1].data).toContain('title: Buy oat milk');
    expect(file[1].data).toContain('2 litres');

    // Delete
    await find('task-card').trigger('click');
    await find('task-menu').trigger('click');
    await find('task-delete').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(0);
    expect([...fs.files.keys()].filter((k) => k.startsWith('Jotter/home/') && !k.endsWith('index.md'))).toEqual([]);
  });

  it('moves a task to another bucket from its sheet', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    await type('task-bucket', 'done', 'change');
    await closeSheet();
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

  it('shows the domain of the address in the title or the notes on the row, and the link does not open the task', async () => {
    const { app, ui } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/d.md', '---\ntitle: Article\nstatus: todo\nposition: 3000\n---\nFound at https://www.example.com/post/1.\n');
    });
    const row = all('task-row').find((r) => r.text().includes('Article'))!;
    const link = row.find('[data-testid="row-link"]');
    expect(link.text()).toBe('example.com');
    expect(link.attributes('href')).toBe('https://www.example.com/post/1');
    await link.trigger('click');
    expect(app.selectedCount).toBe(0);
    expect(ui.sheet).toBeNull();
    expect(
      all('task-row')
        .find((r) => r.text().includes('Write report'))!
        .find('[data-testid="row-link"]')
        .exists()
    ).toBe(false);
  });

  it('shows the checklist progress on the row and adds an item from the sheet', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/a.md', '---\ntitle: Write report\nstatus: todo\nposition: 1000\n---\n- [ ] draft\n- [x] outline\n');
    });
    expect(row('Write report').find('[data-testid="row-checklist"]').text()).toBe('1/2');
    expect(row('Book flights').find('[data-testid="row-checklist"]').exists()).toBe(false);

    await find('task-card').trigger('click');
    await type('checklist-add-input', 'send it');
    await submit('checklist-add');
    await settle();

    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('- [x] outline\n- [ ] send it');
    await closeSheet();
    await settle();
    expect(row('Write report').find('[data-testid="row-checklist"]').text()).toBe('1/3');
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
    await type('task-planned', weekOf(today()), 'change');
    await settle();

    const file = () => fs.files.get('Jotter/work/a.md')!.data;
    expect(file()).toContain('color: blue');
    expect(file()).toContain(`planned_date: ${weekOf(today())}`);
    expect(find('color-blue').attributes('aria-checked')).toBe('true');

    await closeSheet();
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

  it('sets a repeat rule and reminders, shows them on the card, and clears them again', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    const file = () => fs.files.get('Jotter/work/a.md')!.data;

    await type('task-repeat', 'week', 'change');
    await settle();
    expect(file()).toMatch(/repeat:\n\s+every: 1\n\s+unit: week\n\s+from: completion/);

    await type('task-repeat', 'custom', 'change');
    await type('task-repeat-every', '3', 'change');
    await type('task-repeat-unit', 'month', 'change');
    await type('task-repeat-from', 'due', 'change');
    await settle();
    expect(file()).toMatch(/every: 3\n\s+unit: month\n\s+from: due/);

    await find('reminder-add').trigger('click');
    await settle();
    await type('reminder-input', '2030-05-01T08:30', 'change');
    await settle();
    expect(file()).toContain('2030-05-01T08:30');

    await closeSheet();
    await settle();
    const card = all('task-card')[0];
    expect(card.find('[data-testid="card-repeat"]').text()).toBe('Every 3 months');
    expect(card.find('[data-testid="card-reminders"]').exists()).toBe(true);

    await card.trigger('click');
    await type('task-repeat', '', 'change');
    await find('reminder-remove').trigger('click');
    await settle();
    expect(file()).not.toContain('repeat');
    expect(file()).not.toContain('reminders');
  });

  it('asks to notify when the first reminder is added, and arms the reminders of the vault', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    expect(memoryNotifications.asked).toBe(0);

    await find('reminder-add').trigger('click');
    await settle();
    expect(memoryNotifications.asked).toBe(1);
    expect(memoryNotifications.armed).toMatchObject([{ taskId: 'a', at: `${isoDay(1)}T09:00` }]); // tomorrow at nine

    await type('reminder-input', '2030-05-01T08:30', 'change');
    await settle();
    expect(memoryNotifications.armed).toMatchObject([
      { projectId: 'work', taskId: 'a', title: 'Write report', projectTitle: 'Work', at: '2030-05-01T08:30' },
    ]);

    // Asked once, not for every reminder
    await find('reminder-add').trigger('click');
    await settle();
    expect(memoryNotifications.asked).toBe(1);

    // Done tasks do not remind
    await find('task-check').trigger('click');
    await settle();
    expect(memoryNotifications.armed).toEqual([]);
  });

  it('says so when notifications are off, and keeps the reminder', async () => {
    memoryNotifications.answer = 'denied';
    await start(desktopVault);
    await find('task-card').trigger('click');

    await find('reminder-add').trigger('click');
    await settle();

    expect(find('toast').text()).toContain('Notifications are off');
    expect(find('reminder-input').exists()).toBe(true);
    expect(memoryNotifications.armed).toEqual([]);
  });

  it('opens the task of a reminder when its notification is tapped, also in another project', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
      f.put('Jotter/home/z.md', '---\ntitle: Pay rent\nstatus: todo\nreminders: ["2030-05-01T09:00"]\n---\n');
    });
    expect(find('task-title').exists()).toBe(false);

    memoryNotifications.tap('home', 'z');
    await settle();

    expect(useAppStore().projectId).toBe('home');
    expect((find('task-title').element as HTMLTextAreaElement).value).toBe('Pay rent');

    // A task that is gone opens nothing
    useUiStore().close();
    memoryNotifications.tap('home', 'gone');
    await settle();
    expect(find('task-title').exists()).toBe(false);
  });

  it('plans a recurring task for its next occurrence when it is completed in bulk, and undo restores the plan', async () => {
    const { app } = await start((f) => {
      desktopVault(f);
      f.put(
        'Jotter/work/a.md',
        `---\ntitle: Write report\nstatus: todo\nposition: 1000\nplanned_date: "${isoDay(2)}"\nrepeat:\n  every: 1\n  unit: week\n---\n`
      );
    });

    const before = await app.moveManyToBucket(['a'], 'done');
    await settle();
    expect(file('a')).toContain('status: todo');
    expect(file('a')).toContain(`planned_date: ${isoDay(7)}`);

    await app.restoreMany(before);
    await settle();
    expect(file('a')).toContain(`planned_date: ${isoDay(2)}`);
  });

  it('does not arm a reminder of the current minute, which is already past', async () => {
    memoryNotifications.state = 'granted';
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/a.md', `---\ntitle: Write report\nstatus: todo\nreminders: ["${localDateTime()}", "2999-01-01T09:00"]\n---\n`);
    });

    expect(memoryNotifications.armed.map((r) => r.at)).toEqual(['2999-01-01T09:00']);
  });

  it('keeps a planned date and a colour that another tool wrote outside the menus', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/a.md', '---\ntitle: Odd values\nstatus: todo\nplanned_date: 2031-W19\ncolor: "#12ab34"\n---\n');
    });
    // A plan so far ahead is kept out of the board until the view looks that far
    useAppStore().setHorizon('all');
    await settle();
    await find('task-card').trigger('click');
    expect((find('task-planned').element as HTMLSelectElement).value).toBe('2031-W19');
    expect(find('task-planned').text()).toContain('Week 19');
    expect(find('color-custom').exists()).toBe(true);

    // Editing something else must not touch them
    await find('task-title').setValue('Odd values, renamed');
    await closeSheet();
    await settle();
    expect(fs.files.get('Jotter/work/a.md')?.data).toContain('planned_date: 2031-W19');
    expect(fs.files.get('Jotter/work/a.md')?.data).toMatch(/color: ['"]?#12ab34/);
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
    await closeSheet();

    // The back arrow drops the search and every filter
    await find('close-search').trigger('click');
    await settle();
    expect(all('task-card')).toHaveLength(3);
    expect(find('search-input').exists()).toBe(false);
    expect(find('filter-active').exists()).toBe(false);
  });

  it('understands the query language of the desktop search in the search field', async () => {
    await start(desktopVault);
    const titles = () => all('task-card').map((c) => c.text());
    await find('open-search').trigger('click');

    await type('search-input', 'tag:office prio:high');
    expect(titles()).toEqual([expect.stringContaining('Write report')]);

    await type('search-input', 'due:none');
    expect(titles()).toEqual([expect.stringContaining('Write report'), expect.stringContaining('Ship release')]);

    await type('search-input', 'due:before:2020-12-31 bucket:todo');
    expect(titles()).toEqual([expect.stringContaining('Book flights')]);

    // A word typed so far finds the words that start with it, in the notes too
    await type('search-input', 'quart');
    expect(titles()).toEqual([expect.stringContaining('Write report')]);
    await type('search-input', 'port');
    expect(titles()).toEqual([]);
    expect(find('filter-active').exists()).toBe(false); // plain words are no extra filter
  });

  it('keeps the filter sheet and the search field in step', async () => {
    await start(desktopVault);
    await find('open-search').trigger('click');
    await type('search-input', 'flights prio:high');
    await find('open-filter').trigger('click');
    expect((find('filter-priority').element as HTMLSelectElement).value).toBe('high');

    await type('filter-due', 'none', 'change');
    expect((find('search-input').element as HTMLInputElement).value).toBe('priority:high due:none flights');

    await type('filter-priority', '', 'change');
    expect((find('search-input').element as HTMLInputElement).value).toBe('due:none flights');
    await find('filter-clear').trigger('click');
    expect((find('search-input').element as HTMLInputElement).value).toBe('');
  });

  it('puts tasks whose bucket the project does not define into an extra column', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/d.md', '---\ntitle: Lost task\nstatus: someday-maybe\n---\n');
    });
    expect(all('bucket-tab')).toHaveLength(3);
    expect(all('column')[2].text()).toContain('Lost task');
  });

  it('shows the columns as one list with a section for each, folds a section away, and remembers both', async () => {
    await start(desktopVault);
    expect(all('bucket-tab')).toHaveLength(2);

    await find('view-menu').trigger('click');
    await find('layout-list').trigger('click');
    await settle();

    expect(all('bucket-tab')).toHaveLength(0);
    expect(find('columns').attributes('data-layout')).toBe('list');
    expect(all('section-header').map((h) => h.text())).toEqual(['To Do2', 'Done1']);
    expect(await capacitorKeyValue.get('jotter_lite_layout')).toBe('list');

    // The finished column starts folded; the others are open
    const [todo, done] = all('column');
    expect(todo.find('ul').isVisible()).toBe(true);
    expect(done.find('ul').isVisible()).toBe(false);

    await done.find('[data-testid="section-header"] button').trigger('click');
    expect(done.find('ul').isVisible()).toBe(true);
    await todo.find('[data-testid="section-header"] button').trigger('click');
    expect(todo.find('ul').isVisible()).toBe(false);
    expect(todo.find('[data-testid="section-header"] button').attributes('aria-expanded')).toBe('false');
    expect(JSON.parse((await capacitorKeyValue.get('jotter_lite_collapsed:jotter')) ?? '{}')).toEqual({ done: false, todo: true });
  });

  it('opens the folded sections that a search finds something in, and shows an empty column as a header', async () => {
    const { app } = await start(desktopVault);
    app.setLayout('list');
    await settle();
    expect(all('column')[1].find('ul').isVisible()).toBe(false);

    app.query = 'Ship';
    await settle();
    expect(all('column')[1].find('ul').isVisible()).toBe(true);

    app.query = 'nothing matches this';
    await settle();
    expect(all('section-header').map((h) => h.text())).toEqual(['To Do0', 'Done0']);
    expect(wrapper.text()).not.toContain('No matches');
  });

  it('selects the tasks of every section in the list, and those of the column in view in the tabs', async () => {
    const { app } = await start(desktopVault);
    app.setLayout('list');
    await settle();
    await find('open-search').trigger('click');
    app.selectOnly([]);
    app.toggleSelected(app.columns[0].tasks[0].id);
    await settle();
    await find('select-all').trigger('click');
    expect(app.selectedCount).toBe(3);

    app.setLayout('tabs');
    app.toggleSelected(app.columns[0].tasks[0].id);
    await settle();
    await find('select-all').trigger('click');
    expect(app.selectedCount).toBe(2);
  });

  it('picks up changes made outside the app on refresh', async () => {
    await start(desktopVault);
    fs.put('Jotter/work/e.md', '---\ntitle: Added by sync\nstatus: done\n---\n');

    await openDrawer();
    await find('drawer-vault').trigger('click');
    await find('vaults-rescan').trigger('click');
    await settle();

    expect(all('column')[1].text()).toContain('Added by sync');
  });

  it('warns about files it could not read', async () => {
    await start(desktopVault);
    fs.put('Jotter/work/broken.md', '---\ntitle: [unclosed\n---\n');
    await openDrawer();
    await find('drawer-vault').trigger('click');
    await find('vaults-rescan').trigger('click');
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

  it('switches the project from the title in the app bar', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
      f.put('Jotter/home/x.md', '---\ntitle: Water plants\n---\n');
    });
    expect(find('app-bar-title').text()).toBe('Home');
    await find('open-projects').trigger('click');
    await settle();
    const rows = all('project-switch-row');
    expect(rows.map((r) => r.text())).toEqual(['Home', 'Work']);
    expect(rows[0]!.attributes('aria-current')).toBe('true');

    await rows[1]!.trigger('click');
    await settle();
    expect(find('project-switch-list').exists()).toBe(false);
    expect(find('app-bar-title').text()).toBe('Work');
    expect(find('board').text()).toContain('Write report');

    // Managing leads to the full list
    await find('open-projects').trigger('click');
    await settle();
    await find('project-switch-manage').trigger('click');
    await settle();
    expect(all('project-row').length).toBe(2);
  });

  it('pins a project to the top of the lists, and remembers it', async () => {
    const vault = (f: MemoryFs) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
    };
    await start(vault);
    const names = () => all('drawer-project').map((r) => r.text().trim());
    await openDrawer();
    expect(names()).toEqual(['Home', 'Work']);
    expect(find('drawer-pinned').exists()).toBe(false);

    await find('drawer-manage-projects').trigger('click');
    await settle();
    const work = all('project-row').find((r) => r.text().includes('Work'))!;
    await work.find('[data-testid="project-pin"]').trigger('click');
    expect(all('project-row')[0]!.text()).toContain('Work');
    expect(work.find('[data-testid="project-pin"]').attributes('aria-pressed')).toBe('true');
    await closeSheet();
    await openDrawer();
    expect(names()).toEqual(['Work', 'Home']);
    expect(all('drawer-pinned')).toHaveLength(1);

    // The pin is in the vault's settings.json, next to what the desktop keeps there
    expect(JSON.parse(await fs.readText('Jotter/settings.json'))).toMatchObject({ pinnedProjectIds: ['work'] });
  });

  it('shows the pins and the project order the desktop app saved, and keeps its other settings', async () => {
    const { app } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
      f.put('Jotter/lab/index.md', '---\ntitle: Lab\n---\n');
      f.put(
        'Jotter/settings.json',
        JSON.stringify({ pinnedProjectIds: ['lab'], sortBy: 'manual', projectOrder: ['work', 'home', 'lab'], currentTheme: 'nordic-dark' })
      );
    });
    expect(app.orderedProjects.map((p) => p.id)).toEqual(['lab', 'work', 'home']);

    await openDrawer();
    await find('drawer-manage-projects').trigger('click');
    await settle();
    await all('project-down')[1]!.trigger('click');
    await settle();
    expect(app.orderedProjects.map((p) => p.id)).toEqual(['lab', 'home', 'work']);
    // A pinned project does not move out of the pinned group
    await all('project-up')[0]!.trigger('click');
    expect(app.orderedProjects.map((p) => p.id)).toEqual(['lab', 'home', 'work']);

    expect(JSON.parse(await fs.readText('Jotter/settings.json'))).toEqual({
      pinnedProjectIds: ['lab'],
      sortBy: 'manual',
      projectOrder: ['lab', 'home', 'work'],
      currentTheme: 'nordic-dark',
    });
  });

  it('moves pins kept on the device by an older version into the vault', async () => {
    await capacitorKeyValue.set('jotter_lite_pinned:jotter', JSON.stringify(['work']));
    const { app } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
    });
    await settle();
    expect(app.pinned).toEqual(['work']);
    expect(JSON.parse(await fs.readText('Jotter/settings.json'))).toEqual({ pinnedProjectIds: ['work'] });
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

describe('message bar', () => {
  it('wraps a long message instead of cutting it to one line, and keeps it longer', async () => {
    await start(desktopVault);
    const ui = useUiStore();
    const message = 'Something went wrong while saving the task, and the reason is a rather long one. '.repeat(3).trim();
    vi.useFakeTimers();
    try {
      ui.showToast(message);
      await nextTick();
      expect(find('toast').text()).toBe(message);
      expect(find('toast').find('span').classes()).not.toContain('truncate');

      vi.advanceTimersByTime(2600);
      await nextTick();
      expect(find('toast').exists()).toBe(true);
      vi.advanceTimersByTime(message.length * 60);
      await nextTick();
      expect(find('toast').exists()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('settings', () => {
  it('chooses the project for quick capture and keeps it in the vault, next to the desktop settings', async () => {
    const { app } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
      f.put('Jotter/settings.json', JSON.stringify({ currentTheme: 'nordic-dark' }));
    });
    await openDrawer();
    await find('drawer-settings').trigger('click');
    await settle();
    await type('setting-capture-project', 'home', 'change');
    await settle();
    expect(app.captureProjectId).toBe('home');
    expect(JSON.parse(await fs.readText('Jotter/settings.json'))).toEqual({ currentTheme: 'nordic-dark', captureProjectId: 'home' });

    await type('setting-capture-project', '', 'change');
    await settle();
    expect(app.captureProjectId).toBeNull();
  });

  it('switches the language and the theme, and remembers both', async () => {
    await start(desktopVault);
    const settings = useSettingsStore();
    await settings.restore(); // as at start: settings are read first, then saved on every change
    expect(find('open-search').attributes('aria-label')).toBe('Search');

    await openDrawer();
    await find('drawer-settings').trigger('click');
    await settle();
    await type('setting-language', 'de', 'change');
    await type('setting-theme', 'midnight', 'change');

    expect(wrapper.text()).toContain('Einstellungen');
    expect(document.documentElement.classList.contains('theme-midnight')).toBe(true);
    await settle();
    expect(JSON.parse((await capacitorKeyValue.get('jotter_lite_settings'))!)).toEqual({
      theme: 'midnight',
      lightTheme: 'nordic-light',
      darkTheme: 'midnight',
      language: 'de',
    });
    expect(find('open-search').attributes('aria-label')).toBe('Suchen');

    // Another theme replaces it; the default theme has no class, and so does the system choice on a light device
    await type('setting-theme', 'sakura', 'change');
    expect([...document.documentElement.classList].filter((c) => c.startsWith('theme-'))).toEqual(['theme-sakura']);
    settings.theme = 'system';
    await settle();
    expect([...document.documentElement.classList].filter((c) => c.startsWith('theme-'))).toEqual([]);
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
  it('opens the drawer with the vault, the projects and settings, and closes it again', async () => {
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
    expect(find('drawer-rescan').exists()).toBe(false); // rescanning lives in the vault list

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

  it('keeps a tapped tab selected while the columns scroll to it, and follows the finger again afterwards', async () => {
    await start(desktopVault);
    const scroller = find('columns').element as HTMLElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 390, configurable: true });
    scroller.scrollTo = vi.fn() as unknown as typeof scroller.scrollTo;
    const selected = () => all('bucket-tab').map((t) => t.attributes('aria-selected'));
    const scrollTo = async (left: number) => {
      Object.defineProperty(scroller, 'scrollLeft', { value: left, configurable: true });
      await find('columns').trigger('scroll');
    };

    await all('bucket-tab')[1].trigger('click');
    expect(selected()).toEqual(['false', 'true']);
    await scrollTo(40); // the first frames of the smooth scroll are still near the old column
    expect(selected()).toEqual(['false', 'true']);
    expect(useUiStore().columnProgress).toBeCloseTo(40 / 390); // the underline follows the scroll
    await scrollTo(390); // arrived
    expect(selected()).toEqual(['false', 'true']);

    await scrollTo(100); // a finger moves the columns back
    expect(selected()).toEqual(['true', 'false']);
  });

  it('scrolls the tab strip with the columns, to the point between two tabs, without an animation of its own', async () => {
    await start(desktopVault);
    const strip = find('tab-strip').element as HTMLElement;
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(strip, 'scrollWidth', { value: 900, configurable: true });
    all('bucket-tab').forEach((tab, i) => {
      Object.defineProperty(tab.element, 'offsetLeft', { value: i * 300, configurable: true });
      Object.defineProperty(tab.element, 'offsetWidth', { value: 300, configurable: true });
    });
    window.dispatchEvent(new Event('resize')); // the tabs are measured again
    const scrollTo = vi.fn();
    strip.scrollTo = scrollTo as unknown as typeof strip.scrollTo;

    useUiStore().columnProgress = 0.5;
    await settle();
    expect(strip.scrollLeft).toBe(150); // halfway between "first tab centred" (0) and "second tab centred" (300)
    useUiStore().columnProgress = 1;
    await settle();
    expect(strip.scrollLeft).toBe(300);
    expect(scrollTo).not.toHaveBeenCalled();
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
    await closeSheet();
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

/** A tap on the circle in front of a task. */
async function check(title: string) {
  await row(title).find('[data-testid="row-check"]').trigger('click');
  await settle();
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

  it('marks a task done with the circle in front of it, without opening it, and can undo', async () => {
    await start(desktopVault);
    await check('Write report');

    expect(file('a')).toContain('status: done');
    expect(find('toast').text()).toContain('Marked done');
    expect(find('task-title').exists()).toBe(false);

    await find('toast-action').trigger('click');
    await settle();
    expect(file('a')).toContain('status: todo');
  });

  it('rolls a recurring task over when its circle is ticked, and undo puts its dates back', async () => {
    await start((f) => {
      desktopVault(f);
      f.put(
        'Jotter/work/a.md',
        '---\ntitle: Write report\nstatus: todo\nposition: 1000\ndue_date: "2030-01-01"\nrepeat:\n  every: 1\n  unit: week\n  from: due\n---\n'
      );
    });
    await check('Write report');

    expect(file('a')).toContain('status: todo');
    expect(file('a')).toContain('due_date: 2030-01-08');
    expect(file('a')).toContain('planned_date: 2030-01-08');

    await find('toast-action').trigger('click');
    await settle();
    expect(file('a')).toContain('due_date: 2030-01-01');
    expect(file('a')).not.toContain('planned_date');
  });

  it('takes a done task back to the inbox with its circle, and can undo', async () => {
    await start(desktopVault);
    await check('Ship release');

    expect(file('c')).toContain('status: todo'); // the first open bucket
    expect(find('toast').text()).toContain('Reopened');
    expect(all('bucket-tab').map((t) => t.text())).toEqual(['To Do 3', 'Done 0']);

    await find('toast-action').trigger('click');
    await settle();
    expect(file('c')).toContain('status: done');
  });

  it('marks an archived task done with its circle, and can undo', async () => {
    await start((f) => {
      f.put(
        'Jotter/work/index.md',
        '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n  - name: archive\n    title: Archive\n---\n'
      );
      f.put('Jotter/work/a.md', '---\ntitle: Old\nstatus: archive\n---\n');
    });
    await check('Old');

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

  it('keeps archiving to the task sheet and the column picker', async () => {
    await start(desktopVault);
    await row('Ship release').find('[data-testid="task-card"]').trigger('click');
    // The actions that change the task are behind the menu, away from the arrow that leaves the page
    expect(find('task-archive').exists()).toBe(false);
    await find('task-menu').trigger('click');
    expect(find('task-archive').exists()).toBe(true);
    await find('task-archive').trigger('click');
    await settle();
    expect(file('c')).toContain('status: archive');
    expect(find('toast').text()).toContain('Archived');
  });

  it('moves a task to a column of its choice with the toolbar', async () => {
    await start(desktopVault);
    await holdSelect('Write report');
    await find('bulk-move').trigger('click');
    await settle();

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

  it('moves the selected tasks into the column in view with Move here', async () => {
    await start(desktopVault);
    await holdSelect('Write report');
    expect(find('move-here').exists()).toBe(false); // the task is in this column already

    // Another column is opened with the task still selected
    useUiStore().activeColumn = 1;
    await settle();
    expect(find('selection-count').text()).toContain('1');
    await find('move-here').trigger('click');
    await settle();

    expect(file('a')).toContain('status: done');
    expect(find('toast').text()).toContain('Moved to Done');
    expect(find('move-here').exists()).toBe(false); // the selection is used up
  });

  it('moves the selected tasks into a section of the list with its Move here', async () => {
    await start(desktopVault);
    await find('view-menu').trigger('click');
    await find('layout-list').trigger('click');
    await settle();
    expect(find('move-here-done').exists()).toBe(false); // nothing is selected

    await holdSelect('Write report');
    expect(find('move-here-todo').exists()).toBe(false); // it is in this section already
    await find('move-here-done').trigger('click');
    await settle();

    expect(file('a')).toContain('status: done');
    expect(find('toast').text()).toContain('Moved to Done');
    expect(find('move-here-done').exists()).toBe(false);
  });

  it('finishes and archives from the task sheet, keeping what was typed', async () => {
    await start(desktopVault);
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    await find('task-title').setValue('Write the final report');
    await find('task-check').trigger('click');
    await settle();

    expect(find('task-title').exists()).toBe(false);
    expect(file('a')).toContain('title: Write the final report');
    expect(file('a')).toContain('status: done');
    // The sheet closing must not move the task back to where its draft still said it was
    expect(file('a')).not.toContain('status: todo');

    await row('Write the final report').find('[data-testid="task-card"]').trigger('click');
    expect(find('task-check').attributes('aria-checked')).toBe('true');
    await find('task-menu').trigger('click');
    expect(find('task-done').text()).toContain('Reopen'); // the menu offers what the circle does
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
    expect(find('toast').exists()).toBe(false); // a new place in the same column is nothing to announce
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

  it('drags the row instead once the hold has fired', async () => {
    await start(desktopVault);
    stubLayout();
    pointer('pointerdown', 50, 100, wrapper.find('[data-task-id="a"]').element);
    await new Promise((resolve) => setTimeout(resolve, 90));
    pointer('pointermove', 150, 102); // sideways after the hold
    pointer('pointermove', 250, 104);
    await settle();

    expect(find('drag-ghost').exists()).toBe(true);
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
    expect(['bulk-move', 'bulk-tag', 'bulk-priority', 'bulk-planned', 'bulk-more'].every((id) => find(id).exists())).toBe(true);

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

  it('marks all selected tasks done from the overflow menu, and can undo them together', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await find('bulk-more').trigger('click');
    await settle();
    await find('more-done').trigger('click');
    await settle();

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

  it('moves all selected tasks to the column chosen in the picker', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await find('bulk-move').trigger('click');
    await settle();

    expect(find('move-list').exists()).toBe(true);
    await find('move-to-done').trigger('click');
    await settle();

    expect(file('a')).toContain('status: done');
    expect(file('b')).toContain('status: done');
    expect(find('toast').text()).toContain('2 tasks moved to Done');
  });

  it('selects instead of finishing when the circle is tapped during a selection', async () => {
    await start(desktopVault);
    await pick('Write report');
    await wait(450); // the click that ends the long press is over
    await check('Book flights');

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

    await type('tags-input', '#Urgent, errands, big plan');
    await submit('tags-add');
    expect(file('a')).toContain('urgent');
    expect(file('b')).toContain('errands');
    // A space separates tags: "big plan" is two tags
    expect(find('tags-on-tasks').text()).toContain('#big');
    expect(find('tags-on-tasks').text()).toContain('#plan');
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
    await closeSheet();
    await settle();

    await pick('Write report', 'Book flights');
    await find('bulk-more').trigger('click');
    await settle();
    await find('more-project').trigger('click');
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

  it('sets the planned date of the selection from the toolbar', async () => {
    await start(desktopVault);
    await pick('Write report', 'Book flights');
    await find('bulk-planned').trigger('click');
    await settle();
    await find(`planned-${weekOf(today())}`).trigger('click');
    await settle();
    expect(file('a')).toContain(`planned_date: ${weekOf(today())}`);
    expect(file('b')).toContain(`planned_date: ${weekOf(today())}`);

    // A day of its own choosing
    await find('bulk-planned').trigger('click');
    await settle();
    await type('planned-day-input', '2031-05-06', 'input');
    await find('planned-day-apply').trigger('click');
    await settle();
    expect(file('a')).toContain('planned_date: 2031-05-06');
  });

  it('offers more bulk actions: archive, due date, colour, delete', async () => {
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

    await closeSheet();
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

describe('tag and planning views', () => {
  const viewsVault = (f: MemoryFs) => {
    f.put('Jotter/work/index.md', '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n---\n');
    f.put('Jotter/work/a.md', '---\ntitle: Write report\nstatus: todo\nposition: 1000\ntags: [office, travel]\nplanned_date: today\n---\n');
    f.put('Jotter/work/b.md', '---\ntitle: Book flights\nstatus: todo\nposition: 2000\ntags: [office]\nplanned_date: this-week\n---\n');
    f.put('Jotter/work/c.md', '---\ntitle: Ship release\nstatus: done\nposition: 1000\ntags: [office]\nplanned_date: today\n---\n');
    f.put('Jotter/work/d.md', '---\ntitle: Loose end\nstatus: todo\nposition: 3000\n---\n');
  };
  const tabs = () => all('bucket-tab').map((t) => t.text());
  const switchTo = async (view: 'board' | 'tags' | 'planning') => {
    await find(`view-${view}`).trigger('click');
    await settle();
  };
  const column = (index: number) => all('column')[index]!.text();

  it('groups the open tasks by tag, a task with two tags in both, and leaves done ones out', async () => {
    await start(viewsVault);
    await switchTo('tags');

    expect(find('app-bar-title').text()).toBe('Work');
    expect(tabs().map((t) => t.replace(/\d+$/, '').trim())).toEqual(['#office', '#travel', 'Untagged']);
    expect(column(0)).toContain('Write report');
    expect(column(0)).toContain('Book flights');
    expect(column(0)).not.toContain('Ship release');
    expect(column(1)).toContain('Write report');
    expect(column(2)).toContain('Loose end');
  });

  it('groups the open tasks by when they are planned, whatever the spelling in the file', async () => {
    await start(viewsVault);
    await switchTo('planning');

    expect(tabs().map((t) => t.replace(/\d+$/, '').trim())).toEqual([
      'Today',
      'Tomorrow',
      'This week',
      'This month',
      'Later',
      'Not planned',
    ]);
    expect(column(0)).toContain('Write report');
    expect(column(0)).not.toContain('Ship release');
    expect(column(2)).toContain('Book flights');
    expect(column(5)).toContain('Loose end');
  });

  it('shows a tab for what has slipped, once something has', async () => {
    await start((f) => {
      viewsVault(f);
      f.put('Jotter/work/e.md', '---\ntitle: Missed it\nstatus: todo\nposition: 4000\nplanned_date: 2020-01-31\n---\n');
    });
    await switchTo('planning');

    expect(tabs().map((t) => t.replace(/\d+$/, '').trim())[0]).toBe('Slipped');
    expect(column(0)).toContain('Missed it');
  });

  it('remembers the view and goes back to the board', async () => {
    await start(viewsVault);
    await switchTo('tags');
    expect(useAppStore().view).toBe('tags');
    await switchTo('board');
    expect(tabs().map((t) => t.replace(/\d+$/, '').trim())).toEqual(['To Do', 'Done']);
  });

  it('moves to a column from the toolbar in the other views too', async () => {
    await start(viewsVault);
    await switchTo('tags');
    useUiStore().activeColumn = 2;
    await holdSelect('Loose end');
    await find('bulk-move').trigger('click');
    await settle();
    await find('move-to-done').trigger('click');
    await settle();
    expect(file('d')).toContain('status: done');
  });

  it('files a new task with the tag or the planned date of the tab in view', async () => {
    await start(viewsVault);
    await switchTo('tags');
    useUiStore().activeColumn = 1;
    await find('fab').trigger('click');
    await type('quick-add-input', 'Pack bags');
    await submit('quick-add-input');
    await closeSheet();
    await settle();
    const created = () => [...fs.files.entries()].find(([, f]) => f.data.includes('Pack bags'))![1].data;
    expect(created()).toContain('travel');

    await switchTo('planning');
    useUiStore().activeColumn = 1;
    await find('fab').trigger('click');
    await type('quick-add-input', 'Call back');
    await submit('quick-add-input');
    await closeSheet();
    await settle();
    expect([...fs.files.entries()].find(([, f]) => f.data.includes('Call back'))![1].data).toContain(`planned_date: ${isoDay(1)}`);
  });
});

describe('view options in the app bar', () => {
  const vault = (f: MemoryFs) => {
    f.put(
      'Jotter/work/index.md',
      '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: done\n    title: Done\n  - name: archive\n    title: Archive\n---\n'
    );
    f.put('Jotter/work/a.md', '---\ntitle: Open task\nstatus: todo\nposition: 1000\n---\n');
    f.put('Jotter/work/b.md', '---\ntitle: Finished task\nstatus: done\nposition: 1000\n---\n');
    f.put('Jotter/work/c.md', '---\ntitle: Old task\nstatus: archive\nposition: 1000\n---\n');
  };
  const tabs = () => all('bucket-tab').map((t) => t.text());
  const toggle = async (id: 'hide-done' | 'hide-archive') => {
    await find('view-menu').trigger('click');
    await find(id).trigger('click');
    await settle();
  };

  it('hides the done and archive columns of the board, and shows them again', async () => {
    await start(vault);
    expect(tabs()).toHaveLength(3);

    await toggle('hide-done');
    expect(tabs()).toHaveLength(2);
    await toggle('hide-archive');
    expect(tabs()).toHaveLength(1);
    expect(find('board').text()).not.toContain('Finished task');

    await find('view-menu').trigger('click');
    expect(find('hide-done').attributes('aria-checked')).toBe('true');
    await find('hide-done').trigger('click');
    await settle();
    expect(tabs()).toHaveLength(2);
  });

  it('keeps the choice per view and offers it in the tag view, where finished tasks are hidden at first', async () => {
    await start(vault);
    await find('view-tags').trigger('click');
    await settle();
    expect(find('board').text()).not.toContain('Finished task');

    await toggle('hide-done');
    expect(find('board').text()).toContain('Finished task');
    expect(find('board').text()).not.toContain('Old task');

    await find('view-board').trigger('click');
    await settle();
    expect(tabs()).toHaveLength(3);
  });

  it('remembers the choice', async () => {
    await start(vault);
    await toggle('hide-archive');
    await start(vault);
    expect(tabs()).toHaveLength(2);
  });
});

describe('planning ahead', () => {
  const vault = (f: MemoryFs) => {
    desktopVault(f);
    f.put('Jotter/work/d.md', '---\ntitle: Later task\nstatus: todo\nposition: 3000\nplanned_date: "2999-01-01"\n---\n');
    f.put('Jotter/work/e.md', '---\ntitle: Back again\nstatus: todo\nposition: 4000\nplanned_date: "2020-01-01"\n---\n');
  };
  const tabs = () => all('bucket-tab').map((t) => t.text().replace(/\d+$/, '').trim());
  const setHorizon = async (horizon: string) => {
    await find('view-menu').trigger('click');
    await find('open-horizon').trigger('click');
    await find(`horizon-${horizon}`).trigger('click');
    await settle();
  };

  it('keeps tasks planned beyond the horizon out of their column, and shows those whose day has come', async () => {
    await start(vault);
    expect(tabs()).toEqual(['To Do', 'Done']);
    expect(find('board').text()).not.toContain('Later task');
    // The menu says how many tasks are out of the way, and how far ahead the view looks
    await find('view-menu').trigger('click');
    expect(find('open-horizon').text()).toContain('1 · Today');
    await find('view-menu').trigger('click');
    expect(find('board').text()).toContain('Back again');

    await setHorizon('all');
    expect(find('board').text()).toContain('Later task');
  });

  it('looks as far ahead as the horizon says, and remembers it for each view on its own', async () => {
    await start((f) => {
      vault(f);
      f.put('Jotter/work/g.md', `---\ntitle: Next week task\nstatus: todo\nposition: 5000\nplanned_date: "${isoDay(7)}"\n---\n`);
    });
    expect(find('board').text()).not.toContain('Next week task');
    await setHorizon('month');
    expect(useAppStore().horizon).toBe('month');
    // The planning view looks ahead by default, and leaves the board alone
    await find('view-planning').trigger('click');
    await settle();
    expect(useAppStore().horizon).toBe('all');
    expect(find('board').text()).toContain('Later task');
    await find('view-board').trigger('click');
    await settle();
    expect(find('board').text()).not.toContain('Later task');
  });

  it('says how many tasks a search found beyond the horizon, and shows them on request', async () => {
    await start(vault);
    expect(find('beyond-hint').exists()).toBe(false); // nothing is searched for

    await find('open-search').trigger('click');
    await type('search-input', 'Later');
    expect(find('board').text()).not.toContain('Later task');
    expect(find('beyond-hint').text()).toContain('1 more found');

    await find('beyond-show').trigger('click');
    await settle();
    expect(find('board').text()).toContain('Later task');
    expect(find('beyond-hint').exists()).toBe(false);
  });

  it('does not cut a query that names planned dates by the horizon', async () => {
    await start(vault);
    await find('open-search').trigger('click');
    await type('search-input', 'planned:2999-01-01');
    expect(find('board').text()).toContain('Later task');
    expect(find('beyond-hint').exists()).toBe(false);
  });

  it('starts the board and the tags with the horizon of the vault, and lets a view keep its own', async () => {
    const { app } = await start((f) => {
      vault(f);
      f.put('Jotter/settings.json', JSON.stringify({ planningHorizon: 'all' }));
    });
    expect(app.defaultHorizon).toBe('all');
    expect(find('board').text()).toContain('Later task');

    // The tags follow the default too; a horizon set on the board is the board's own
    await find('view-tags').trigger('click');
    await settle();
    expect(app.horizon).toBe('all');
    await find('view-board').trigger('click');
    await settle();
    await setHorizon('today');
    expect(find('board').text()).not.toContain('Later task');
    app.setDefaultHorizon('month');
    await settle();
    expect(app.horizon).toBe('today'); // the board keeps what it was given
    await find('view-tags').trigger('click');
    await settle();
    expect(app.horizon).toBe('month'); // the tags follow the new default
  });

  it('sets the default horizon in the settings, and writes it to the vault for the desktop', async () => {
    await start(vault);
    await openDrawer();
    await find('drawer-settings').trigger('click');
    await settle();
    expect((find('setting-horizon').element as HTMLSelectElement).value).toBe('today');
    await type('setting-horizon', 'week', 'change');
    expect(JSON.parse(fs.files.get('Jotter/settings.json')!.data).planningHorizon).toBe('week');
    expect(useAppStore().horizon).toBe('week');
  });

  it('leaves tasks planned ahead out of the tag view until the horizon is wider', async () => {
    await start(vault);
    await find('view-tags').trigger('click');
    await settle();
    expect(find('board').text()).not.toContain('Later task');
    await setHorizon('all');
    expect(find('board').text()).toContain('Later task');
  });

  it('keeps the plan when a task planned ahead is moved to another column, and undo puts it back', async () => {
    await start(vault);
    await setHorizon('all');
    await holdSelect('Later task');
    await find('bulk-move').trigger('click');
    await settle();
    await find('move-to-done').trigger('click');
    await settle();
    expect(file('d')).toContain('planned_date: 2999-01-01');
    expect(file('d')).toContain('status: done');

    await find('toast-action').trigger('click');
    await settle();
    expect(file('d')).toContain('planned_date: 2999-01-01');
    expect(file('d')).toContain('status: todo');
  });

  it('plans a task for a day on the task page, and clears it with the button beside it', async () => {
    await start(desktopVault);
    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    expect(find('task-planned-day').exists()).toBe(false);
    await type('task-planned', '__day', 'change');
    await type('task-planned-day', '2999-05-05', 'change');
    await settle();
    expect(file('a')).toContain('planned_date: 2999-05-05');

    await find('task-planned-clear').trigger('click');
    await settle();
    expect(file('a')).not.toContain('planned_date');
  });
});

describe('task page', () => {
  it('leaves with the arrow, saving what was typed, and closes the menu with a tap outside it', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    expect(find('task-page').exists()).toBe(true);
    expect(find('sheet-backdrop').exists()).toBe(false);

    await find('task-menu').trigger('click');
    expect(find('task-menu-list').exists()).toBe(true);
    await find('task-menu-scrim').trigger('click');
    expect(find('task-menu-list').exists()).toBe(false);
    expect(file('a')).toContain('status: todo');

    (find('task-title').element as HTMLTextAreaElement).value = 'Write the final report';
    await find('task-title').trigger('input');
    await find('task-back').trigger('click');
    await settle();
    expect(find('task-page').exists()).toBe(false);
    expect(file('a')).toContain('title: Write the final report');
  });

  it('finishes a task from the menu too, for whoever looks there', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    await find('task-menu').trigger('click');
    expect(find('task-done').text()).toContain('Mark done');
    await find('task-done').trigger('click');
    await settle();
    expect(find('task-page').exists()).toBe(false);
    expect(file('a')).toContain('status: done');
  });

  it('takes a finished task back to the inbox with the circle beside the title', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    await find('task-check').trigger('click');
    await settle();
    expect(file('a')).toContain('status: done');

    await row('Write report').find('[data-testid="task-card"]').trigger('click');
    await find('task-check').trigger('click');
    await settle();
    expect(find('task-page').exists()).toBe(false);
    expect(file('a')).toContain('status: todo');
  });

  it('sets a deadline after "Add deadline" and clears it with the button beside it', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    // The deadline is the rare date: no line for it until it is asked for
    expect(find('task-due').exists()).toBe(false);
    expect(find('task-due-clear').exists()).toBe(false);

    await find('task-add-deadline').trigger('click');
    await settle();
    expect(find('task-add-deadline').exists()).toBe(false);
    expect(find('task-due').exists()).toBe(true);

    await find('task-due').setValue(isoDay(1));
    await settle();
    expect(file('a')).toContain(`due_date: ${isoDay(1)}`);
    expect(find('group-time').text()).toContain('Tomorrow');

    await find('task-due-clear').trigger('click');
    await settle();
    expect(file('a')).not.toContain('due_date');
    expect(find('task-due').exists()).toBe(false);
    expect(find('task-add-deadline').exists()).toBe(true);
  });

  it('shows the deadline line of a task that has one', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/a.md', `---\ntitle: Write report\nstatus: todo\nposition: 1000\ndue_date: "${isoDay(3)}"\n---\n`);
    });
    await find('task-card').trigger('click');
    expect(find('task-due').exists()).toBe(true);
    expect(find('task-add-deadline').exists()).toBe(false);
  });

  it('says when the task was made and last changed, and does not touch it by opening it', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    expect(find('task-stamps').text()).toMatch(/^Created .+ · Updated .+$/);
    const before = file('a');
    await find('task-back').trigger('click');
    await settle();
    expect(file('a')).toBe(before);
  });

  it('has no Save button: the arrow leaves', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    expect(find('task-save').exists()).toBe(false);
  });
});

describe('swiping between columns', () => {
  it('moves one column per swipe, however hard the flick', async () => {
    await start((f) => {
      desktopVault(f);
      f.put(
        'Jotter/work/index.md',
        '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: doing\n    title: Doing\n  - name: review\n    title: Review\n  - name: done\n    title: Done\n---\n'
      );
    });
    const scroller = find('columns').element as HTMLElement;
    Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true });
    const scrollTo = async (left: number) => {
      scroller.scrollLeft = left;
      scroller.dispatchEvent(new Event('scroll'));
      await settle();
    };

    // Finger down on the first column, then momentum carries the page towards the fourth
    scroller.dispatchEvent(new Event('touchstart'));
    await scrollTo(300);
    expect(scroller.scrollLeft).toBe(300);
    await scrollTo(1100);
    expect(scroller.scrollLeft).toBe(400);

    // The next swipe starts from where the page rests and may move one more column
    await wait(300);
    scroller.dispatchEvent(new Event('touchstart'));
    await scrollTo(1300);
    expect(scroller.scrollLeft).toBe(800);

    // Not past the last column or before the first
    await wait(300);
    scroller.dispatchEvent(new Event('touchstart'));
    await scrollTo(2000);
    expect(scroller.scrollLeft).toBe(1200);
  });
});

describe('bottom navigation bar', () => {
  const navHidden = () => find('bottom-nav').element.hasAttribute('inert');

  it('switches the view and marks the current one', async () => {
    await start(desktopVault);
    expect(find('view-board').attributes('aria-current')).toBe('page');
    await find('view-planning').trigger('click');
    await settle();
    expect(find('view-planning').attributes('aria-current')).toBe('page');
    expect(find('view-board').attributes('aria-current')).toBeUndefined();
  });

  it('steps out of the way while tasks are selected', async () => {
    await start(desktopVault);
    expect(navHidden()).toBe(false);
    await holdSelect('Write report');
    expect(navHidden()).toBe(true);
    await find('clear-selection').trigger('click');
    await settle();
    expect(navHidden()).toBe(false);
  });

  it('hides when a list is scrolled down and returns when it is scrolled up', async () => {
    await start(desktopVault);
    const list = find('column').element as HTMLElement;
    const scrollTo = async (top: number) => {
      list.scrollTop = top;
      list.dispatchEvent(new Event('scroll'));
      await settle();
    };
    await scrollTo(80);
    expect(navHidden()).toBe(true);
    await scrollTo(40);
    expect(navHidden()).toBe(false);
    await scrollTo(120);
    expect(navHidden()).toBe(true);
    await scrollTo(0);
    expect(navHidden()).toBe(false);
  });
});

describe('quick add keyboard', () => {
  it('adds on the Enter key without the form submitting (which would close the soft keyboard), and keeps the field focused', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'Buy milk');
    await find('quick-add-input').trigger('keydown', { key: 'Enter' });
    await settle();

    expect(find('quick-add-added').text()).toContain('Buy milk');
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('');
  });

  it('opens the details of a task that was just added when its title in the list is tapped', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'Buy milk');
    await find('quick-add-input').trigger('keydown', { key: 'Enter' });
    await settle();

    await find('quick-add-added-task').trigger('click');
    await settle();

    expect((find('task-title').element as HTMLTextAreaElement).value).toBe('Buy milk');
    expect(all('quick-add-input')).toHaveLength(0);
  });

  it('opens and closes the row of keyword chips instead of leaving a gap, and keeps its buttons out of reach while closed', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    expect(find('title-hints-slot').attributes('inert')).toBeDefined();
    expect(find('title-hints-slot').classes()).toContain('grid-rows-[0fr]');

    const input = find('quick-add-input');
    (input.element as HTMLInputElement).value = 'Call mum tomorrow';
    await input.trigger('input');
    await settle();
    expect(find('title-hints-slot').attributes('inert')).toBeUndefined();
    expect(find('title-hints-slot').classes()).toContain('grid-rows-[1fr]');
  });
});

describe('smart title input', () => {
  const created = (title: string) => [...fs.files.entries()].find(([, f]) => f.data.includes(`title: ${title}`))?.[1].data ?? '';

  it('reads date, priority, tag and column out of a new title, and shows what it found', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'Call mom tomorrow p1 #family /done');

    expect(all('title-hint').map((h) => h.text())).toEqual(['Tomorrow', 'Urgent', 'Done', '#family']);

    await submit('quick-add-input');
    const data = created('Call mom');
    expect(data).toContain(`planned_date: ${isoDay(1)}`);
    expect(data).toContain('priority: urgent');
    expect(data).toContain('status: done');
    expect(data).toContain('family');
    expect(find('quick-add-added').text()).toContain('Call mom');
    expect(find('quick-add-input').element).toHaveProperty('value', '');
  });

  it('plans a date typed in the title, and takes it as a deadline after "!" or "until"', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'File taxes 1.1.2040');
    await submit('quick-add-input');
    expect(created('File taxes')).toMatch(/planned_date: ['"]?2040-01-01/);
    expect(created('File taxes')).not.toContain('due_date');

    await type('quick-add-input', 'Pay rent !1.1.2040');
    expect(all('title-hint').map((h) => h.text())).toEqual(['Jan 1, 2040']);
    await submit('quick-add-input');
    expect(created('Pay rent')).toMatch(/due_date: ['"]?2040-01-01/);
    expect(created('Pay rent')).not.toContain('planned_date');

    await type('quick-add-input', 'Send report until 2.1.2040');
    await submit('quick-add-input');
    expect(created('Send report')).toMatch(/due_date: ['"]?2040-01-02/);
  });

  it('says so when a new task is planned beyond the horizon, so it does not seem to vanish', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'Call mom 1.1.2040');
    await submit('quick-add-input');
    expect(find('toast').text()).toContain('Planned for');
    expect(find('toast').text()).toContain('hidden here until then');

    await type('quick-add-input', 'Call dad');
    await submit('quick-add-input');
    expect(find('toast').exists() ? find('toast').text() : '').not.toContain('Call dad');
  });

  it('keeps words as plain text when their chip is dismissed', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'Plan the trip for tomorrow');
    await find('title-hint-ignore').trigger('click');
    await wait(260); // the chips stay drawn while the row closes
    expect(all('title-hint')).toHaveLength(0);

    await submit('quick-add-input');
    const data = created('Plan the trip for tomorrow');
    expect(data).not.toContain('planned_date');
  });

  it('takes back a recognised keyword with backspace right after it, instead of deleting a letter', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'Call mom tomorrow');
    expect(all('title-hint')).toHaveLength(1);

    const field = find('quick-add-input').element as HTMLInputElement;
    field.setSelectionRange(field.value.length, field.value.length);
    const backspace = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true, bubbles: true });
    field.dispatchEvent(backspace);
    await settle();

    expect(backspace.defaultPrevented).toBe(true);
    expect(field.value).toBe('Call mom tomorrow');
    await wait(260);
    expect(all('title-hint')).toHaveLength(0);

    // Now it is plain text: the next backspace deletes a letter as usual
    const again = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true, bubbles: true });
    field.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
  });

  it('does not add a task that is nothing but keywords', async () => {
    await start(desktopVault);
    await find('fab').trigger('click');
    await type('quick-add-input', 'tomorrow p1');
    expect((find('quick-add-submit').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies the keywords typed into the title of an existing task when the field is left', async () => {
    await start(desktopVault);
    await find('task-card').trigger('click');
    // Typing fires input events; the change event comes when the field is left
    (find('task-title').element as HTMLTextAreaElement).value = 'Write the report p2 #urgent-ish today';
    await find('task-title').trigger('input');
    await settle();
    expect(all('title-hint')).toHaveLength(3);

    await find('task-title').trigger('change');
    await settle();
    const data = file('a');
    expect(data).toContain('title: Write the report');
    expect(data).toContain('priority: high');
    expect(data).toContain(`planned_date: ${isoDay(0)}`);
    expect(data).toContain('urgent-ish');
    expect(all('title-hint')).toHaveLength(0);
  });
});

describe('launcher shortcuts', () => {
  it('knows its links', () => {
    expect(shortcutAction('jotter://new-task')).toBe('new-task');
    expect(shortcutAction('jotter://search/')).toBe('search');
    expect(shortcutAction('jotter://planning?x=1')).toBe('planning');
    expect(shortcutAction('jotter://other')).toBeNull();
    expect(shortcutAction('https://example.com/new-task')).toBeNull();
  });

  it('files a task of the new-task shortcut in the default column, whichever column is in view, and says so', async () => {
    const { app, ui } = await start((f) => {
      f.put(
        'Jotter/work/index.md',
        '---\ntitle: Work\nbuckets:\n  - name: todo\n    title: To Do\n  - name: doing\n    title: Doing\n    is_default: true\n---\n'
      );
    });
    ui.activeColumn = 0;
    await runShortcut('jotter://new-task');
    await settle();
    expect(find('quick-add-destination').text()).toBe('Work · Doing');

    await type('quick-add-input', 'From the launcher');
    await submit('quick-add-input');
    expect(app.allTasks.find((t) => t.title === 'From the launcher')?.bucket).toBe('doing');
  });

  it('warns, without blocking, when the address in the title is already saved in the project', async () => {
    await start((f) => {
      desktopVault(f);
      f.put('Jotter/work/d.md', '---\ntitle: Saved article\nstatus: todo\nposition: 3000\n---\nhttps://www.example.com/post/1\n');
    });
    await find('fab').trigger('click');
    await settle();
    expect(find('quick-add-duplicate').exists()).toBe(false);

    await type('quick-add-input', 'https://example.com/post/1#top');
    expect(find('quick-add-duplicate').text()).toBe('Already saved: Saved article');
    await type('quick-add-input', 'https://example.com/post/2');
    expect(find('quick-add-duplicate').exists()).toBe(false);
  });

  it('takes the title of a pasted address, and looks up nothing that is typed', async () => {
    const lookUp = vi.fn(async (url: string) => (url.includes('good') ? 'A good article' : null));
    linkTitles.port = lookUp;
    const { app } = await start(desktopVault);
    const pause = () => settle();
    // What the keyboard does when text arrives in one piece, as a paste or as a clipboard suggestion
    const paste = async (text: string, inputType = 'insertFromPaste') => {
      await find('quick-add-input').trigger('beforeinput', { inputType, data: inputType === 'insertFromPaste' ? null : text });
      await type('quick-add-input', text);
      await pause();
    };
    await find('fab').trigger('click');

    // Typed letter by letter, or all at once without a paste: no site is contacted
    await type('quick-add-input', 'https://example.co');
    await type('quick-add-input', 'https://example.com/good');
    await pause();
    expect(lookUp).not.toHaveBeenCalled();

    await type('quick-add-input', '');
    await paste('https://example.com/good');
    expect(lookUp).toHaveBeenCalledTimes(1);
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('A good article');
    await submit('quick-add-input');
    const saved = app.allTasks.find((t) => t.title === 'A good article');
    expect(saved?.body.trim()).toBe('https://example.com/good');

    // A suggestion of the keyboard's clipboard arrives as typed text that holds a whole address
    await paste('https://example.com/good-two', 'insertText');
    expect(lookUp).toHaveBeenCalledTimes(2);

    // A page that cannot be read leaves the address as the title; no message, no hang
    await submit('quick-add-input');
    await paste('https://example.com/unreadable');
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('https://example.com/unreadable');
    expect(find('quick-add-looking-up').exists()).toBe(false);
    expect(useUiStore().toast).toBeNull();

    // The paste is used up: letters typed after it are not looked up
    await type('quick-add-input', '');
    await paste('https://example.com/good-three');
    await type('quick-add-input', 'https://example.com/good-three-x');
    expect(lookUp).toHaveBeenCalledTimes(4);
  });

  it('keeps the address when the look-up fails, and reads the title of a shared address', async () => {
    linkTitles.port = vi.fn(async () => {
      throw new Error('offline');
    });
    await start(desktopVault);
    await runShortcut('jotter://share?text=https%3A%2F%2Fexample.com%2Fa');
    await settle();
    await settle();
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('https://example.com/a');

    linkTitles.port = vi.fn(async () => 'Shared page');
    await runShortcut('jotter://share?text=https%3A%2F%2Fexample.com%2Fb');
    await settle();
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('Shared page');
  });

  it('shows where the + button files a task, and lets the user choose another column and project', async () => {
    const { app } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\nbuckets:\n  - name: todo\n    title: Inbox\n---\n');
    });
    await app.selectProject('work');
    await settle();
    await find('fab').trigger('click');
    await settle();
    expect(find('quick-add-destination').text()).toBe('Work · To Do');

    // The viewed column is only the default
    await find('quick-add-destination').trigger('click');
    await find('quick-add-column-done').trigger('click');
    expect(find('quick-add-destination').text()).toBe('Work · Done');
    await type('quick-add-input', 'Already finished');
    await submit('quick-add-input');
    expect(app.allTasks.find((t) => t.title === 'Already finished')?.bucket).toBe('done');

    // Another project; the choice holds for the next task
    await find('quick-add-project-home').trigger('click');
    await settle();
    expect(find('quick-add-destination').text()).toBe('Home · Inbox');
    await type('quick-add-input', 'At home');
    await submit('quick-add-input');
    expect(app.projectId).toBe('home');
    expect(app.allTasks.map((t) => t.title)).toEqual(['At home']);
  });

  it('files what comes from outside in the project chosen for quick capture, and not what is added inside a project', async () => {
    const { app } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\nbuckets:\n  - name: inbox\n    title: Inbox\n    is_default: true\n---\n');
      f.put('Jotter/settings.json', JSON.stringify({ captureProjectId: 'home', currentTheme: 'nordic-dark' }));
    });
    await settle();
    await app.selectProject('work');
    expect(app.captureProject?.id).toBe('home');

    // The launcher shortcut and shared text open the project for quick capture
    await runShortcut('jotter://new-task');
    await settle();
    expect(app.projectId).toBe('home');
    expect(find('quick-add-destination').text()).toBe('Home · Inbox');
    await closeSheet();
    await app.selectProject('work');
    await runShortcut('jotter://share?text=Read%20later');
    await settle();
    expect(app.projectId).toBe('home');
    expect(find('quick-add-input').exists()).toBe(true);
    await closeSheet();

    // A share without text opens nothing, and does not move the user either
    await app.selectProject('work');
    await runShortcut('jotter://share');
    await settle();
    expect(app.projectId).toBe('work');
    expect(find('quick-add-input').exists()).toBe(false);

    // The button in the app files where the user is
    await app.selectProject('work');
    await find('fab').trigger('click');
    await settle();
    expect(find('quick-add-destination').text()).toContain('Work');
    // Search and planning do not move the user
    await closeSheet();
    await runShortcut('jotter://search');
    expect(app.projectId).toBe('work');
  });

  it('keeps the open project when no project is chosen, or the chosen one is gone', async () => {
    const { app } = await start((f) => {
      desktopVault(f);
      f.put('Jotter/settings.json', JSON.stringify({ captureProjectId: 'deleted' }));
    });
    await settle();
    expect(app.captureProject).toBeNull();
    await runShortcut('jotter://new-task');
    await settle();
    expect(app.projectId).toBe('work');
    expect(find('quick-add-destination').text()).toContain('Work');
  });

  it('opens quick add, the search and the planning view', async () => {
    await start(desktopVault);
    await runShortcut('jotter://new-task');
    await settle();
    expect(find('quick-add-input').exists()).toBe(true);

    await runShortcut('jotter://search');
    await settle();
    expect(find('search-input').exists()).toBe(true);
    expect(find('quick-add-input').exists()).toBe(false);

    await runShortcut('jotter://planning');
    await settle();
    expect(find('view-planning').attributes('aria-current')).toBe('page');
  });

  it('waits for the vault when it starts the app, and ignores other links', async () => {
    await start(desktopVault);
    useAppStore().status = 'loading';
    const done = runShortcut('jotter://new-task');
    await settle();
    expect(find('quick-add-input').exists()).toBe(false);

    useAppStore().status = 'ready';
    await done;
    await settle();
    expect(find('quick-add-input').exists()).toBe(true);

    useUiStore().close();
    await settle();
    await runShortcut('https://example.com');
    await settle();
    expect(find('quick-add-input').exists()).toBe(false);
  });
});

describe('text shared from other apps', () => {
  const link = (params: Record<string, string>) => `jotter://share?${new URLSearchParams(params)}`;

  it('turns a subject into the title and the text into the notes, or the first line of the text into the title', () => {
    expect(sharedDraft(link({ title: 'A page', text: 'https://example.com' }))).toEqual({ title: 'A page', body: 'https://example.com' });
    expect(sharedDraft(link({ text: 'Buy milk' }))).toEqual({ title: 'Buy milk', body: undefined });
    expect(sharedDraft(link({ text: 'Plan trip\n\nBook trains\nand hotels' }))).toEqual({
      title: 'Plan trip',
      body: 'Book trains\nand hotels',
    });
    expect(sharedDraft('jotter://share')).toBeNull();
    expect(sharedDraft(link({ text: '  ' }))).toBeNull();
  });

  it('takes the words next to an address as the title and keeps the address in the notes', () => {
    expect(sharedDraft(link({ text: 'Ein Titel – https://example.com/a' }))).toEqual({ title: 'Ein Titel', body: 'https://example.com/a' });
    expect(sharedDraft(link({ text: '"Quoted headline": https://example.com/a?x=1\nMore text' }))).toEqual({
      title: '"Quoted headline"',
      body: 'https://example.com/a?x=1\nMore text',
    });
    expect(sharedDraft(link({ text: 'https://example.com/a | Headline after' }))).toEqual({
      title: 'Headline after',
      body: 'https://example.com/a',
    });
    // Only an address: it stays the title, as the page's title is looked up for it
    expect(sharedDraft(link({ text: 'https://example.com/a' }))).toEqual({ title: 'https://example.com/a', body: undefined });
    expect(sharedDraft(link({ text: 'Headline\nhttps://example.com/a' }))).toEqual({ title: 'Headline', body: 'https://example.com/a' });
    // A subject from the sharing app wins, as before
    expect(sharedDraft(link({ title: 'Subject', text: 'Words https://example.com/a' }))).toEqual({
      title: 'Subject',
      body: 'Words https://example.com/a',
    });
  });

  it('opens quick add with the shared text, and files it with the notes', async () => {
    const { app } = await start(desktopVault);
    await runShortcut(link({ title: 'Read this #later', text: 'https://example.com/article' }));
    await settle();
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('Read this #later');
    // The smart title reads the shared text like typed text
    expect(find('title-hints-slot').text()).toContain('later');

    await submit('quick-add-input');
    const task = app.allTasks.find((t) => t.title === 'Read this')!;
    expect(task.tags).toEqual(['later']);
    expect(task.body).toContain('https://example.com/article');
  });

  it('starts over with new shared text while quick add is open', async () => {
    await start(desktopVault);
    await runShortcut(link({ text: 'First' }));
    await settle();
    await runShortcut(link({ text: 'Second' }));
    await settle();
    expect((find('quick-add-input').element as HTMLInputElement).value).toBe('Second');
  });

  it('says so when there is no project to save it in', async () => {
    await start();
    await runShortcut(link({ text: 'Lost?' }));
    await settle();
    expect(find('quick-add-input').exists()).toBe(false);
    expect(useUiStore().toast?.message).toContain('vault');
  });
});

describe('archived projects', () => {
  const vault = (f: MemoryFs) => {
    desktopVault(f);
    f.put('Jotter/home/index.md', '---\ntitle: Home\n---\n');
    f.put('Jotter/home/x.md', '---\ntitle: Water plants\nstatus: todo\nreminders: ["2999-01-01T09:00"]\n---\n');
    f.put('Jotter/work/a.md', '---\ntitle: Write report\nstatus: todo\nreminders: ["2999-02-01T09:00"]\n---\n');
  };
  const openManage = async () => {
    await find('open-projects').trigger('click');
    await settle();
    await find('project-switch-manage').trigger('click');
    await settle();
  };

  it('archives a project from the project list, keeps its files, and takes it back', async () => {
    memoryNotifications.state = 'granted';
    await start(vault);
    expect(memoryNotifications.armed.map((r) => r.taskId).sort()).toEqual(['a', 'x']);

    await openManage();
    const work = all('project-row').find((r) => r.text().includes('Work'))!;
    await work.find('[data-testid="project-archive"]').trigger('click');
    await settle();

    // The manifest says so, the tasks are untouched, and the project is out of the list
    expect(fs.files.get('Jotter/work/index.md')!.data).toContain('archived: true');
    expect(file('a')).toContain('status: todo');
    expect(all('project-row').map((r) => r.text())).toEqual([expect.stringContaining('Home')]);
    // Its reminder no longer notifies
    expect(memoryNotifications.armed.map((r) => r.taskId)).toEqual(['x']);

    await find('archived-toggle').trigger('click');
    expect(all('archived-row').map((r) => r.text())).toEqual([expect.stringContaining('Work')]);
    await find('project-restore').trigger('click');
    await settle();
    expect(fs.files.get('Jotter/work/index.md')!.data).not.toContain('archived');
    expect(all('project-row')).toHaveLength(2);
    expect(memoryNotifications.armed.map((r) => r.taskId).sort()).toEqual(['a', 'x']);
  });

  it('opens another project when the open one is archived, and offers an undo', async () => {
    await start(vault);
    expect(find('app-bar-title').text()).toBe('Home');
    await openManage();
    await all('project-row')[0]!.find('[data-testid="project-archive"]').trigger('click');
    await settle();
    expect(find('app-bar-title').text()).toBe('Work');

    await find('toast-action').trigger('click');
    await settle();
    expect(fs.files.get('Jotter/home/index.md')!.data).not.toContain('archived');
    // The project that was open is open again
    expect(find('app-bar-title').text()).toBe('Home');
  });

  it('does not offer an archived project, also when the vault says so from the start', async () => {
    await start((f) => {
      vault(f);
      f.put('Jotter/home/index.md', '---\ntitle: Home\narchived: true\n---\n');
    });
    expect(find('app-bar-title').text()).toBe('Work');
    await find('open-projects').trigger('click');
    await settle();
    expect(all('project-switch-row').map((r) => r.text())).toEqual(['Work']);
  });
});
