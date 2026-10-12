import type { UpcomingReminder } from '@/types';

/** A local date-time as `YYYY-MM-DDTHH:mm`. */
export function localDateTime(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const reminderKey = (r: UpcomingReminder) => `${r.project_id}/${r.task_id}@${r.at}`;

export interface ReminderNotifierDeps {
  fetchUpcoming: (after: string) => Promise<UpcomingReminder[]>;
  /** The browser's notification permission. */
  permission: () => string;
  show: (reminder: UpcomingReminder) => void;
  /** Reminders that were shown already, kept on this device (not in the vault). */
  loadFired: () => string[];
  saveFired: (keys: string[]) => void;
  now?: () => Date;
}

/**
 * Shows a notification for every reminder that has come while the app is open (spec/FORMAT.md, "Reminders").
 * Each check looks at the time since the last one; a reminder shown once is remembered on the device. The first
 * check also covers a short grace period before the start, so that a reminder that came a moment before the app
 * was opened is not lost. Without permission nothing is shown and nothing is remembered.
 */
export class ReminderNotifier {
  private readonly deps: ReminderNotifierDeps;
  private since: string;
  private fired: Set<string>;

  constructor(deps: ReminderNotifierDeps, graceMinutes = 15) {
    this.deps = deps;
    const now = (deps.now ?? (() => new Date()))();
    this.since = localDateTime(new Date(now.getTime() - graceMinutes * 60_000));
    this.fired = new Set(deps.loadFired());
  }

  async check(): Promise<number> {
    const now = localDateTime((this.deps.now ?? (() => new Date()))());
    const from = this.since;
    this.since = now;
    if (this.deps.permission() !== 'granted') return 0;
    let shown = 0;
    try {
      for (const reminder of await this.deps.fetchUpcoming(from)) {
        const key = reminderKey(reminder);
        if (reminder.at > now || this.fired.has(key)) continue;
        this.deps.show(reminder);
        this.fired.add(key);
        shown++;
      }
    } catch {
      // The server is not there for a moment: the next check looks at the same time span again
      this.since = from;
    }
    if (shown) this.deps.saveFired([...this.fired].slice(-200));
    return shown;
  }
}
