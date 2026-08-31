import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTimeboxStore } from '../timebox';
import * as api from '@/api';

vi.mock('@/api', () => ({
  getTimeboxes: vi.fn(),
  createTimebox: vi.fn(),
  updateTimebox: vi.fn(),
  deleteTimebox: vi.fn(),
  allocateTaskToTimebox: vi.fn(),
}));

describe('useTimeboxStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetches timeboxes and maps by date', async () => {
    const mockList = [
      {
        id: 'tb_1',
        title: 'Deep Work',
        date: '2026-08-31',
        startTime: '09:00',
        endTime: '11:00',
        taskIds: ['task-1'],
      },
      {
        id: 'tb_2',
        title: 'Review',
        date: '2026-08-31',
        startTime: '14:00',
        endTime: '15:00',
        taskIds: ['task-2'],
      },
    ];
    vi.mocked(api.getTimeboxes).mockResolvedValue(mockList);

    const store = useTimeboxStore();
    await store.fetchTimeboxes();

    expect(store.timeboxes).toEqual(mockList);
    const dayBoxes = store.timeboxesByDate('2026-08-31');
    expect(dayBoxes.length).toBe(2);
    expect(dayBoxes[0].title).toBe('Deep Work');
  });

  it('correctly looks up timebox for a given task ID', async () => {
    const mockList = [
      {
        id: 'tb_1',
        title: 'Deep Work',
        date: '2026-08-31',
        startTime: '09:00',
        endTime: '11:00',
        taskIds: ['task-100', 'task-200'],
      },
    ];
    vi.mocked(api.getTimeboxes).mockResolvedValue(mockList);

    const store = useTimeboxStore();
    await store.fetchTimeboxes();

    const box = store.timeboxForTask('task-100');
    expect(box).toBeDefined();
    expect(box?.id).toBe('tb_1');

    const notFound = store.timeboxForTask('task-999');
    expect(notFound).toBeUndefined();
  });

  it('creates, updates, and deletes timeboxes', async () => {
    const newBox = {
      id: 'tb_new',
      title: 'Planning',
      date: '2026-09-01',
      startTime: '10:00',
      endTime: '11:00',
      taskIds: [],
    };
    vi.mocked(api.createTimebox).mockResolvedValue(newBox);
    vi.mocked(api.updateTimebox).mockResolvedValue({ ...newBox, title: 'Updated Planning' });
    vi.mocked(api.deleteTimebox).mockResolvedValue();

    const store = useTimeboxStore();
    const created = await store.createTimebox({
      title: 'Planning',
      date: '2026-09-01',
      startTime: '10:00',
      endTime: '11:00',
      taskIds: [],
    });

    expect(created.id).toBe('tb_new');
    expect(store.timeboxes.length).toBe(1);

    const updated = await store.updateTimebox('tb_new', { title: 'Updated Planning' });
    expect(updated.title).toBe('Updated Planning');
    expect(store.timeboxes[0].title).toBe('Updated Planning');

    await store.deleteTimebox('tb_new');
    expect(store.timeboxes.length).toBe(0);
  });

  it('allocates and unallocates task from a timebox', async () => {
    const box = {
      id: 'tb_1',
      title: 'Focus',
      date: '2026-08-31',
      startTime: '09:00',
      endTime: '10:00',
      taskIds: [],
    };
    const store = useTimeboxStore();
    store.timeboxes = [box];

    vi.mocked(api.allocateTaskToTimebox).mockResolvedValue({
      ...box,
      taskIds: ['task-1'],
    });

    await store.allocateTask('tb_1', 'task-1');
    expect(store.timeboxes[0].taskIds).toContain('task-1');

    vi.mocked(api.allocateTaskToTimebox).mockResolvedValue({
      ...box,
      taskIds: [],
    });

    await store.unallocateTask('tb_1', 'task-1');
    expect(store.timeboxes[0].taskIds).not.toContain('task-1');
  });
});
