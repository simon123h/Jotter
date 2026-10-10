import { ref, shallowRef, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Task, Project, Bucket } from '@jotter/vault-format';
import { getRepository, applyTaskFilter, type VaultRepository, type Vault, type NewTask, type TaskFilter } from '@/data';
import { ensureStoragePermission } from '@/data/storagePermission';
import { capacitorKeyValue as preferences } from '@/data/keyValue';
import { t } from '@/i18n';
import { useUiStore } from '@/stores/ui';
import { PLANNED_CHOICES, plannedKey, plannedLabel } from '@/planned';

export type Status = 'loading' | 'onboarding' | 'ready' | 'error';

/** How the tabs group the tasks: by column of the board, by tag, or by planned date. */
export type View = 'board' | 'tags' | 'planning';
const VIEWS: View[] = ['board', 'tags', 'planning'];

export interface Column {
  key: string;
  title: string;
  /** The bucket name, or null for tasks whose bucket the project does not define (and in the other views). */
  bucket: string | null;
  /** The tag or the planned date the tab stands for ('' for Untagged and Unplanned). */
  value?: string;
  tasks: Task[];
}

const LAST_PROJECT_KEY = 'jotter_lite_last_project';
const VIEW_KEY = 'jotter_lite_view';
const HIDDEN_KEY = 'jotter_lite_hidden';

/** Which finished tasks a view leaves out. The tag and planning views list what is still to do, the board everything. */
export type Hidden = { done: boolean; archive: boolean };
const defaultHidden = (): Record<View, Hidden> => ({
  board: { done: false, archive: false },
  tags: { done: true, archive: true },
  planning: { done: true, archive: true },
});

const recallHidden = async (vaultId: string): Promise<Record<View, Hidden>> => {
  const hidden = defaultHidden();
  try {
    const stored = JSON.parse((await preferences.get(`${HIDDEN_KEY}:${vaultId}`)) ?? '{}');
    for (const v of VIEWS) {
      if (typeof stored?.[v]?.done === 'boolean') hidden[v].done = stored[v].done;
      if (typeof stored?.[v]?.archive === 'boolean') hidden[v].archive = stored[v].archive;
    }
  } catch {
    // Unreadable: the defaults apply
  }
  return hidden;
};

/** What the user last looked at is kept in the device's preferences (not in web storage, which Android may clear). */
const recallView = async (vaultId: string): Promise<View> => {
  try {
    const stored = await preferences.get(`${VIEW_KEY}:${vaultId}`);
    return VIEWS.find((v) => v === stored) ?? 'board';
  } catch {
    return 'board';
  }
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** The order in the tag and planning tabs: priority first, then the nearest due date, then the board position. */
const byUrgency = (a: Task, b: Task) =>
  (PRIORITY_RANK[a.priority ?? ''] ?? 4) - (PRIORITY_RANK[b.priority ?? ''] ?? 4) ||
  (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
  a.position - b.position;

const remember = (vaultId: string, projectId: string | null) => {
  // Not remembered when the preferences cannot be written; the first project is opened next time
  if (projectId) void preferences.set(`${LAST_PROJECT_KEY}:${vaultId}`, projectId).catch(() => undefined);
};
const recall = async (vaultId: string) => {
  try {
    return await preferences.get(`${LAST_PROJECT_KEY}:${vaultId}`);
  } catch {
    return null;
  }
};

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useAppStore = defineStore('app', () => {
  const repo = shallowRef<VaultRepository | null>(null);
  const status = ref<Status>('loading');
  const error = ref<string | null>(null);

  const vault = ref<Vault | null>(null);
  const vaults = ref<Vault[]>([]);
  const projects = ref<Project[]>([]);
  const projectId = ref<string | null>(null);
  const view = ref<View>('board');
  const hidden = ref<Record<View, Hidden>>(defaultHidden());
  const buckets = ref<Bucket[]>([]);
  const allTasks = ref<Task[]>([]);
  const filter = ref<{ search: string; priority: string; tag: string }>({ search: '', priority: '', tag: '' });
  const unreadable = ref<string[]>([]);
  /** The tasks ticked with their checkboxes. Bulk actions and swipes act on these. */
  const selection = ref<string[]>([]);

  const ui = useUiStore();
  /** The bottom navigation bar is out of the way while tasks are selected (the toolbar takes its place) or after scrolling down. */
  const navVisible = computed(() => selection.value.length === 0 && !ui.navHidden);

  const project = computed(() => projects.value.find((p) => p.id === projectId.value) ?? null);

  const taskFilter = computed<TaskFilter>(() => ({
    search: filter.value.search,
    priority: filter.value.priority || undefined,
    tags: filter.value.tag ? [filter.value.tag] : undefined,
  }));
  const isFiltering = computed(() => !!(filter.value.search || filter.value.priority || filter.value.tag));
  const visibleTasks = computed(() => applyTaskFilter(allTasks.value, taskFilter.value));
  const allTags = computed(() => [...new Set(allTasks.value.flatMap((t) => t.tags))].sort());

  const isHidden = (task: Task, v: View) =>
    (task.bucket === 'done' && hidden.value[v].done) || (task.bucket === 'archive' && hidden.value[v].archive);

  /** Tasks the tag and planning views list, most urgent first. */
  const openTasks = computed(() => {
    const v = view.value;
    return visibleTasks.value.filter((task) => !isHidden(task, v)).sort(byUrgency);
  });

  /** One column per bucket, plus one for tasks that name a bucket the project does not have. */
  const boardColumns = computed<Column[]>(() => {
    const known = new Set(buckets.value.map((b) => b.name));
    const cols: Column[] = buckets.value
      .filter((b) => !((b.name === 'done' && hidden.value.board.done) || (b.name === 'archive' && hidden.value.board.archive)))
      .map((b) => ({
        key: b.name,
        title: b.title,
        bucket: b.name,
        tasks: visibleTasks.value.filter((task) => task.bucket === b.name),
      }));
    const orphans = visibleTasks.value.filter((task) => !known.has(task.bucket));
    if (orphans.length) cols.push({ key: '__other', title: '', bucket: null, tasks: orphans });
    return cols;
  });

  /** One column per tag (a task with two tags is in both), then the tasks without tags. */
  const tagColumns = computed<Column[]>(() => {
    const tags = [...new Set(openTasks.value.flatMap((task) => task.tags))].sort();
    return [
      ...tags.map((tag) => ({
        key: `tag:${tag}`,
        title: `#${tag}`,
        bucket: null,
        value: tag,
        tasks: openTasks.value.filter((task) => task.tags.includes(tag)),
      })),
      { key: 'tag:', title: t('tags.untagged'), bucket: null, value: '', tasks: openTasks.value.filter((task) => !task.tags.length) },
    ];
  });

  /** One column per planned date the menu offers, the dates tasks carry besides those, then the unplanned tasks. */
  const planningColumns = computed<Column[]>(() => {
    const used = [...new Set(openTasks.value.map((task) => plannedKey(task.planned_date)).filter(Boolean))];
    const extra = used.filter((key) => !(PLANNED_CHOICES as readonly string[]).includes(key)).sort();
    return [
      ...[...PLANNED_CHOICES, ...extra].map((key) => ({
        key: `planned:${key}`,
        title: plannedLabel(key),
        bucket: null,
        value: key,
        tasks: openTasks.value.filter((task) => plannedKey(task.planned_date) === key),
      })),
      {
        key: 'planned:',
        title: t('planned.none'),
        bucket: null,
        value: '',
        tasks: openTasks.value.filter((task) => !task.planned_date?.trim()),
      },
    ];
  });

  const columns = computed<Column[]>(() =>
    view.value === 'tags' ? tagColumns.value : view.value === 'planning' ? planningColumns.value : boardColumns.value
  );

  function repository(): VaultRepository {
    if (!repo.value) throw new Error('Not initialised');
    return repo.value;
  }

  async function loadProject() {
    const r = repository();
    if (!projectId.value) {
      buckets.value = [];
      allTasks.value = [];
      return;
    }
    [buckets.value, allTasks.value] = await Promise.all([r.listBuckets(projectId.value), r.listTasks(projectId.value)]);
    // Tasks that are gone (deleted, moved away, removed by a sync tool) cannot stay selected
    const existing = new Set(allTasks.value.map((t) => t.id));
    if (selection.value.some((id) => !existing.has(id))) selection.value = selection.value.filter((id) => existing.has(id));
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
    const remembered = await recall(opened.id);
    projectId.value = projects.value.find((p) => p.id === remembered)?.id ?? projects.value[0]?.id ?? null;
    view.value = await recallView(opened.id);
    hidden.value = await recallHidden(opened.id);
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
    scanning = true;
    try {
      const result = await repository().sync();
      unreadable.value = result.unreadable;
      if (!result.changed && !options.force) return;
      projects.value = await repository().listProjects();
      if (!projects.value.some((p) => p.id === projectId.value)) projectId.value = projects.value[0]?.id ?? null;
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
    // Not remembered when the preferences cannot be written; the board opens next time
    if (vault.value) void preferences.set(`${VIEW_KEY}:${vault.value.id}`, next).catch(() => undefined);
  }

  /** Shows or hides the done or the archived tasks of the current view (on the board, their columns too). */
  function toggleHidden(which: keyof Hidden) {
    const current = hidden.value[view.value];
    current[which] = !current[which];
    selection.value = [];
    if (vault.value) {
      void preferences.set(`${HIDDEN_KEY}:${vault.value.id}`, JSON.stringify(hidden.value)).catch(() => undefined);
    }
  }

  async function selectProject(id: string) {
    projectId.value = id;
    if (vault.value) remember(vault.value.id, id);
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
    if (projectId.value === id) await selectProject(projects.value[0]?.id ?? '');
    if (!projects.value.length) projectId.value = null;
  }

  // ---------- tasks ----------

  function requireProject(): string {
    if (!projectId.value) throw new Error('No project is open');
    return projectId.value;
  }

  async function addTask(input: NewTask) {
    const task = await repository().createTask(requireProject(), input);
    await loadProject();
    return task;
  }

  async function saveTask(id: string, updates: Partial<Task>) {
    await repository().updateTask(requireProject(), id, updates);
    await loadProject();
  }

  /** Moves a task to a bucket, to the end of it unless a position is given. */
  async function moveTask(id: string, bucket: string, position?: number) {
    const inBucket = allTasks.value.filter((t) => t.bucket === bucket && t.id !== id);
    const target = position ?? Math.max(0, ...inBucket.map((t) => t.position)) + 1000;
    await repository().moveTask(requireProject(), id, bucket, target);
    await loadProject();
  }

  /** Where a task was, so that moving it can be undone. */
  interface Placement {
    id: string;
    bucket: string;
    position: number;
  }

  /**
   * Moves tasks to the end of a bucket, keeping their order, the way the desktop does for Done and Archive. With a
   * `title`, a project without that bucket gets it first, so a task never ends up in a bucket nothing shows. Tasks
   * already there stay put. Returns where the moved tasks were, for an undo.
   */
  async function moveManyToBucket(ids: string[], bucket: string, title?: string): Promise<Placement[]> {
    const r = repository();
    const project = requireProject();
    if (title && !buckets.value.some((b) => b.name === bucket)) {
      await r.createBucket(project, { title });
      await loadProject();
    }
    const moving = ids
      .map(taskById)
      .filter((t): t is Task => !!t && t.bucket !== bucket)
      .sort((a, b) => a.position - b.position);
    let next = Math.max(0, ...allTasks.value.filter((t) => t.bucket === bucket).map((t) => t.position)) + 1000;
    const before: Placement[] = [];
    for (const task of moving) {
      before.push({ id: task.id, bucket: task.bucket, position: task.position });
      await r.moveTask(project, task.id, bucket, next);
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
    for (const p of placements) await repository().moveTask(requireProject(), p.id, p.bucket, p.position);
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
      await repository().updateTask(requireProject(), id, updates);
    }
    await loadProject();
    return before;
  }

  async function restoreFields(before: Array<{ id: string; previous: Partial<Task> }>) {
    for (const { id, previous } of before) await repository().updateTask(requireProject(), id, previous);
    await loadProject();
  }

  async function moveManyToProject(ids: string[], targetProjectId: string) {
    for (const id of ids) await repository().moveToProject(requireProject(), id, targetProjectId);
    await loadProject();
  }

  async function removeMany(ids: string[]) {
    for (const id of ids) await repository().deleteTask(requireProject(), id);
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
    await repository().deleteTask(requireProject(), id);
    await loadProject();
  }

  async function addAttachment(id: string, file: File) {
    await repository().addAttachment(requireProject(), id, file);
    await loadProject();
  }

  async function removeAttachment(id: string, name: string) {
    await repository().removeAttachment(requireProject(), id, name);
    await loadProject();
  }

  function attachmentUrl(id: string, name: string) {
    return repository().attachmentUrl(requireProject(), id, name);
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
    filter.value = { search: '', priority: '', tag: '' };
  }

  return {
    status,
    error,
    vault,
    vaults,
    projects,
    projectId,
    view,
    hidden,
    toggleHidden,
    setView,
    navVisible,
    project,
    buckets,
    allTasks,
    filter,
    isFiltering,
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
