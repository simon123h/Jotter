import { ref, shallowRef, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Task, Project, Bucket } from '@jotter/vault-format';
import { getRepository, applyTaskFilter, type VaultRepository, type Vault, type NewTask, type TaskFilter } from '@/data';
import { ensureStoragePermission } from '@/data/storagePermission';

export type Status = 'loading' | 'onboarding' | 'ready' | 'error';

export interface Column {
  key: string;
  title: string;
  /** The bucket name, or null for tasks whose bucket the project does not define. */
  bucket: string | null;
  tasks: Task[];
}

const LAST_PROJECT_KEY = 'jotter_lite_last_project';

const remember = (vaultId: string, projectId: string | null) => {
  try {
    if (projectId) localStorage.setItem(`${LAST_PROJECT_KEY}:${vaultId}`, projectId);
  } catch {
    // Storage may be unavailable; the first project is opened next time
  }
};
const recall = (vaultId: string) => {
  try {
    return localStorage.getItem(`${LAST_PROJECT_KEY}:${vaultId}`);
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
  const buckets = ref<Bucket[]>([]);
  const allTasks = ref<Task[]>([]);
  const filter = ref<{ search: string; priority: string; tag: string }>({ search: '', priority: '', tag: '' });
  const unreadable = ref<string[]>([]);

  const project = computed(() => projects.value.find((p) => p.id === projectId.value) ?? null);

  const taskFilter = computed<TaskFilter>(() => ({
    search: filter.value.search,
    priority: filter.value.priority || undefined,
    tags: filter.value.tag ? [filter.value.tag] : undefined,
  }));
  const isFiltering = computed(() => !!(filter.value.search || filter.value.priority || filter.value.tag));
  const visibleTasks = computed(() => applyTaskFilter(allTasks.value, taskFilter.value));
  const allTags = computed(() => [...new Set(allTasks.value.flatMap((t) => t.tags))].sort());

  /** One column per bucket, plus one for tasks that name a bucket the project does not have. */
  const columns = computed<Column[]>(() => {
    const known = new Set(buckets.value.map((b) => b.name));
    const cols: Column[] = buckets.value.map((b) => ({
      key: b.name,
      title: b.title,
      bucket: b.name,
      tasks: visibleTasks.value.filter((t) => t.bucket === b.name),
    }));
    const orphans = visibleTasks.value.filter((t) => !known.has(t.bucket));
    if (orphans.length) cols.push({ key: '__other', title: '', bucket: null, tasks: orphans });
    return cols;
  });

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
    const remembered = recall(opened.id);
    projectId.value = projects.value.find((p) => p.id === remembered)?.id ?? projects.value[0]?.id ?? null;
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

  async function selectProject(id: string) {
    projectId.value = id;
    if (vault.value) remember(vault.value.id, id);
    resetFilter();
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
    bucket: string;
    position: number;
  }

  /**
   * Moves a task to the end of a bucket the way the desktop does for Done and Archive. A project without that
   * bucket gets it first, so the task never ends up in a bucket nothing shows.
   */
  async function moveToBucket(id: string, bucket: string, title: string): Promise<Placement> {
    const task = taskById(id);
    if (!task) throw new Error('Task not found');
    const before: Placement = { bucket: task.bucket, position: task.position };
    if (!buckets.value.some((b) => b.name === bucket)) {
      await repository().createBucket(requireProject(), { title });
      await loadProject();
    }
    await moveTask(id, bucket);
    return before;
  }

  const markDone = (id: string) => moveToBucket(id, 'done', 'Done');
  const archiveTask = (id: string) => moveToBucket(id, 'archive', 'Archive');

  /** Puts a task back where it was. */
  async function restoreTask(id: string, placement: Placement) {
    await moveTask(id, placement.bucket, placement.position);
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
    markDone,
    archiveTask,
    restoreTask,
    removeTask,
    addAttachment,
    removeAttachment,
    attachmentUrl,
    taskById,
    positionsIn,
    resetFilter,
  };
});
