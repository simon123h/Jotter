import yaml from 'yaml';
import type { Task, Project, Bucket } from '@/types';

/**
 * Reads and writes the vault format defined in spec/FORMAT.md. The Python backend implements the same format;
 * spec/fixtures holds the cases both must pass (see formatConformance.spec.ts).
 */

// The default buckets of every new project, the same as the backend's.
export const DEFAULT_MOBILE_BUCKETS: Bucket[] = [
  { name: 'backlog', title: 'Backlog', subtitle: '', position: 1000.0, layout: 'list', color: null, max_tasks: null, is_default: true },
  { name: 'todo', title: 'To Do', subtitle: '', position: 2000.0, layout: 'list', color: null, max_tasks: null, is_default: false },
  {
    name: 'in-progress',
    title: 'In Progress',
    subtitle: '',
    position: 3000.0,
    layout: 'list',
    color: null,
    max_tasks: null,
    is_default: false,
  },
  { name: 'done', title: 'Done', subtitle: '', position: 4000.0, layout: 'list', color: null, max_tasks: null, is_default: false },
  { name: 'archive', title: 'Archive', subtitle: '', position: 5000.0, layout: 'list', color: null, max_tasks: null, is_default: false },
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Planning keywords, compared ignoring case and hyphens (`this-week` is `thisWeek`)
const PLANNING_KEYWORDS = new Set([
  'today',
  'tomorrow',
  'someday',
  'sometime',
  'thisweek',
  'nextweek',
  'thismonth',
  'nextmonth',
  'thisyear',
  'nextyear',
]);

const isPlanningKeyword = (text: string) => PLANNING_KEYWORDS.has(text.trim().toLowerCase().replace(/-/g, ''));

const KNOWN_TASK_KEYS = new Set([
  'type',
  'id',
  'project_id',
  'projectId',
  'title',
  'status',
  'bucket',
  'position',
  'tags',
  'attachments',
  'due_date',
  'dueDate',
  'planned_date',
  'plannedDate',
  'priority',
  'color',
  'postponed_until',
  'postponedUntil',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
]);

const KNOWN_PROJECT_KEYS = new Set([
  'type',
  'id',
  'title',
  'name',
  'description',
  'created_at',
  'createdAt',
  'done_clean_period',
  'doneCleanPeriod',
  'buckets',
]);

interface Frontmatter {
  data: Record<string, any>;
  body: string;
}

/**
 * Splits a file into its frontmatter and body. The frontmatter ends at the first line that is exactly `---`,
 * so horizontal rules in the body stay in the body. The body loses its leading blank lines.
 */
function splitFrontmatter(content: string): Frontmatter {
  const match = content.startsWith('---') ? /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m.exec(content) : null;
  if (!match) return { data: {}, body: content };

  // Invalid YAML throws: the caller must not overwrite a file it could not read
  const parsed = yaml.parse(match[1]);
  const data: Record<string, any> = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return { data, body: content.slice(match[0].length).replace(/^[\r\n]+/, '') };
}

function isoDate(value: string): string | null {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}

/** A planning keyword (kept as written) or a YYYY-MM-DD date. Anything else is dropped. */
function planningValue(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const text = String(raw).trim();
  if (isPlanningKeyword(text)) return text;
  return isoDate(text);
}

function dateValue(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  return isoDate(String(raw).trim());
}

function normalizeTag(tag: unknown): string {
  return String(tag).trim().replace(/^#+/, '').toLowerCase();
}

function parseTags(raw: unknown): string[] {
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw.filter((t) => t !== null && t !== undefined);
  else if (typeof raw === 'string' && raw.trim()) items = raw.split(',');
  return items.map(normalizeTag).filter((t) => t && !/\s/.test(t));
}

function parseAttachments(raw: unknown): string[] {
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw.filter((a) => a !== null && a !== undefined);
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed.filter((a) => a !== null) : [raw];
    } catch {
      items = [raw];
    }
  }
  return items.map((a) => String(a).trim()).filter(Boolean);
}

function timestamp(raw: unknown, fallback: string): string {
  if (raw instanceof Date) return raw.toISOString();
  return raw ? String(raw).trim() : fallback;
}

/**
 * Parses a Task markdown file with YAML frontmatter. Throws when the frontmatter is not valid YAML.
 */
export function parseTaskMarkdown(content: string, defaultProjectId = 'default', filename = ''): Task {
  const { data: fm, body } = splitFrontmatter(content);

  const id = String(fm.id || filename.replace(/\.md$/i, '') || `task_${Date.now()}`).trim();
  const projectId = String(defaultProjectId || fm.project_id || fm.projectId || 'default').trim();
  const title = String(fm.title || '').trim() || 'Untitled Task';
  const bucket = String(fm.status || fm.bucket || '').trim() || 'todo';
  const position = typeof fm.position === 'number' ? fm.position : parseFloat(String(fm.position ?? '')) || 1000.0;

  // A planning keyword in due_date is a planned date
  let dueDate = dateValue(fm.due_date ?? fm.dueDate);
  let plannedDate = planningValue(fm.planned_date ?? fm.plannedDate);
  const rawDue = fm.due_date ?? fm.dueDate;
  if (rawDue && !dueDate && isPlanningKeyword(String(rawDue))) {
    plannedDate = plannedDate ?? String(rawDue).trim();
    dueDate = null;
  }

  const priority = String(fm.priority ?? '')
    .trim()
    .toLowerCase();
  const extra = Object.fromEntries(Object.entries(fm).filter(([key]) => !KNOWN_TASK_KEYS.has(key)));
  const nowIso = new Date().toISOString();

  return {
    id,
    project_id: projectId,
    title,
    bucket,
    position,
    tags: parseTags(fm.tags),
    attachments: parseAttachments(fm.attachments),
    body,
    due_date: dueDate ?? undefined,
    planned_date: plannedDate ?? undefined,
    priority: PRIORITIES.includes(priority) ? priority : undefined,
    color: fm.color ? String(fm.color).trim() : undefined,
    postponed_until: dateValue(fm.postponed_until ?? fm.postponedUntil) ?? undefined,
    created_at: timestamp(fm.created_at ?? fm.createdAt, nowIso),
    updated_at: timestamp(fm.updated_at ?? fm.updatedAt, nowIso),
    extra_frontmatter: extra,
  };
}

/** Writes `---`, the frontmatter, `---` and the body. The body is written exactly as it is. */
function joinFrontmatter(fm: Record<string, any>, body: string): string {
  const yamlStr = yaml.stringify(fm).trim();
  return `---\n${yamlStr}\n---\n${body ? `\n${body.replace(/^[\r\n]+/, '')}` : ''}`;
}

/**
 * Serializes a Task object to Markdown string with YAML frontmatter.
 */
export function dumpTaskMarkdown(task: Task): string {
  const fmDict: Record<string, any> = {
    type: 'task',
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    status: task.bucket,
    position: task.position,
  };

  if (task.created_at) fmDict.created_at = task.created_at;
  if (task.updated_at) fmDict.updated_at = task.updated_at;
  if (task.tags && task.tags.length > 0) fmDict.tags = task.tags;
  if (task.attachments && task.attachments.length > 0) fmDict.attachments = task.attachments;
  if (task.due_date) fmDict.due_date = task.due_date;
  if (task.planned_date) fmDict.planned_date = task.planned_date;
  if (task.priority && task.priority !== 'none') fmDict.priority = task.priority;
  if (task.color) fmDict.color = task.color;
  if (task.postponed_until) fmDict.postponed_until = task.postponed_until;

  // Keys written by other tools stay as they are
  for (const [key, value] of Object.entries(task.extra_frontmatter ?? {})) {
    if (!(key in fmDict) && !KNOWN_TASK_KEYS.has(key)) fmDict[key] = value;
  }

  return joinFrontmatter(fmDict, task.body);
}

/**
 * Parses an index.md project manifest.
 */
export function parseProjectManifest(content: string, fallbackId: string): { project: Project; buckets: Bucket[] } {
  let parsedFile: Frontmatter;
  try {
    parsedFile = splitFrontmatter(content);
  } catch {
    // Unreadable manifest: fall back to defaults and keep the text below, so a rewrite does not lose it
    parsedFile = { data: {}, body: content };
  }
  const { data: fm, body } = parsedFile;

  const projId = String(fm.id || fallbackId).trim() || fallbackId;
  const title = String(fm.title || fm.name || projId.charAt(0).toUpperCase() + projId.slice(1)).trim();
  const rawClean = fm.done_clean_period ?? fm.doneCleanPeriod;
  const doneCleanPeriod = rawClean !== undefined && rawClean !== null && !Number.isNaN(Number(rawClean)) ? Number(rawClean) : undefined;

  const project: Project = {
    id: projId,
    title,
    created_at: timestamp(fm.created_at ?? fm.createdAt, new Date().toISOString()),
    done_clean_period: doneCleanPeriod,
    description: String(fm.description ?? '').trim(),
    body,
    extra_frontmatter: Object.fromEntries(Object.entries(fm).filter(([key]) => !KNOWN_PROJECT_KEYS.has(key))),
  };

  const buckets: Bucket[] = [];
  if (Array.isArray(fm.buckets) && fm.buckets.length > 0) {
    fm.buckets.forEach((b: any, idx: number) => {
      if (b && typeof b === 'object') {
        const bName = String(b.name || b.id || `column_${idx}`).trim();
        const position = typeof b.position === 'number' ? b.position : parseFloat(String(b.position ?? ''));
        buckets.push({
          name: bName,
          title: String(b.title || b.name || bName.charAt(0).toUpperCase() + bName.slice(1)).trim(),
          subtitle: String(b.subtitle || '').trim(),
          position: position || (idx + 1) * 1000.0,
          color: b.color ? String(b.color).trim() : null,
          layout: b.layout || 'list',
          max_tasks: b.max_tasks !== undefined && b.max_tasks !== null ? Number(b.max_tasks) : null,
          is_default: Boolean(b.is_default),
        });
      }
    });
  }
  if (buckets.length === 0) buckets.push(...DEFAULT_MOBILE_BUCKETS.map((b) => ({ ...b })));

  return { project, buckets };
}

/**
 * Serializes a Project and its Buckets to index.md format. The body and unknown keys of the existing manifest
 * (kept on the project) are written back unchanged.
 */
export function dumpProjectManifest(project: Project, buckets: Bucket[], existingBody?: string): string {
  const fmDict: Record<string, any> = {
    type: 'project',
    id: project.id,
    title: project.title,
  };

  if (project.description) fmDict.description = project.description;
  if (project.created_at) fmDict.created_at = project.created_at;
  if (project.done_clean_period !== undefined && project.done_clean_period !== null) {
    fmDict.done_clean_period = project.done_clean_period;
  }

  fmDict.buckets = buckets.map((b, idx) => ({
    name: b.name,
    title: b.title,
    subtitle: b.subtitle || '',
    position: typeof b.position === 'number' ? b.position : (idx + 1) * 1000.0,
    color: b.color || null,
    layout: b.layout || 'list',
    max_tasks: b.max_tasks ?? null,
    is_default: Boolean(b.is_default),
  }));

  for (const [key, value] of Object.entries(project.extra_frontmatter ?? {})) {
    if (!(key in fmDict) && !KNOWN_PROJECT_KEYS.has(key)) fmDict[key] = value;
  }

  const body = existingBody ?? project.body ?? '';
  return joinFrontmatter(fmDict, body.trim() ? body : `# ${project.title}\n`);
}
