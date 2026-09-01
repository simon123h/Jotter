import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTimeblockStore } from '../timeblock';
import * as api from '@/api';

vi.mock('@/api', () => ({
  getTimeblocks: vi.fn(),
  createTimeblock: vi.fn(),
  updateTimeblock: vi.fn(),
  deleteTimeblock: vi.fn(),
  allocateTaskToTimeblock: vi.fn(),
  getTimeblocks: vi.fn(),
  createTimeblock: vi.fn(),
  updateTimeblock: vi.fn(),
  deleteTimeblock: vi.fn(),
  allocateTaskToTimeblock: vi.fn(),
}));

describe('useTimeblockStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('fetches timeblocks and maps by date', async () => {
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
    vi.mocked(api.getTimeblocks).mockResolvedValue(mockList);

    const store = useTimeblockStore();
    await store.fetchTimeblocks();

    expect(store.timeblocks).toEqual(mockList);
    const dayBoxes = store.timeblocksByDate('2026-08-31');
    expect(dayBoxes.length).toBe(2);
    expect(dayBoxes[0].title).toBe('Deep Work');
  });

  it('matches recurring timeblocks by date in timeblocksByDate', async () => {
    const mockList = [
      {
        id: 'tb_daily',
        title: 'Daily Deep Work',
        date: '2026-08-31',
        startTime: '08:00',
        endTime: '10:00',
        recurrence: 'daily' as const,
        taskIds: [],
      },
      {
        id: 'tb_weekdays',
        title: 'Weekday Standup',
        date: '2026-08-31', // Monday
        startTime: '09:00',
        endTime: '09:30',
        recurrence: 'weekdays' as const,
        taskIds: [],
      },
    ];
    vi.mocked(api.getTimeblocks).mockResolvedValue(mockList);

    const store = useTimeblockStore();
    await store.fetchTimeblocks();

    // 2026-09-01 (Tuesday) -> both daily and weekdays match
    const tueBoxes = store.timeblocksByDate('2026-09-01');
    expect(tueBoxes.length).toBe(2);

    // 2026-09-05 (Saturday) -> daily matches, weekdays does NOT match
    const satBoxes = store.timeblocksByDate('2026-09-05');
    expect(satBoxes.length).toBe(1);
    expect(satBoxes[0].title).toBe('Daily Deep Work');

    // Past date before anchor -> does not match
    const pastBoxes = store.timeblocksByDate('2026-08-25');
    expect(pastBoxes.length).toBe(0);
  });

  it('correctly looks up timeblock for a given task ID', async () => {
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
    vi.mocked(api.getTimeblocks).mockResolvedValue(mockList);

    const store = useTimeblockStore();
    await store.fetchTimeblocks();

    const box = store.timeblockForTask('task-100');
    expect(box).toBeDefined();
    expect(box?.id).toBe('tb_1');

    const notFound = store.timeblockForTask('task-999');
    expect(notFound).toBeUndefined();
  });

  it('creates, updates, and deletes timeblocks', async () => {
    const newBox = {
      id: 'tb_new',
      title: 'Planning',
      date: '2026-09-01',
      startTime: '10:00',
      endTime: '11:00',
      taskIds: [],
    };
    vi.mocked(api.createTimeblock).mockResolvedValue(newBox);
    vi.mocked(api.updateTimeblock).mockResolvedValue({ ...newBox, title: 'Updated Planning' });
    vi.mocked(api.deleteTimeblock).mockResolvedValue();

    const store = useTimeblockStore();
    const created = await store.createTimeblock({
      title: 'Planning',
      date: '2026-09-01',
      startTime: '10:00',
      endTime: '11:00',
      taskIds: [],
    });

    expect(created.id).toBe('tb_new');
    expect(store.timeblocks.length).toBe(1);

    const updated = await store.updateTimeblock('tb_new', { title: 'Updated Planning' });
    expect(updated.title).toBe('Updated Planning');
    expect(store.timeblocks[0].title).toBe('Updated Planning');

    await store.deleteTimeblock('tb_new');
    expect(store.timeblocks.length).toBe(0);
  });

  it('allocates and unallocates task from a timeblock', async () => {
    const box = {
      id: 'tb_1',
      title: 'Focus',
      date: '2026-08-31',
      startTime: '09:00',
      endTime: '10:00',
      taskIds: [],
    };
    const store = useTimeblockStore();
    store.timeblocks = [box];

    vi.mocked(api.allocateTaskToTimeblock).mockResolvedValue({
      ...box,
      taskIds: ['task-1'],
    });

    await store.allocateTask('tb_1', 'task-1');
    expect(store.timeblocks[0].taskIds).toContain('task-1');

    vi.mocked(api.allocateTaskToTimeblock).mockResolvedValue({
      ...box,
      taskIds: [],
    });

    await store.unallocateTask('tb_1', 'task-1');
    expect(store.timeblocks[0].taskIds).not.toContain('task-1');
  });
});
