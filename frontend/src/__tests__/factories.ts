import type { Task, Bucket, Project, Timeblock } from '@/types';

/**
 * Factory for creating mock Task objects for testing.
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? `task-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    project_id: overrides.project_id ?? 'default-project',
    title: overrides.title ?? `Task ${id}`,
    bucket: overrides.bucket ?? 'todo',
    position: overrides.position ?? 1000,
    tags: overrides.tags ?? [],
    attachments: overrides.attachments ?? [],
    body: overrides.body ?? '',
    due_date: overrides.due_date,
    planned_date: overrides.planned_date,
    priority: overrides.priority,
    color: overrides.color,
    postponed_until: overrides.postponed_until,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Factory for creating mock Bucket objects for testing.
 */
export function createMockBucket(overrides: Partial<Bucket> = {}): Bucket {
  const name = overrides.name ?? 'todo';
  return {
    name,
    title: overrides.title ?? name.toUpperCase(),
    subtitle: overrides.subtitle ?? '',
    position: overrides.position ?? 1,
    color: overrides.color ?? null,
    layout: overrides.layout ?? 'list',
    max_tasks: overrides.max_tasks ?? null,
    is_default: overrides.is_default ?? false,
  };
}

/**
 * Factory for creating mock Project objects for testing.
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? 'project-1';
  return {
    id,
    title: overrides.title ?? `Project ${id}`,
    created_at: overrides.created_at ?? new Date().toISOString(),
    done_clean_period: overrides.done_clean_period ?? null,
    git_remote: overrides.git_remote ?? null,
  };
}

/**
 * Factory for creating mock Timeblock objects for testing.
 */
export function createMockTimeblock(overrides: Partial<Timeblock> = {}): Timeblock {
  const id = overrides.id ?? `tb-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    title: overrides.title ?? `Timeblock ${id}`,
    date: overrides.date ?? '2026-09-01',
    start_time: overrides.start_time ?? '09:00',
    end_time: overrides.end_time ?? '10:00',
    color: overrides.color ?? '#3b82f6',
    task_ids: overrides.task_ids ?? [],
    tasks: overrides.tasks,
    recurrence: overrides.recurrence ?? 'none',
  };
}
