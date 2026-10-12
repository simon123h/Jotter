import { ref, shallowRef, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Task, Project, Bucket } from '@jotter/vault-format';
import { filterTasks, isEmptyFilter, parseQuery } from '@jotter/task-filter';
import { getRepository, type VaultRepository, type Vault, type NewTask } from '@/data';
import { ensureStoragePermission } from '@/data/storagePermission';
import { isoDay, isPostponed } from '@/dates';
import { armDelay, armReminders, localDateTime } from '@/reminders';
import { useUiStore } from '@/stores/ui';
import { columnsFor, type Hidden, type View } from '@/stores/columns';
import {
  defaultHidden,
  recallHidden,
  recallPinned,
  recallProject,
  recallView,
  rememberHidden,
  rememberProject,
  rememberView,
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
  const view = ref<View>('board');
  const hidden = ref<Record<View, Hidden>>(defaultHidden());
  const buckets = ref<Bucket[]>([]);
  const allTasks = ref<Task[]>([]);
  const unreadable = ref<string[]>([]);
  /** The tasks ticked with their checkboxes. Bulk actions and swipes act on these. */
  const selection = ref<string[]>([]);

  const ui = useUiStore();
  /** The bottom navigation bar is out of the way while tasks are selected (the toolbar takes its place) or after scrolling down. */
  const navVisible = computed(() => selection.value.length === 0 && !ui.navHidden);

  const project = computed(() => projects.value.find((p) => p.id === projectId.value) ?? null);
  /** The projects as the lists show them: the pinned ones first, each group in the chosen order. */
  const orderedProjects = computed(() => {
    const index = (id: string) => projectOrder.value.indexOf(id);
    const inOrder = (a: Project, b: Project) => {
      if (sortBy.value === 'manual' && (index(a.id) >= 0 || index(b.id) >= 0)) {
        return (index(a.id) < 0 ? Infinity : index(a.id)) - (index(b.id) < 0 ? Infinity : index(b.id));
      }
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    };
    const sorted = [...projects.value].sort(inOrder);
    return [...sorted.filter((p) => pinned.value.includes(p.id)), ...sorted.filter((p) => !pinned.value.includes(p.id))];
  });

  /** The search field's text, in the query language of packages/task-filter. */
  const query = ref('');
  const parsedFilter = computed(() => parseQuery(query.value));
  const isFiltering = computed(() => !isEmptyFilter(parsedFilter.value));
  const visibleTasks = computed(() => filterTasks(allTasks.value, parsedFilter.value));
  const allTags = computed(() => [...new Set(allTasks.value.flatMap((t) => t.tags))].sort());

  /** The Postponed column is virtual when the project has no column of that name. */
  const isVirtualPostponed = (bucket: string) => bucket === 'postponed' && !buckets.value.some((b) => b.name === 'postponed');

  /** The columns of the current view. */
  const columns = computed(() => columnsFor(view.value, buckets.value, visibleTasks.value, hidden.value));

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
  }

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
    projectId.value = projects.value.find((p) => p.id === remembered)?.id ?? projects.value[0]?.id ?? null;
    view.value = await recallView(opened.id);
    hidden.value = await recallHidden(opened.id);
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
    if (vault.value) rememberView(vault.value.id, next);
  }

  /** Shows or hides the done or the archived tasks of the current view (on the board, their columns too). */
  function toggleHidden(which: keyof Hidden) {
    const current = hidden.value[view.value];
    current[which] = !current[which];
    selection.value = [];
    if (vault.value) rememberHidden(vault.value.id, hidden.value);
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

  async function selectProject(id: string) {
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

  /** Moves a task to a bucket, to the end of it unless a position is given. The virtual Postponed column postpones to tomorrow. */
  async function moveTask(id: string, bucket: string, position?: number) {
    if (isVirtualPostponed(bucket)) {
      const task = taskById(id);
      if (task && !isPostponed(task)) await repository().updateTask(requireProject(), id, { postponed_until: isoDay(1) });
      await loadProject();
      return;
    }
    const task = taskById(id);
    if (task && isPostponed(task)) await repository().updateTask(requireProject(), id, { postponed_until: undefined });
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
    /** The postponed date to put back ('' for none), when the move changed it. */
    postponed?: string;
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
    const project = requireProject();
    if (title && !buckets.value.some((b) => b.name === bucket)) {
      await r.createBucket(project, { title });
      await loadProject();
    }
    if (isVirtualPostponed(bucket)) {
      const before: Placement[] = [];
      for (const task of ids.map(taskById).filter((t): t is Task => !!t && !isPostponed(t))) {
        before.push({ id: task.id, bucket: task.bucket, position: task.position, postponed: task.postponed_until ?? '' });
        await r.updateTask(project, task.id, { postponed_until: isoDay(1) });
      }
      await loadProject();
      return before;
    }
    // A task moved out of the Postponed column (or onto its own column while postponed) is not postponed any more
    const moving = ids
      .map(taskById)
      .filter((t): t is Task => !!t && (t.bucket !== bucket || isPostponed(t)))
      .sort((a, b) => a.position - b.position);
    let next = Math.max(0, ...allTasks.value.filter((t) => t.bucket === bucket).map((t) => t.position)) + 1000;
    const before: Placement[] = [];
    for (const task of moving) {
      const postponed = isPostponed(task);
      const rolled = task.repeat && bucket === 'done' && task.bucket !== 'done';
      before.push({
        id: task.id,
        bucket: task.bucket,
        position: task.position,
        ...(postponed ? { postponed: task.postponed_until } : {}),
        ...(rolled
          ? {
              rolled: {
                due_date: task.due_date,
                planned_date: task.planned_date,
                postponed_until: task.postponed_until,
                // A plain copy: the task is a reactive object, which IndexedDB cannot store
                reminders: task.reminders ? [...task.reminders] : undefined,
                body: task.body,
              },
            }
          : {}),
      });
      // Cleared first: completing a recurring task sets its next postponement, which must stay
      if (postponed) await r.updateTask(project, task.id, { postponed_until: undefined });
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
    for (const p of placements) {
      const task = taskById(p.id);
      if (p.rolled) {
        await repository().updateTask(requireProject(), p.id, p.rolled);
        continue;
      }
      if (task && (task.bucket !== p.bucket || task.position !== p.position)) {
        await repository().moveTask(requireProject(), p.id, p.bucket, p.position);
      }
      if (p.postponed !== undefined && (task?.postponed_until ?? '') !== p.postponed) {
        await repository().updateTask(requireProject(), p.id, { postponed_until: p.postponed || undefined });
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
    query.value = '';
  }

  return {
    status,
    error,
    vault,
    vaults,
    projects,
    pinned,
    orderedProjects,
    togglePinned,
    projectOrder,
    sortBy,
    moveProject,
    setSortBy,
    projectId,
    view,
    hidden,
    toggleHidden,
    setView,
    navVisible,
    project,
    buckets,
    allTasks,
    query,
    parsedFilter,
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
