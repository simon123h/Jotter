import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MemoryNotifications,
  armReminders,
  forgetArmedReminders,
  localDateTime,
  notifications,
  reminderDate,
  reminderId,
} from './reminders';
import type { UpcomingReminder } from '@/data/repository';

const reminder = (taskId: string, at: string): UpcomingReminder => ({
  projectId: 'work',
  projectTitle: 'Work',
  taskId,
  title: `Task ${taskId}`,
  at,
});

let port: MemoryNotifications;
const original = notifications.port;

beforeEach(() => {
  port = new MemoryNotifications();
  notifications.port = port;
  forgetArmedReminders();
});
afterEach(() => {
  notifications.port = original;
});

describe('reminder ids and times', () => {
  it('gives the same reminder the same positive id, and others other ids', () => {
    const a = reminderId({ projectId: 'work', taskId: 'a', at: '2030-05-01T09:00' });
    expect(a).toBe(reminderId({ projectId: 'work', taskId: 'a', at: '2030-05-01T09:00' }));
    expect(a).not.toBe(reminderId({ projectId: 'work', taskId: 'a', at: '2030-05-01T09:01' }));
    expect(a).not.toBe(reminderId({ projectId: 'home', taskId: 'a', at: '2030-05-01T09:00' }));
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(2 ** 31);
  });

  it('reads a floating time as the wall clock of the device, and writes it back the same', () => {
    const date = reminderDate('2030-05-01T09:30');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2030, 4, 1, 9, 30]);
    expect(localDateTime(date)).toBe('2030-05-01T09:30');
  });
});

describe('arming reminders', () => {
  it('arms nothing without permission, and what is still to come with it', async () => {
    await armReminders(async () => [reminder('a', '2030-05-01T09:00')]);
    expect(port.armed).toEqual([]);

    port.state = 'granted';
    await armReminders(async () => [reminder('a', '2030-05-01T09:00'), reminder('b', '2030-05-02T09:00')]);
    expect(port.armed.map((r) => r.taskId)).toEqual(['a', 'b']);
    expect(port.armed[0]!.id).toBe(reminderId(port.armed[0]!));
  });

  it('replaces what was armed, and leaves it alone when the plan did not change', async () => {
    port.state = 'granted';
    let calls = 0;
    const replace = port.replaceAll.bind(port);
    port.replaceAll = async (items) => {
      calls++;
      await replace(items);
    };

    await armReminders(async () => [reminder('a', '2030-05-01T09:00')]);
    await armReminders(async () => [reminder('a', '2030-05-01T09:00')]);
    expect(calls).toBe(1);

    await armReminders(async () => [reminder('a', '2030-05-03T09:00')]);
    expect(calls).toBe(2);
    expect(port.armed.map((r) => r.at)).toEqual(['2030-05-03T09:00']);
  });

  it('never gives two reminders the same id', async () => {
    port.state = 'granted';
    // The same reminder twice hashes to the same id
    await armReminders(async () => [reminder('a', '2030-05-01T09:00'), reminder('a', '2030-05-01T09:00')]);

    expect(new Set(port.armed.map((r) => r.id)).size).toBe(2);
  });

  it('survives a notification system that fails, and tries again next time', async () => {
    port.state = 'granted';
    port.replaceAll = async () => {
      throw new Error('boom');
    };
    await expect(armReminders(async () => [reminder('a', '2030-05-01T09:00')])).resolves.toBeUndefined();

    port.replaceAll = MemoryNotifications.prototype.replaceAll.bind(port);
    await armReminders(async () => [reminder('a', '2030-05-01T09:00')]);
    expect(port.armed).toHaveLength(1);
  });
});
