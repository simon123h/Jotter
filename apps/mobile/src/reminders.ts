import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { UpcomingReminder } from '@/data/repository';
import { t } from '@/i18n';

/**
 * Reminders (spec/FORMAT.md, "Reminders") are delivered as Android notifications that the system fires at their
 * time, also while the app is closed. The vault stays the source of truth: the app arms the reminders that are still
 * to come whenever it has read the vault, and replaces what was armed before. Whether a reminder has fired is the
 * system's business, not the vault's.
 */

export interface ScheduledReminder extends UpcomingReminder {
  /** The same reminder always gets the same id, so that arming it twice does not notify twice. */
  id: number;
}

export type PermissionState = 'granted' | 'denied' | 'prompt';

/** What the app needs from the notification system. */
export interface NotificationPort {
  permission(): Promise<PermissionState>;
  /** Asks the user. True when notifications are allowed afterwards. */
  request(): Promise<boolean>;
  /** Arms exactly these reminders, and no others. */
  replaceAll(reminders: ScheduledReminder[]): Promise<void>;
  /** Calls the handler when a notification is tapped. Returns a function that stops listening. */
  onTap(handler: (ref: { projectId: string; taskId: string }) => void): Promise<() => void>;
}

/** The same positive 31 bit number for the same reminder. */
export function reminderId(r: Pick<UpcomingReminder, 'projectId' | 'taskId' | 'at'>): number {
  let hash = 0;
  for (const ch of `${r.projectId}/${r.taskId}@${r.at}`) hash = (Math.imul(hash, 31) + ch.codePointAt(0)!) | 0;
  return Math.abs(hash) % 2_147_483_647 || 1;
}

/** A local date-time as `YYYY-MM-DDTHH:mm`. */
export function localDateTime(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** A reminder's wall-clock time as a moment on this device's clock. */
export const reminderDate = (at: string): Date => {
  const [day = '', time = ''] = at.split('T');
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  const [h = 0, min = 0] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

const CHANNEL = 'reminders';

const nothing: NotificationPort = {
  permission: async () => 'denied',
  request: async () => false,
  replaceAll: async () => undefined,
  onTap: async () => () => undefined,
};

const capacitorNotifications: NotificationPort = {
  async permission() {
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  },
  async request() {
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  },
  async replaceAll(reminders) {
    const { notifications: pending } = await LocalNotifications.getPending();
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(({ id }) => ({ id })) });
    if (!reminders.length) return;
    await LocalNotifications.createChannel({ id: CHANNEL, name: t('reminders.channel'), importance: 4 });
    await LocalNotifications.schedule({
      notifications: reminders.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.projectTitle,
        channelId: CHANNEL,
        schedule: { at: reminderDate(r.at), allowWhileIdle: true },
        extra: { projectId: r.projectId, taskId: r.taskId },
      })),
    });
  },
  async onTap(handler) {
    const listener = await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      const { projectId, taskId } = notification.extra ?? {};
      if (typeof projectId === 'string' && typeof taskId === 'string') handler({ projectId, taskId });
    });
    return () => void listener.remove();
  },
};

/** The notification system in use. Mutable so that tests can put a memory port in its place. */
export const notifications: { port: NotificationPort } = {
  port: Capacitor.isNativePlatform() ? capacitorNotifications : nothing,
};

/** An in-memory port for tests. */
export class MemoryNotifications implements NotificationPort {
  state: PermissionState = 'prompt';
  /** What the user answers when asked. */
  answer: PermissionState = 'granted';
  armed: ScheduledReminder[] = [];
  asked = 0;
  private handlers: Array<(ref: { projectId: string; taskId: string }) => void> = [];
  async permission() {
    return this.state;
  }
  async request() {
    this.asked++;
    this.state = this.answer;
    return this.state === 'granted';
  }
  async replaceAll(reminders: ScheduledReminder[]) {
    this.armed = reminders;
  }
  async onTap(handler: (ref: { projectId: string; taskId: string }) => void) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
  /** The user taps a notification. */
  tap(projectId: string, taskId: string) {
    this.handlers.forEach((h) => h({ projectId, taskId }));
  }
}

/** Asks for permission to notify, when it has not been given. True when reminders will be shown. */
export async function ensureReminderPermission(): Promise<boolean> {
  const { port } = notifications;
  const state = await port.permission().catch(() => 'denied' as const);
  if (state === 'granted') return true;
  if (state === 'denied') return false;
  return port.request().catch(() => false);
}

/** How long to wait after the vault was read before arming, so that a burst of edits arms once. Tests set it to 0. */
export const armDelay = { ms: 800 };

let armedPlan = '';

/**
 * Arms the reminders that are still to come. Nothing happens without permission, and nothing is rearmed when the
 * plan has not changed since the last time. Failures are swallowed: a missed arming is repeated at the next scan.
 */
export async function armReminders(upcoming: () => Promise<UpcomingReminder[]>): Promise<void> {
  const { port } = notifications;
  try {
    if ((await port.permission()) !== 'granted') {
      armedPlan = '';
      return;
    }
    const taken = new Set<number>();
    const plan = (await upcoming()).map((r) => {
      // Two reminders sharing an id would replace each other: the later one takes the next free number
      let id = reminderId(r);
      while (taken.has(id)) id = (id % 2_147_483_646) + 1;
      taken.add(id);
      return { ...r, id };
    });
    const key = JSON.stringify(plan);
    if (key === armedPlan) return;
    await port.replaceAll(plan);
    armedPlan = key;
  } catch {
    armedPlan = '';
  }
}

/** For tests: forget what was armed. */
export const forgetArmedReminders = () => {
  armedPlan = '';
};
