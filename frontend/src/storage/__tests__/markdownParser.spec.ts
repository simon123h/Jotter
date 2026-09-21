import { describe, it, expect } from 'vitest';
import { parseTaskMarkdown, dumpTaskMarkdown, parseProjectManifest, dumpProjectManifest } from '../markdownParser';

describe('markdownParser', () => {
  it('parses and dumps task markdown roundtrip', () => {
    const rawMarkdown = `---
type: task
id: task-123
project_id: default
title: Implement mobile storage
bucket: in-progress
position: 1500
tags:
  - mobile
  - capacitor
attachments:
  - uploads/photo.png
due_date: '2026-10-01'
planned_date: this-week
priority: high
color: '#3b82f6'
postponed_until: '2026-10-15'
created_at: '2026-09-20T10:00:00.000Z'
updated_at: '2026-09-20T11:00:00.000Z'
---

# Notes on mobile implementation

- [x] Create storage adapter
- [ ] Test on Android emulator
`;

    const task = parseTaskMarkdown(rawMarkdown, 'default', 'task-123.md');
    expect(task.id).toBe('task-123');
    expect(task.project_id).toBe('default');
    expect(task.title).toBe('Implement mobile storage');
    expect(task.bucket).toBe('in-progress');
    expect(task.position).toBe(1500);
    expect(task.tags).toEqual(['mobile', 'capacitor']);
    expect(task.attachments).toEqual(['uploads/photo.png']);
    expect(task.due_date).toBe('2026-10-01');
    expect(task.planned_date).toBe('this-week');
    expect(task.priority).toBe('high');
    expect(task.color).toBe('#3b82f6');
    expect(task.postponed_until).toBe('2026-10-15');
    expect(task.body).toContain('# Notes on mobile implementation');

    const serialized = dumpTaskMarkdown(task);
    expect(serialized).toContain('type: task');
    expect(serialized).toContain('id: task-123');
    expect(serialized).toContain('title: Implement mobile storage');
    expect(serialized).toContain('# Notes on mobile implementation');
  });

  it('parses and dumps project index.md manifest roundtrip', () => {
    const rawManifest = `---
type: project
id: work-board
title: Work Board
created_at: '2026-01-01T00:00:00.000Z'
done_clean_period: 14
buckets:
  - name: ideas
    title: Ideas
    subtitle: Backlog items
    position: 1000
    color: '#ff0000'
    layout: list
    max_tasks: 10
    is_default: false
  - name: done
    title: Done
    subtitle: Completed
    position: 2000
    color: null
    layout: list
    max_tasks: null
    is_default: false
---

# Work Board Overview
`;

    const { project, buckets } = parseProjectManifest(rawManifest, 'work-board');
    expect(project.id).toBe('work-board');
    expect(project.title).toBe('Work Board');
    expect(project.done_clean_period).toBe(14);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].name).toBe('ideas');
    expect(buckets[0].title).toBe('Ideas');
    expect(buckets[0].max_tasks).toBe(10);

    const serialized = dumpProjectManifest(project, buckets, '# Custom notes');
    expect(serialized).toContain('type: project');
    expect(serialized).toContain('id: work-board');
    expect(serialized).toContain('name: ideas');
    expect(serialized).toContain('# Custom notes');
  });
});
