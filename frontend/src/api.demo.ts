import type { Task, Bucket, Project, TaskFilterParams } from '@/types';

// ==========================================
// LOCAL STORAGE MOCK CLIENT (DEMO MODE)
// ==========================================

function seedDemoData() {
  if (localStorage.getItem('jotter_demo_projects')) return;

  const now = new Date().toISOString();

  const projects: Project[] = [
    {
      id: 'demo-project',
      title: 'Demo Project',
      created_at: now,
      done_clean_period: null,
    },
  ];
  localStorage.setItem('jotter_demo_projects', JSON.stringify(projects));

  const bucketsMap: Record<string, Bucket[]> = {
    'demo-project': [
      { name: 'backlog', title: 'Backlog', subtitle: 'Ideas and incoming items', position: 1000.0, is_default: true },
      { name: 'todo', title: 'To Do', subtitle: 'Ready to work on', position: 2000.0, is_default: false },
      { name: 'in-progress', title: 'In Progress', subtitle: 'Work in progress', position: 3000.0, is_default: false },
      { name: 'done', title: 'Done', subtitle: 'Completed tasks', position: 4000.0, is_default: false, color: 'green' },
    ],
  };
  localStorage.setItem('jotter_demo_buckets', JSON.stringify(bucketsMap));

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const tasksMap: Record<string, Task[]> = {
    'demo-project': [
      {
        id: '1',
        project_id: 'demo-project',
        title: 'Welcome to Jotter! 👋',
        bucket: 'todo',
        position: 1000,
        tags: ['demo', 'guide'],
        attachments: [],
        body: 'Welcome to your local-first Markdown Kanban board!\n\nThis is a static demo running entirely in your browser using `localStorage`.\n\n### Key Features:\n- 📝 **Markdown support** in descriptions (checklists, headers, bold text).\n- 🏷️ **Custom Tags** & Filtering.\n- 📅 **Due Dates** & Prioritization.\n- 🔄 **Local-first synchronization** (in the desktop app, files are synced as `.md` text files directly on your computer!).',
        due_date: nextWeekStr,
        priority: 'medium',
        created_at: now,
        updated_at: now,
      },
      {
        id: '2',
        project_id: 'demo-project',
        title: 'Try drag-and-drop 🚀',
        bucket: 'backlog',
        position: 2000,
        tags: ['interactive'],
        attachments: [],
        body: 'Grab this card and move it over to the **In Progress** or **Done** columns!\n\nAll movements are persisted instantly.',
        due_date: tomorrowStr,
        priority: 'high',
        created_at: now,
        updated_at: now,
      },
      {
        id: '3',
        project_id: 'demo-project',
        title: 'Create a new column or project 🛠️',
        bucket: 'backlog',
        position: 1000,
        tags: ['settings'],
        attachments: [],
        body: 'Use the **New Project** button at the bottom of the sidebar to add another workspace, or double-click column headers to rename them/add new ones!',
        priority: 'low',
        created_at: now,
        updated_at: now,
      },
      {
        id: '4',
        project_id: 'demo-project',
        title: 'Explore done task auto-pruning 🧹',
        bucket: 'done',
        position: 1000,
        tags: ['feature'],
        attachments: [],
        body: 'We recently added a settings modal for projects. Click the **Pencil icon** next to the project name in the sidebar to configure the **Done Tasks Deletion Period**! Tasks left in the Done column will be cleaned up automatically after that period.',
        priority: 'medium',
        created_at: now,
        updated_at: now,
        due_date: '',
        color: null,
      },
      {
        id: '01KTD0KVDH5P44EDDS2347A2FT',
        project_id: 'demo-project',
        title: 'Check out the demo',
        bucket: 'in-progress',
        position: 1000,
        tags: ['demo'],
        attachments: [],
        body: '',
        color: null,
        created_at: now,
        updated_at: now,
        due_date: '',
        priority: 'high',
      },
      {
        id: '01KTD0SASJPTVZ0Y7R6KSEFYJR',
        project_id: 'demo-project',
        title: 'Explore Markdown features',
        bucket: 'todo',
        position: 2000,
        tags: ['feature'],
        attachments: [],
        body: 'Tasks support **full Markdown** content\n\n- [ ] Even\n- [ ] with\n- [x] lists!',
        color: 'yellow',
        created_at: now,
        updated_at: now,
        due_date: tomorrowStr,
        priority: 'high',
      },
    ],
  };
  localStorage.setItem('jotter_demo_tasks', JSON.stringify(tasksMap));
}

function getDemoProjects(): Project[] {
  seedDemoData();
  const data = localStorage.getItem('jotter_demo_projects');
  return data ? JSON.parse(data) : [];
}

function saveDemoProjects(projects: Project[]) {
  localStorage.setItem('jotter_demo_projects', JSON.stringify(projects));
}

function getDemoBucketsMap(): Record<string, Bucket[]> {
  seedDemoData();
  const data = localStorage.getItem('jotter_demo_buckets');
  return data ? JSON.parse(data) : {};
}

function saveDemoBucketsMap(map: Record<string, Bucket[]>) {
  localStorage.setItem('jotter_demo_buckets', JSON.stringify(map));
}

function getDemoTasksMap(): Record<string, Task[]> {
  seedDemoData();
  const data = localStorage.getItem('jotter_demo_tasks');
  return data ? JSON.parse(data) : {};
}

function saveDemoTasksMap(map: Record<string, Task[]>) {
  localStorage.setItem('jotter_demo_tasks', JSON.stringify(map));
}

function pruneDemoTasks(projectId: string) {
  const projects = getDemoProjects();
  const proj = projects.find((p) => p.id === projectId);
  if (!proj || !proj.done_clean_period) return;

  const cleanPeriod = proj.done_clean_period;
  const tasksMap = getDemoTasksMap();
  const projectTasks = tasksMap[projectId] || [];

  const prunedTasks: Task[] = [];
  const now = new Date();

  for (const t of projectTasks) {
    if (t.bucket === 'done') {
      const dateToCheckStr = t.updated_at || t.created_at;
      if (dateToCheckStr) {
        try {
          const updatedDate = new Date(dateToCheckStr);
          const diffTime = Math.abs(now.getTime() - updatedDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= cleanPeriod) {
            continue;
          }
        } catch {
          // ignore date parsing error
        }
      }
    }
    prunedTasks.push(t);
  }

  tasksMap[projectId] = prunedTasks;
  saveDemoTasksMap(tasksMap);
}

export async function getProjects(): Promise<Project[]> {
  return getDemoProjects();
}

export async function createProject(title: string): Promise<Project> {
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const newProj: Project = {
    id: id || 'project-' + Date.now(),
    title,
    created_at: new Date().toISOString(),
    done_clean_period: null,
  };
  const projects = getDemoProjects();
  if (projects.some((p) => p.id === newProj.id)) {
    throw new Error(`Project with ID '${newProj.id}' already exists.`);
  }
  projects.push(newProj);
  saveDemoProjects(projects);

  const bucketsMap = getDemoBucketsMap();
  bucketsMap[newProj.id] = [
    { name: 'backlog', title: 'Backlog', subtitle: '', position: 1000.0, is_default: true },
    { name: 'todo', title: 'To Do', subtitle: '', position: 2000.0, is_default: false },
    { name: 'in-progress', title: 'In Progress', subtitle: '', position: 3000.0, is_default: false },
    { name: 'done', title: 'Done', subtitle: '', position: 4000.0, is_default: false },
  ];
  saveDemoBucketsMap(bucketsMap);

  return newProj;
}

export async function updateProject(id: string, updates: { title?: string; done_clean_period?: number | null }): Promise<Project> {
  const projects = getDemoProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx !== -1) {
    projects[idx] = { ...projects[idx], ...updates };
    saveDemoProjects(projects);
    return projects[idx];
  }
  throw new Error('Project not found');
}

export async function deleteProject(id: string): Promise<void> {
  const projects = getDemoProjects();
  if (projects.length <= 1) {
    throw new Error('Cannot delete the last remaining project.');
  }
  const filtered = projects.filter((p) => p.id !== id);
  saveDemoProjects(filtered);

  const bucketsMap = getDemoBucketsMap();
  delete bucketsMap[id];
  saveDemoBucketsMap(bucketsMap);

  const tasksMap = getDemoTasksMap();
  delete tasksMap[id];
  saveDemoTasksMap(tasksMap);
}

export async function getTasks(projectId: string, filters?: TaskFilterParams): Promise<Task[]> {
  pruneDemoTasks(projectId);
  let list = getDemoTasksMap()[projectId] || [];

  if (filters) {
    if (filters.bucket) {
      list = list.filter((t) => t.bucket === filters.bucket);
    }
    if (filters.buckets) {
      const bucketList = filters.buckets
        .split(',')
        .map((b) => b.trim().toLowerCase())
        .filter(Boolean);
      if (bucketList.length) {
        list = list.filter((t) => bucketList.includes(t.bucket.toLowerCase()));
      }
    }
    if (filters.exclude_bucket) {
      list = list.filter((t) => t.bucket !== filters.exclude_bucket);
    }
    if (filters.tag) {
      list = list.filter((t) => t.tags.some((tg) => tg.toLowerCase() === filters.tag!.toLowerCase()));
    }
    if (filters.tags) {
      const tagList = filters.tags
        .split(',')
        .map((tg) => tg.trim().toLowerCase())
        .filter(Boolean);
      if (tagList.length) {
        const mode = filters.tag_mode || 'any';
        if (mode === 'all') {
          list = list.filter((t) => tagList.every((ft) => t.tags.some((tg) => tg.toLowerCase() === ft)));
        } else {
          list = list.filter((t) => tagList.some((ft) => t.tags.some((tg) => tg.toLowerCase() === ft)));
        }
      }
    }
    if (filters.priorities) {
      const priorityList = filters.priorities
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      if (priorityList.length) {
        list = list.filter((t) => {
          const priority = (t.priority || 'none').toLowerCase();
          return priorityList.includes(priority);
        });
      }
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(searchLower) || (t.body && t.body.toLowerCase().includes(searchLower)));
    }
    if (filters.has_due_date !== undefined && filters.has_due_date !== null) {
      if (filters.has_due_date) {
        list = list.filter((t) => !!t.due_date);
      } else {
        list = list.filter((t) => !t.due_date);
      }
    }
    if (filters.due_before) {
      list = list.filter((t) => !!t.due_date && t.due_date <= filters.due_before!);
    }
    if (filters.due_after) {
      list = list.filter((t) => !!t.due_date && t.due_date >= filters.due_after!);
    }
  }

  return [...list].sort((a, b) => a.position - b.position);
}

export async function getTask(projectId: string, id: string): Promise<Task> {
  const list = getDemoTasksMap()[projectId] || [];
  const t = list.find((x) => x.id === id);
  if (t) return t;
  throw new Error(`Task with ID ${id} not found in project '${projectId}'`);
}

export async function createTask(
  projectId: string,
  task: { title: string; bucket: string; tags: string[]; body: string; due_date?: string; priority?: string; color?: string | null }
): Promise<Task> {
  const tasksMap = getDemoTasksMap();
  const list = tasksMap[projectId] || [];

  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let ts = Date.now();
  let tsStr = '';
  for (let i = 0; i < 10; i++) {
    tsStr = ENCODING[ts % 32] + tsStr;
    ts = Math.floor(ts / 32);
  }
  let randStr = '';
  for (let i = 0; i < 16; i++) {
    randStr += ENCODING[Math.floor(Math.random() * 32)];
  }
  const newId = tsStr + randStr;

  const now = new Date().toISOString();

  const bucketTasks = list.filter((t) => t.bucket === task.bucket);
  let pos = 1000.0;
  if (bucketTasks.length > 0) {
    pos = Math.max(...bucketTasks.map((t) => t.position)) + 1000.0;
  }

  const newTask: Task = {
    id: newId,
    project_id: projectId,
    title: task.title,
    bucket: task.bucket,
    position: pos,
    tags: task.tags.map((t) => t.toLowerCase()),
    attachments: [],
    body: task.body,
    due_date: task.due_date,
    priority: task.priority,
    color: task.color || null,
    created_at: now,
    updated_at: now,
  };

  list.push(newTask);
  tasksMap[projectId] = list;
  saveDemoTasksMap(tasksMap);

  return newTask;
}

export async function updateTask(projectId: string, id: string, task: Partial<Task>): Promise<Task> {
  const tasksMap = getDemoTasksMap();
  const list = tasksMap[projectId] || [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const now = new Date().toISOString();
    list[idx] = {
      ...list[idx],
      ...task,
      updated_at: now,
      tags: task.tags ? task.tags.map((t) => t.toLowerCase()) : list[idx].tags,
    };
    tasksMap[projectId] = list;
    saveDemoTasksMap(tasksMap);
    return list[idx];
  }
  throw new Error('Task not found');
}

export async function moveTask(projectId: string, id: string, bucket: string, position: number): Promise<Task> {
  const tasksMap = getDemoTasksMap();
  const list = tasksMap[projectId] || [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const now = new Date().toISOString();
    list[idx].bucket = bucket;
    list[idx].position = position;
    list[idx].updated_at = now;
    tasksMap[projectId] = list;
    saveDemoTasksMap(tasksMap);
    return list[idx];
  }
  throw new Error('Task not found');
}

export async function deleteTask(projectId: string, id: string): Promise<void> {
  const tasksMap = getDemoTasksMap();
  const list = tasksMap[projectId] || [];
  tasksMap[projectId] = list.filter((t) => t.id !== id);
  saveDemoTasksMap(tasksMap);
}

export async function getBuckets(projectId: string): Promise<Bucket[]> {
  const bucketsMap = getDemoBucketsMap();
  if (!bucketsMap[projectId]) {
    bucketsMap[projectId] = [
      { name: 'backlog', title: 'Backlog', subtitle: '', position: 1000.0, is_default: true },
      { name: 'todo', title: 'To Do', subtitle: '', position: 2000.0, is_default: false },
      { name: 'in-progress', title: 'In Progress', subtitle: '', position: 3000.0, is_default: false },
      { name: 'done', title: 'Done', subtitle: '', position: 4000.0, is_default: false },
    ];
    saveDemoBucketsMap(bucketsMap);
  }
  return [...bucketsMap[projectId]].sort((a, b) => a.position - b.position);
}

export async function createBucket(
  projectId: string,
  title: string,
  subtitle?: string,
  color?: string | null,
  layout?: 'list' | 'grid-2' | 'grid-3',
  max_tasks?: number | null
): Promise<Bucket> {
  if (!title) {
    throw new Error('Title is required');
  }
  const bucketsMap = getDemoBucketsMap();
  const list = bucketsMap[projectId] || [];

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const name = slug || 'column-' + Date.now();

  if (list.some((b) => b.name === name)) {
    throw new Error(`A column with a similar name '${name}' already exists.`);
  }

  let pos = 1000.0;
  if (list.length > 0) {
    pos = Math.max(...list.map((b) => b.position)) + 1000.0;
  }

  const newBucket: Bucket = {
    name,
    title,
    subtitle: subtitle || '',
    position: pos,
    color: color || null,
    layout: layout || 'list',
    max_tasks: max_tasks || null,
    is_default: false,
  };

  list.push(newBucket);
  bucketsMap[projectId] = list;
  saveDemoBucketsMap(bucketsMap);

  return newBucket;
}

export async function updateBucket(projectId: string, name: string, bucketUpdates: Partial<Bucket>): Promise<Bucket> {
  const bucketsMap = getDemoBucketsMap();
  const list = bucketsMap[projectId] || [];
  const idx = list.findIndex((b) => b.name === name);
  if (idx !== -1) {
    if (bucketUpdates.is_default) {
      list.forEach((b) => (b.is_default = false));
    }
    list[idx] = { ...list[idx], ...bucketUpdates };
    bucketsMap[projectId] = list;
    saveDemoBucketsMap(bucketsMap);
    return list[idx];
  }
  throw new Error('Column not found');
}

export async function deleteBucket(projectId: string, name: string): Promise<void> {
  const bucketsMap = getDemoBucketsMap();
  const list = bucketsMap[projectId] || [];
  bucketsMap[projectId] = list.filter((b) => b.name !== name);
  saveDemoBucketsMap(bucketsMap);
}

export async function syncSystem(): Promise<{ status: string; synchronized_tasks: number }> {
  const projects = getDemoProjects();
  projects.forEach((p) => {
    pruneDemoTasks(p.id);
  });
  return { status: 'success', synchronized_tasks: 0 };
}
