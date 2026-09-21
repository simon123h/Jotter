import yaml from 'yaml';
import type { Task, Project, Bucket } from '@/types';

export const DEFAULT_MOBILE_BUCKETS: Bucket[] = [
  { name: 'backlog', title: 'Backlog', subtitle: '', position: 1000.0, is_default: false },
  { name: 'todo', title: 'To Do', subtitle: '', position: 2000.0, is_default: false },
  { name: 'in-progress', title: 'In Progress', subtitle: '', position: 3000.0, is_default: false },
  { name: 'done', title: 'Done', subtitle: '', position: 4000.0, is_default: false },
];

/**
 * Parses a Task markdown file with YAML frontmatter.
 */
export function parseTaskMarkdown(content: string, defaultProjectId = 'default', filename = ''): Task {
  let fmData: Record<string, any> = {};
  let body = '';

  if (content.startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      try {
        const parsed = yaml.parse(parts[1]);
        if (parsed && typeof parsed === 'object') {
          fmData = parsed;
        }
      } catch {
        // Fallback for invalid yaml
      }
      body = parts.slice(2).join('---').replace(/^\r?\n/, '');
    } else {
      body = content;
    }
  } else {
    body = content;
  }

  // Derive ID from frontmatter, filename, or generated ULID-like string
  const id = String(fmData.id || filename.replace(/\.md$/i, '') || `task_${Date.now()}`).trim();
  const projectId = String(fmData.project_id || fmData.projectId || defaultProjectId).trim() || defaultProjectId;
  const title = String(fmData.title || (body.split('\n')[0] || '').replace(/^#*\s*/, '') || 'Untitled').trim();
  const bucket = String(fmData.bucket || fmData.status || 'todo').trim().toLowerCase();
  const position = typeof fmData.position === 'number' ? fmData.position : parseFloat(String(fmData.position || '1000.0')) || 1000.0;

  // Tags
  let tags: string[] = [];
  if (Array.isArray(fmData.tags)) {
    tags = fmData.tags.map((t: any) => String(t).trim().replace(/^#/, '').toLowerCase()).filter(Boolean);
  } else if (typeof fmData.tags === 'string' && fmData.tags.trim()) {
    tags = fmData.tags.split(',').map((t: string) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);
  }

  // Attachments
  let attachments: string[] = [];
  if (Array.isArray(fmData.attachments)) {
    attachments = fmData.attachments.map((a: any) => String(a).trim()).filter(Boolean);
  }

  const nowIso = new Date().toISOString();

  return {
    id,
    project_id: projectId,
    title,
    bucket,
    position,
    tags,
    attachments,
    body,
    due_date: fmData.due_date ? String(fmData.due_date).trim() : undefined,
    planned_date: fmData.planned_date ? String(fmData.planned_date).trim() : undefined,
    priority: fmData.priority ? String(fmData.priority).trim().toLowerCase() : undefined,
    color: fmData.color ? String(fmData.color).trim() : undefined,
    postponed_until: fmData.postponed_until ? String(fmData.postponed_until).trim() : undefined,
    created_at: fmData.created_at ? String(fmData.created_at).trim() : nowIso,
    updated_at: fmData.updated_at ? String(fmData.updated_at).trim() : nowIso,
  };
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
    bucket: task.bucket,
    position: task.position,
  };

  if (task.tags && task.tags.length > 0) {
    fmDict.tags = task.tags;
  }
  if (task.attachments && task.attachments.length > 0) {
    fmDict.attachments = task.attachments;
  }
  if (task.due_date) {
    fmDict.due_date = task.due_date;
  }
  if (task.planned_date) {
    fmDict.planned_date = task.planned_date;
  }
  if (task.priority) {
    fmDict.priority = task.priority;
  }
  if (task.color) {
    fmDict.color = task.color;
  }
  if (task.postponed_until) {
    fmDict.postponed_until = task.postponed_until;
  }
  if (task.created_at) {
    fmDict.created_at = task.created_at;
  }
  if (task.updated_at) {
    fmDict.updated_at = task.updated_at;
  }

  const yamlStr = yaml.stringify(fmDict).trim();
  const bodyStr = task.body ? `\n\n${task.body.trimStart()}` : '';

  return `---\n${yamlStr}\n---${bodyStr}\n`;
}

/**
 * Parses an index.md project manifest.
 */
export function parseProjectManifest(content: string, fallbackId: string): { project: Project; buckets: Bucket[] } {
  let fmData: Record<string, any> = {};

  if (content.startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      try {
        const parsed = yaml.parse(parts[1]);
        if (parsed && typeof parsed === 'object') {
          fmData = parsed;
        }
      } catch {
        // Fallback
      }
    }
  }

  const projId = String(fmData.id || fallbackId).trim() || fallbackId;
  const title = String(fmData.title || fmData.name || projId.charAt(0).toUpperCase() + projId.slice(1)).trim();
  const doneCleanPeriod = fmData.done_clean_period !== undefined && fmData.done_clean_period !== null
    ? Number(fmData.done_clean_period)
    : undefined;

  const project: Project = {
    id: projId,
    title,
    created_at: String(fmData.created_at || new Date().toISOString()),
    done_clean_period: doneCleanPeriod,
    git_remote: fmData.git_remote ? String(fmData.git_remote).trim() : undefined,
  };

  const buckets: Bucket[] = [];
  if (Array.isArray(fmData.buckets) && fmData.buckets.length > 0) {
    fmData.buckets.forEach((b: any, idx: number) => {
      if (b && typeof b === 'object') {
        const bName = String(b.name || b.id || `col_${idx}`).trim();
        const bTitle = String(b.title || b.name || bName).trim();
        buckets.push({
          name: bName,
          title: bTitle,
          subtitle: String(b.subtitle || '').trim(),
          position: typeof b.position === 'number' ? b.position : (idx + 1) * 1000.0,
          color: b.color ? String(b.color).trim() : null,
          layout: b.layout || 'list',
          max_tasks: b.max_tasks !== undefined && b.max_tasks !== null ? Number(b.max_tasks) : null,
          is_default: Boolean(b.is_default),
        });
      }
    });
  } else {
    buckets.push(...DEFAULT_MOBILE_BUCKETS);
  }

  return { project, buckets };
}

/**
 * Serializes a Project and its Buckets to index.md format.
 */
export function dumpProjectManifest(project: Project, buckets: Bucket[], existingBody = ''): string {
  const fmDict: Record<string, any> = {
    type: 'project',
    id: project.id,
    title: project.title,
  };

  if (project.created_at) {
    fmDict.created_at = project.created_at;
  }
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

  const yamlStr = yaml.stringify(fmDict).trim();
  const bodyStr = existingBody.trim() ? `\n\n${existingBody.trimStart()}` : `\n\n# ${project.title}\n`;

  return `---\n${yamlStr}\n---${bodyStr}\n`;
}
