import yaml from 'yaml';
import type { Task, Project, Bucket, RepeatRule } from './types';
import { canonicalPlanned } from '@jotter/task-filter';

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
  'repeat',
  'reminders',
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
  'archived',
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

function dateValue(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  return isoDate(String(raw).trim());
}

const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const;
const REPEAT_FROM = ['completion', 'due'] as const;

/** A repeat rule as the spec allows it. A rule it does not allow is dropped. */
function parseRepeat(raw: unknown): RepeatRule | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rule = raw as Record<string, unknown>;
  const every = typeof rule.every === 'string' && /^\s*\d+\s*$/.test(rule.every) ? Number(rule.every) : rule.every;
  if (typeof every !== 'number' || !Number.isInteger(every) || every < 1) return undefined;
  const unit = String(rule.unit ?? '')
    .trim()
    .toLowerCase()
    .replace(/s$/, '');
  const from = rule.from === undefined || rule.from === null ? 'completion' : String(rule.from).trim().toLowerCase();
  if (!(REPEAT_UNITS as readonly string[]).includes(unit) || !(REPEAT_FROM as readonly string[]).includes(from)) return undefined;
  return { every, unit: unit as RepeatRule['unit'], from: from as RepeatRule['from'] };
}

const LOCAL_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/;

/** Reminders as `YYYY-MM-DDTHH:mm`, sorted and without duplicates. Values that are no local date-time are dropped. */
function parseReminders(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];
  const found = new Set<string>();
  for (const item of Array.isArray(raw) ? raw : [raw]) {
    const match = typeof item === 'string' ? LOCAL_DATETIME.exec(item.trim()) : null;
    if (!match || !isoDate(match[1])) continue;
    const [hours, minutes] = match[2].split(':').map(Number);
    if (hours > 23 || minutes > 59) continue;
    found.add(`${match[1]}T${match[2]}`);
  }
  return [...found].sort();
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

  // An empty value falls through to the other spelling of the key, as in the Python reader. Values that are no date are dropped
  const dueDate = dateValue(fm.due_date || fm.dueDate);
  const rawPlanned = fm.planned_date || fm.plannedDate;
  const plannedDate = rawPlanned ? canonicalPlanned(String(rawPlanned)) : null;

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
    repeat: parseRepeat(fm.repeat),
    reminders: parseReminders(fm.reminders),
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
  if (task.repeat) fmDict.repeat = { every: task.repeat.every, unit: task.repeat.unit, from: task.repeat.from };
  if (task.reminders && task.reminders.length > 0) fmDict.reminders = task.reminders;

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
    archived: fm.archived === true,
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
  if (project.archived) fmDict.archived = true;

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
