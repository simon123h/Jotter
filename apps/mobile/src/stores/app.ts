import { ref, shallowRef, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Task, Project, Bucket } from '@jotter/vault-format';
import {
  compareTitles,
  exampleViews,
  filterTasks,
  isBeyond,
  isEmptyFilter,
  newViewId,
  parseQuery,
  today,
  HORIZONS,
  type Horizon,
  type SavedView,
} from '@jotter/task-filter';
import { t } from '@/i18n';
import { getRepository, type VaultRepository, type Vault, type NewTask } from '@/data';
import { ensureStoragePermission } from '@/data/storagePermission';
import { armDelay, armReminders, localDateTime } from '@/reminders';
import { useUiStore } from '@/stores/ui';
import { columnsFor, isHiddenIn, type Column, type Hidden, type View } from '@/stores/columns';
import {
  defaultHidden,
  recallCollapsed,
  recallHidden,
  recallLayout,
  recallPinned,
  recallProject,
  recallView,
  rememberCollapsed,
  rememberHidden,
  rememberLayout,
  rememberProject,
  rememberView,
  type Layout,
} from '@/stores/preferences';

export type Status = 'loading' | 'onboarding' | 'ready' | 'error';

export type { View, Hidden, Column } from '@/stores/columns';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useAppStore = defineStore('app', () => {
  const repo = shallowRef<VaultRepository | null>(null);
  const status = ref<Status>('loading');
  const error = ref<string | null>(null);

  const vault = ref<Vault | null>(null);
  const vaults = ref<Vault[]>([]);
  const projects = ref<Project[]>([]);
  const projectId = ref<string | null>(null);
  /** The projects pinned to the top of the lists, the order of the others and how they are sorted. These are the vault's settings.json, as on the desktop. */
  const pinned = ref<string[]>([]);
  const projectOrder = ref<string[]>([]);
  const sortBy = ref<'alpha' | 'manual'>('alpha');
  /** The project that shared text and the new-task shortcut go to. Null: the project that is open. Kept in the vault's settings.json, shared with the desktop. */
  const captureProjectId = ref<string | null>(null);
  const view = ref<View>('board');
  /** The saved searches of the vault (settings.json, shared with the desktop). */
  const views = ref<SavedView[]>([]);
  /** The saved view in sight: its tasks come from all projects. Null: the project that is open. */
  const savedViewId = ref<string | null>(null);
  const activeView = computed(() => views.value.find((v) => v.id === savedViewId.value) ?? null);
  const scoped = computed(() => savedViewId.value !== null);
  const hidden = ref<Record<View, Hidden>>(defaultHidden());
  /** How far ahead the board and the tags look, from the vault's settings.json (shared with the desktop). The planning view looks ahead anyway. */
  const planningHorizon = ref<Horizon>('today');
  const horizonOf = (v: View): Horizon => (v === 'planning' ? 'all' : planningHorizon.value);
  /** What the views hide: the finished tasks of `hidden`, and those planned beyond the horizon. */
  const hiding = computed<Record<View, Hidden>>(() => {
    // A search that names a column (bucket:done) shows its tasks even though the view hides finished ones
    const named = (parsedFilter.value.buckets ?? '').toLowerCase().split(',');
    const of = (v: View): Hidden => ({
      ...hidden.value[v],
      done: hidden.value[v].done && !named.includes('done'),
      archive: hidden.value[v].archive && !named.includes('archive'),
      horizon: horizonOf(v),
    });
    return { board: of('board'), tags: of('tags'), planning: of('planning') };
  });
  /** The horizon of the view in sight. */
  const horizon = computed(() => horizonOf(view.value));
  const layout = ref<Layout>('tabs');
  const collapsed = ref<Record<string, boolean>>({});
  const buckets = ref<Bucket[]>([]);
  const allTasks = ref<Task[]>([]);
  const unreadable = ref<string[]>([]);
  /** The tasks ticked with their checkboxes. Bulk actions and swipes act on these. */
  const selection = ref<string[]>([]);

  const ui = useUiStore();
  /** The bottom navigation bar is out of the way while tasks are selected (the toolbar takes its place) or after scrolling down. */
  const navVisible = computed(() => selection.value.length === 0 && !ui.navHidden);

  const project = computed(() => projects.value.find((p) => p.id === projectId.value) ?? null);
  /** The project to open when the remembered one is gone or put away. */
  const firstProject = () => projects.value.find((p) => !p.archived)?.id ?? null;
  /** The projects that are put away (spec/FORMAT.md, *Project manifest*), apart from the ones in use. */
  const archivedProjects = computed(() => projects.value.filter((p) => p.archived));
  /** The projects as the lists show them: the pinned ones first, each group in the chosen order. */
  const orderedProjects = computed(() => {
    const index = (id: string) => projectOrder.value.indexOf(id);
    const inOrder = (a: Project, b: Project) => {
      if (sortBy.value === 'manual' && (index(a.id) >= 0 || index(b.id) >= 0)) {
        return (index(a.id) < 0 ? Infinity : index(a.id)) - (index(b.id) < 0 ? Infinity : index(b.id));
      }
      return compareTitles(a.title, b.title);
    };
    const sorted = projects.value.filter((p) => !p.archived).sort(inOrder);
    return [...sorted.filter((p) => pinned.value.includes(p.id)), ...sorted.filter((p) => !pinned.value.includes(p.id))];
  });

  /** The search field's text, in the query language of packages/task-filter. */
  const query = ref('');
  const parsedFilter = computed(() => parseQuery(query.value));
  const isFiltering = computed(() => !isEmptyFilter(parsedFilter.value));
  const visibleTasks = computed(() => {
    let list = allTasks.value;
    // The search matches tasks, not projects: across all of them, `project:` narrows the tasks here
    const wanted = (scoped.value && parsedFilter.value.project ? parsedFilter.value.project : '').toLowerCase();
    if (wanted) {
      const titles = new Map(projects.value.map((p) => [p.id, p.title.toLowerCase()]));
      list = list.filter((task) => task.project_id.toLowerCase() === wanted || (titles.get(task.project_id) ?? '').includes(wanted));
    }
    return filterTasks(list, { ...parsedFilter.value, project: undefined });
  });
  const allTags = computed(() => [...new Set(allTasks.value.flatMap((t) => t.tags))].sort());

  /** A query that names planned dates (`planned:2026-11`) is not cut by the horizon: whoever asks about planning wants the answer. */
  const horizonApplies = computed(
    () => !(parsedFilter.value.planned_date || parsedFilter.value.planned_before || parsedFilter.value.planned_after)
  );

  /** The columns of the current view. */
  const columns = computed<Column[]>(() => {
    // A saved view without a grouping is one list
    if (scoped.value && !parsedFilter.value.group) {
      const shown = visibleTasks.value.filter((task) => !isHiddenIn(task, hiding.value.board, horizonApplies.value));
      return [{ key: '__results', title: activeView.value?.name ?? '', bucket: null, tasks: shown }];
    }
    const found = columnsFor(view.value, buckets.value, visibleTasks.value, hiding.value, horizonApplies.value, !!parsedFilter.value.sort);
    // The projects of a view have columns of their own: a column of the board stands for no bucket to move tasks to
    return scoped.value ? found.map((column) => ({ ...column, bucket: null })) : found;
  });

  /** How many tasks the view leaves out because they are planned beyond its horizon (not the finished ones it hides anyway). */
  const beyondCount = computed(() => {
    if (!horizonApplies.value) return 0; // a query that names planned dates is not cut by the horizon
    const h = hiding.value[view.value];
    const day = today();
    return allTasks.value.filter((task) => isBeyond(task.planned_date, h.horizon, day) && !isHiddenIn(task, { ...h, horizon: 'all' }))
      .length;
  });

  /** What a search found beyond the horizon of the view: the columns leave it out, and the strip under the app bar says so. */
  const beyondFound = computed(() => {
    if (!isFiltering.value || !horizonApplies.value) return 0;
    const h = hiding.value[view.value];
    const day = today();
    return visibleTasks.value.filter((task) => isBeyond(task.planned_date, h.horizon, day) && !isHiddenIn(task, { ...h, horizon: 'all' }))
      .length;
  });

  function repository(): VaultRepository {
    if (!repo.value) throw new Error('Not initialised');
    return repo.value;
  }

  /** Arms the reminders that are still to come, a moment after the vault was last read. */
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  function armRemindersSoon() {
    clearTimeout(armTimer);
    armTimer = setTimeout(
      () => void armReminders(() => repository().upcomingReminders(localDateTime(new Date(Date.now() + 60_000)))),
      armDelay.ms
    );
  }

  async function loadProject() {
    const r = repository();
    armRemindersSoon();
    if (savedViewId.value !== null) {
      // A saved view: the tasks of all projects, each with an id that names its project (two projects can have the same file name)
      const open = projects.value.filter((p) => !p.archived).map((p) => p.id);
      const [tasks, lists] = await Promise.all([r.listTasks(null), Promise.all(open.map((id) => r.listBuckets(id)))]);
      allTasks.value = tasks
        .filter((task) => open.includes(task.project_id))
        .map((task) => ({ ...task, id: `${task.project_id}/${task.id}` }));
      const byName = new Map<string, Bucket>();
      for (const bucket of lists.flat()) if (!byName.has(bucket.name)) byName.set(bucket.name, bucket);
      buckets.value = [...byName.values()];
    } else if (!projectId.value) {
      buckets.value = [];
      allTasks.value = [];
      return;
    } else {
      [buckets.value, allTasks.value] = await Promise.all([r.listBuckets(projectId.value), r.listTasks(projectId.value)]);
    }
    // Tasks that are gone (deleted, moved away, removed by a sync tool) cannot stay selected
    const existing = new Set(allTasks.value.map((t) => t.id));
    if (selection.value.some((id) => !existing.has(id))) selection.value = selection.value.filter((id) => existing.has(id));
  }

  const idList = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);

  /** Reads the pins and the project order from the vault. Pins kept on the device by an older version are moved over once. */
  async function loadSettings(migrate = false) {
    const settings = await repository().readSettings();
    const next = {
      pinned: idList(settings.pinnedProjectIds),
      order: idList(settings.projectOrder),
      sort: settings.sortBy === 'manual' ? ('manual' as const) : ('alpha' as const),
    };
    if (migrate && vault.value && !('pinnedProjectIds' in settings)) {
      next.pinned = await recallPinned(vault.value.id);
      if (next.pinned.length) saveSettings({ pinnedProjectIds: next.pinned });
    }
    // Only assigned when different: the periodic scan must not redraw the lists for nothing
    if (JSON.stringify(next.pinned) !== JSON.stringify(pinned.value)) pinned.value = next.pinned;
    if (JSON.stringify(next.order) !== JSON.stringify(projectOrder.value)) projectOrder.value = next.order;
    sortBy.value = next.sort;
    const horizonSetting = HORIZONS.find((h) => h === settings.planningHorizon) ?? 'today';
    if (horizonSetting !== planningHorizon.value) planningHorizon.value = horizonSetting;
    const capture = typeof settings.captureProjectId === 'string' && settings.captureProjectId ? settings.captureProjectId : null;
    if (capture !== captureProjectId.value) captureProjectId.value = capture;

    if (Array.isArray(settings.views)) {
      const list = settings.views.filter(isSavedView);
      if (JSON.stringify(list) !== JSON.stringify(views.value)) views.value = list;
    } else if (vault.value) {
      // Never set: the example views are offered once, in the language of the app
      views.value = exampleViews({ upcoming: t('views.upcoming'), recent: t('views.recent') });
      saveSettings({ views: views.value });
    }
  }

  const isSavedView = (v: unknown): v is SavedView =>
    !!v && typeof v === 'object' && ['id', 'name', 'query'].every((k) => typeof (v as Record<string, unknown>)[k] === 'string');

  /** Not kept when the file cannot be written; the lists look right until the next scan. */
  function saveSettings(patch: Record<string, unknown>) {
    void repository()
      .updateSettings(patch)
      .catch(() => undefined);
  }

  async function afterOpen(opened: Vault | null) {
    const r = repository();
    vault.value = opened;
    vaults.value = await r.listVaults();
    if (!opened) {
      status.value = 'onboarding';
      return;
    }
    projects.value = await r.listProjects();
    const remembered = await recallProject(opened.id);
    projectId.value = projects.value.find((p) => p.id === remembered && !p.archived)?.id ?? firstProject();
    view.value = await recallView(opened.id);
    hidden.value = await recallHidden(opened.id);
    layout.value = await recallLayout();
    collapsed.value = await recallCollapsed(opened.id);
    await loadSettings(true);
    await loadProject();
    status.value = 'ready';
  }

  /** Opens the active vault. Pass a repository to use something other than the device storage (tests). */
  async function init(injected?: VaultRepository) {
    status.value = 'loading';
    error.value = null;
    try {
      if (!injected && !(await ensureStoragePermission())) throw new Error('storage');
      repo.value = injected ?? (await getRepository());
      await afterOpen(await repo.value.open());
    } catch (err) {
      error.value = message(err);
      status.value = 'error';
    }
  }

  /** Picks up changes made outside the app (a sync tool, the desktop app). */
  let scanning = false;

  /**
   * Picks up changes made outside the app (a sync tool, the desktop app). Scans never overlap. The lists are only
   * redrawn when the scan found something, unless `force` is set (the Rescan button).
   */
  async function refresh(options: { force?: boolean } = {}) {
    if (status.value !== 'ready' || scanning) return;
    // Also when nothing changed: arming that failed or was cut short is repeated here
    armRemindersSoon();
    scanning = true;
    try {
      const result = await repository().sync();
      unreadable.value = result.unreadable;
      await loadSettings();
      if (!result.changed && !options.force) return;
      projects.value = await repository().listProjects();
      if (!projects.value.some((p) => p.id === projectId.value && !p.archived)) projectId.value = firstProject();
      await loadProject();
    } finally {
      scanning = false;
    }
  }

  // ---------- vaults ----------

  async function addVault(input: { name: string; path: string; create?: boolean }) {
    const r = repository();
    const hadVault = vault.value !== null;
    await r.addVault(input);
    // The first vault opens by itself; later ones only join the list
    if (hadVault) vaults.value = await r.listVaults();
    else await afterOpen(await r.activeVault());
  }

  async function switchVault(id: string) {
    const opened = await repository().switchVault(id);
    resetFilter();
    selection.value = [];
    await afterOpen(opened);
  }

  async function renameVault(id: string, name: string) {
    await repository().renameVault(id, name);
    vaults.value = await repository().listVaults();
  }

  async function removeVault(id: string) {
    const r = repository();
    await r.removeVault(id);
    await afterOpen(await r.activeVault());
  }

  // ---------- projects ----------

  function setView(next: View) {
    view.value = next;
    selection.value = [];
    if (vault.value) rememberView(vault.value.id, next);
  }

  /** Shows or hides the done or the archived tasks of the current view (on the board, their columns too). */
  function toggleHidden(which: 'done' | 'archive') {
    const current = hidden.value[view.value];
    current[which] = !current[which];
    selection.value = [];
    if (vault.value) rememberHidden(vault.value.id, hidden.value);
  }

  /** How far ahead the board and the tags show planned tasks; those planned further out are left out. Shared with the desktop. */
  function setHorizon(next: Horizon) {
    planningHorizon.value = next;
    selection.value = [];
    saveSettings({ planningHorizon: next });
  }

  /** Shows the columns as tabs or as one list with a section for each. */
  function setLayout(next: Layout) {
    layout.value = next;
    selection.value = [];
    rememberLayout(next);
  }

  /** Whether a section of the list layout is folded away. The finished columns start folded; empty ones and the hits of a search never are. */
  function isCollapsed(column: Column): boolean {
    if (!column.tasks.length || isFiltering.value) return false;
    return collapsed.value[column.key] ?? (view.value === 'board' && (column.key === 'done' || column.key === 'archive'));
  }

  function toggleCollapsed(column: Column) {
    collapsed.value = { ...collapsed.value, [column.key]: !isCollapsed(column) };
    if (vault.value) rememberCollapsed(vault.value.id, collapsed.value);
  }

  function togglePinned(id: string) {
    pinned.value = pinned.value.includes(id) ? pinned.value.filter((p) => p !== id) : [...pinned.value, id];
    saveSettings({ pinnedProjectIds: pinned.value });
  }

  /** Moves a project one place up or down within its group (pinned or not), and keeps that order. */
  function moveProject(id: string, direction: -1 | 1) {
    const list = orderedProjects.value;
    const i = list.findIndex((p) => p.id === id);
    const other = list[i + direction];
    if (i < 0 || !other || pinned.value.includes(id) !== pinned.value.includes(other.id)) return;
    const ids = list.map((p) => p.id);
    [ids[i], ids[i + direction]] = [ids[i + direction]!, ids[i]!];
    projectOrder.value = ids;
    sortBy.value = 'manual';
    saveSettings({ projectOrder: ids, sortBy: 'manual' });
  }

  function setSortBy(sort: 'alpha' | 'manual') {
    sortBy.value = sort;
    saveSettings({ sortBy: sort });
  }

  function setCaptureProject(id: string | null) {
    captureProjectId.value = id;
    saveSettings({ captureProjectId: id });
  }

  /** The project for what comes from outside: the one chosen for quick capture, unless it is gone. */
  const captureProject = computed(() => projects.value.find((p) => p.id === captureProjectId.value) ?? null);

  async function selectProject(id: string) {
    savedViewId.value = null;
    projectId.value = id;
    if (vault.value) rememberProject(vault.value.id, id);
    resetFilter();
    selection.value = [];
    await loadProject();
  }

  async function addProject(title: string) {
    const created = await repository().createProject(title);
    projects.value = await repository().listProjects();
    await selectProject(created.id);
  }

  async function renameProject(id: string, title: string) {
    await repository().updateProject(id, { title });
    projects.value = await repository().listProjects();
  }

  async function removeProject(id: string) {
    await repository().deleteProject(id);
    projects.value = await repository().listProjects();
    if (projectId.value === id) await selectProject(firstProject() ?? '');
    if (!firstProject()) projectId.value = null;
  }

  /** Puts a project away, or takes it back. Its reminders stop or come back with it. */
  async function setProjectArchived(id: string, archived: boolean) {
    await repository().updateProject(id, { archived });
    projects.value = await repository().listProjects();
    if (archived && projectId.value === id) {
      const next = firstProject();
      if (next) await selectProject(next);
      else {
        projectId.value = null;
        await loadProject();
      }
    } else {
      armRemindersSoon();
    }
  }

  // ---------- saved views ----------

  const viewOfGroup = { planned: 'planning', tag: 'tags', bucket: 'board' } as const;

  /** Opens a saved view: the tasks of all projects that its search finds, laid out as its grouping says. */
  async function openView(id: string) {
    const found = views.value.find((v) => v.id === id);
    if (!found) return;
    savedViewId.value = id;
    selection.value = [];
    const group = parseQuery(found.query).group;
    view.value = group ? viewOfGroup[group] : 'board';
    resetFilter();
    await loadProject();
  }

  function saveViews(next: SavedView[]) {
    views.value = next;
    saveSettings({ views: next });
  }

  function addView(name: string, search: string): SavedView {
    const created = { id: newViewId(name, views.value), name: name.trim(), query: search.trim() };
    saveViews([...views.value, created]);
    return created;
  }

  async function updateView(id: string, changes: Partial<Pick<SavedView, 'name' | 'query'>>) {
    saveViews(views.value.map((v) => (v.id === id ? { ...v, ...changes } : v)));
    if (savedViewId.value === id) await openView(id);
  }

  async function removeView(id: string) {
    saveViews(views.value.filter((v) => v.id !== id));
    if (savedViewId.value === id) await selectProject(projectId.value ?? firstProject() ?? '');
  }

  // ---------- tasks ----------

  function requireProject(): string {
    if (!projectId.value) throw new Error('No project is open');
    return projectId.value;
  }

  /** The project and file name of a task. In a saved view the id names both (`project/file`). */
  function locate(id: string): { project: string; id: string } {
    if (!scoped.value) return { project: requireProject(), id };
    const slash = id.indexOf('/');
    return { project: id.slice(0, slash), id: id.slice(slash + 1) };
  }

  /** Where a new task goes from a saved view: the project its search names, else the one for quick capture, else the first. */
  function projectForNewTask(): string {
    const named = (parsedFilter.value.project ?? '').toLowerCase();
    const open = projects.value.filter((p) => !p.archived);
    const matches = named ? open.filter((p) => p.id.toLowerCase() === named || p.title.toLowerCase().includes(named)) : [];
    return (matches.length === 1 ? matches[0]!.id : captureProject.value?.id) ?? projectId.value ?? firstProject() ?? requireProject();
  }

  async function addTask(input: NewTask) {
    const project = scoped.value ? projectForNewTask() : requireProject();
    const task = await repository().createTask(project, input);
    await loadProject();
    return scoped.value ? { ...task, id: `${task.project_id}/${task.id}` } : task;
  }

  async function saveTask(id: string, updates: Partial<Task>) {
    const at = locate(id);
    await repository().updateTask(at.project, at.id, updates);
    await loadProject();
  }

  /** Moves a task to a bucket, to the end of it unless a position is given. */
  async function moveTask(id: string, bucket: string, position?: number) {
    const inBucket = allTasks.value.filter((t) => t.bucket === bucket && t.id !== id);
    const target = position ?? Math.max(0, ...inBucket.map((t) => t.position)) + 1000;
    const at = locate(id);
    await repository().moveTask(at.project, at.id, bucket, target);
    await loadProject();
  }

  /** Where a task was, so that moving it can be undone. */
  interface Placement {
    id: string;
    bucket: string;
    position: number;
    /** The fields a recurring task's roll-over changed, when completing it did that. */
    rolled?: Partial<Task>;
  }

  /**
   * Moves tasks to the end of a bucket, keeping their order, the way the desktop does for Done and Archive. With a
   * `title`, a project without that bucket gets it first, so a task never ends up in a bucket nothing shows. Tasks
   * already there stay put. Returns where the moved tasks were, for an undo.
   */
  async function moveManyToBucket(ids: string[], bucket: string, title?: string): Promise<Placement[]> {
    const r = repository();
    if (title && !scoped.value && !buckets.value.some((b) => b.name === bucket)) {
      await r.createBucket(requireProject(), { title });
      await loadProject();
    }
    const moving = ids
      .map(taskById)
      .filter((t): t is Task => !!t && t.bucket !== bucket)
      .sort((a, b) => a.position - b.position);
    let next = Math.max(0, ...allTasks.value.filter((t) => t.bucket === bucket).map((t) => t.position)) + 1000;
    const before: Placement[] = [];
    for (const task of moving) {
      const rolled = task.repeat && bucket === 'done' && task.bucket !== 'done';
      before.push({
        id: task.id,
        bucket: task.bucket,
        position: task.position,
        ...(rolled
          ? {
              rolled: {
                due_date: task.due_date,
                planned_date: task.planned_date,
                // A plain copy: the task is a reactive object, which IndexedDB cannot store
                reminders: task.reminders ? [...task.reminders] : undefined,
                body: task.body,
              },
            }
          : {}),
      });
      const at = locate(task.id);
      await r.moveTask(at.project, at.id, bucket, next);
      next += 1000;
    }
    await loadProject();
    return before;
  }

  /** Adds a column at the end of the board. */
  async function addColumn(title: string) {
    await repository().createBucket(requireProject(), { title });
    await loadProject();
  }

  /** Changes only the title: tasks refer to a column by its name, which stays. */
  async function renameColumn(name: string, title: string) {
    if (!title.trim()) return;
    await repository().updateBucket(requireProject(), name, { title: title.trim() });
    await loadProject();
  }

  /** Swaps a column with its neighbour. */
  async function moveColumn(name: string, direction: -1 | 1) {
    const list = buckets.value;
    const i = list.findIndex((b) => b.name === name);
    const other = list[i + direction];
    if (i < 0 || !other) return;
    const r = repository();
    const project = requireProject();
    await r.updateBucket(project, name, { position: other.position });
    await r.updateBucket(project, other.name, { position: list[i]!.position });
    await loadProject();
  }

  /** Refused while tasks are in the column, and for the default column, where new and reopened tasks go. */
  async function removeColumn(name: string) {
    if (buckets.value.find((b) => b.name === name)?.is_default) throw new Error('The default column cannot be deleted');
    await repository().deleteBucket(requireProject(), name);
    await loadProject();
  }

  /** Puts tasks back where they were. */
  async function restoreMany(placements: Placement[]) {
    for (const p of placements) {
      const task = taskById(p.id);
      const at = locate(p.id);
      if (p.rolled) {
        await repository().updateTask(at.project, at.id, p.rolled);
        continue;
      }
      if (task && (task.bucket !== p.bucket || task.position !== p.position)) {
        await repository().moveTask(at.project, at.id, p.bucket, p.position);
      }
    }
    await loadProject();
  }

  /**
   * Changes fields of several tasks and redraws once. Returns the old values of the fields that changed, to undo
   * it with `restoreFields`.
   */
  async function editMany(ids: string[], changes: (task: Task) => Partial<Task>): Promise<Array<{ id: string; previous: Partial<Task> }>> {
    const before: Array<{ id: string; previous: Partial<Task> }> = [];
    for (const id of ids) {
      const task = taskById(id);
      if (!task) continue;
      const updates = changes(task);
      before.push({ id, previous: Object.fromEntries(Object.keys(updates).map((key) => [key, task[key as keyof Task]])) as Partial<Task> });
      const at = locate(id);
      await repository().updateTask(at.project, at.id, updates);
    }
    await loadProject();
    return before;
  }

  async function restoreFields(before: Array<{ id: string; previous: Partial<Task> }>) {
    for (const { id, previous } of before) {
      const at = locate(id);
      await repository().updateTask(at.project, at.id, previous);
    }
    await loadProject();
  }

  async function moveManyToProject(ids: string[], targetProjectId: string) {
    for (const id of ids) {
      const at = locate(id);
      await repository().moveToProject(at.project, at.id, targetProjectId);
    }
    await loadProject();
  }

  async function removeMany(ids: string[]) {
    for (const id of ids) {
      const at = locate(id);
      await repository().deleteTask(at.project, at.id);
    }
    await loadProject();
  }

  // ---------- selection ----------

  const selectedCount = computed(() => selection.value.length);
  const isSelected = (id: string) => selection.value.includes(id);
  function toggleSelected(id: string) {
    selection.value = isSelected(id) ? selection.value.filter((s) => s !== id) : [...selection.value, id];
  }
  function selectOnly(ids: string[]) {
    selection.value = [...new Set(ids)];
  }
  function clearSelection() {
    selection.value = [];
  }
  /** Unticks tasks an action has dealt with; the others stay selected. */
  function deselect(ids: string[]) {
    selection.value = selection.value.filter((id) => !ids.includes(id));
  }

  async function removeTask(id: string) {
    const at = locate(id);
    await repository().deleteTask(at.project, at.id);
    await loadProject();
  }

  async function addAttachment(id: string, file: File) {
    const at = locate(id);
    await repository().addAttachment(at.project, at.id, file);
    await loadProject();
  }

  async function removeAttachment(id: string, name: string) {
    const at = locate(id);
    await repository().removeAttachment(at.project, at.id, name);
    await loadProject();
  }

  function attachmentUrl(id: string, name: string) {
    const at = locate(id);
    return repository().attachmentUrl(at.project, at.id, name);
  }

  /** Positions of the tasks in a bucket, in order, optionally without one task. */
  function positionsIn(bucket: string, excludeId?: string): number[] {
    return allTasks.value
      .filter((t) => t.bucket === bucket && t.id !== excludeId)
      .map((t) => t.position)
      .sort((a, b) => a - b);
  }

  function taskById(id: string): Task | undefined {
    return allTasks.value.find((t) => t.id === id);
  }

  function resetFilter() {
    // In a saved view the search is the view's own
    query.value = activeView.value?.query ?? '';
  }

  return {
    status,
    error,
    vault,
    vaults,
    projects,
    archivedProjects,
    setProjectArchived,
    pinned,
    orderedProjects,
    togglePinned,
    projectOrder,
    sortBy,
    moveProject,
    setSortBy,
    projectId,
    view,
    views,
    activeView,
    savedViewId,
    scoped,
    openView,
    addView,
    updateView,
    removeView,
    hidden,
    layout,
    setLayout,
    isCollapsed,
    toggleCollapsed,
    toggleHidden,
    horizon,
    setHorizon,
    setView,
    navVisible,
    project,
    buckets,
    allTasks,
    query,
    parsedFilter,
    isFiltering,
    beyondFound,
    beyondCount,
    allTags,
    columns,
    unreadable,
    init,
    refresh,
    addVault,
    switchVault,
    renameVault,
    removeVault,
    selectProject,
    captureProjectId,
    captureProject,
    setCaptureProject,
    addProject,
    renameProject,
    removeProject,
    addTask,
    saveTask,
    moveTask,
    moveManyToBucket,
    addColumn,
    renameColumn,
    moveColumn,
    removeColumn,
    restoreMany,
    editMany,
    restoreFields,
    moveManyToProject,
    removeMany,
    selection,
    selectedCount,
    isSelected,
    toggleSelected,
    selectOnly,
    clearSelection,
    deselect,
    removeTask,
    addAttachment,
    removeAttachment,
    attachmentUrl,
    taskById,
    positionsIn,
    resetFilter,
  };
});
