import { describe, it, expect, vi } from 'vitest';
import { ReminderNotifier, localDateTime, type ReminderNotifierDeps } from '../reminderNotifier';
import type { UpcomingReminder } from '@/types';

const reminder = (task_id: string, at: string): UpcomingReminder => ({
  project_id: 'work',
  project_title: 'Work',
  task_id,
  title: `Task ${task_id}`,
  at,
});

function setup(upcoming: UpcomingReminder[], start = new Date(2030, 4, 1, 9, 0)) {
  let now = start;
  let stored: string[] = [];
  const show = vi.fn();
  const deps: ReminderNotifierDeps = {
    fetchUpcoming: vi.fn(async (after: string) => upcoming.filter((r) => r.at >= after)),
    permission: () => 'granted',
    show,
    loadFired: () => stored,
    saveFired: (keys) => (stored = keys),
    now: () => now,
  };
  return {
    deps,
    show,
    notifier: new ReminderNotifier(deps),
    advance: (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000)),
    stored: () => stored,
  };
}

describe('localDateTime', () => {
  it('writes the wall clock of the device', () => {
    expect(localDateTime(new Date(2030, 4, 1, 9, 5))).toBe('2030-05-01T09:05');
  });
});

describe('ReminderNotifier', () => {
  it('shows a reminder when its time has come, once', async () => {
    const { notifier, show, advance } = setup([reminder('a', '2030-05-01T09:10')]);

    expect(await notifier.check()).toBe(0);
    advance(10);
    expect(await notifier.check()).toBe(1);
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ task_id: 'a' }));

    advance(1);
    expect(await notifier.check()).toBe(0);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('shows a reminder that came a few minutes before the app was opened, but not an older one', async () => {
    const { notifier, show } = setup([reminder('recent', '2030-05-01T08:50'), reminder('old', '2030-05-01T07:00')]);

    await notifier.check();

    expect(show.mock.calls.map(([r]) => r.task_id)).toEqual(['recent']);
  });

  it('remembers on the device what it showed, so that a reload does not show it again', async () => {
    const { notifier, deps, show, stored } = setup([reminder('a', '2030-05-01T08:55')]);
    await notifier.check();
    expect(stored()).toEqual(['work/a@2030-05-01T08:55']);

    await new ReminderNotifier(deps).check();
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('shows nothing without permission, and does not look back at it when the permission comes', async () => {
    const { notifier, deps, show, advance } = setup([reminder('a', '2030-05-01T09:10')]);
    let permission = 'default';
    deps.permission = () => permission;

    advance(10);
    expect(await notifier.check()).toBe(0);
    advance(5);
    expect(await notifier.check()).toBe(0);
    permission = 'granted';
    advance(5);
    expect(await notifier.check()).toBe(0);
    expect(show).not.toHaveBeenCalled();
  });

  it('looks at the same time span again after a failed check', async () => {
    const { notifier, deps, show, advance } = setup([reminder('a', '2030-05-01T09:10')]);
    const fetchUpcoming = deps.fetchUpcoming;
    deps.fetchUpcoming = vi.fn().mockRejectedValueOnce(new Error('offline'));

    advance(10);
    expect(await notifier.check()).toBe(0);

    deps.fetchUpcoming = fetchUpcoming;
    advance(1);
    expect(await notifier.check()).toBe(1);
    expect(show).toHaveBeenCalledTimes(1);
  });
});
