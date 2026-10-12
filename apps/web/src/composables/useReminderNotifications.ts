import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getUpcomingReminders } from '@/api';
import { ReminderNotifier } from '@/utils/reminderNotifier';

const FIRED_KEY = 'jotter_fired_reminders';
const CHECK_EVERY_MS = 30_000;

/** Asks for permission to show notifications, once there is a reminder to show. True when they will be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/**
 * Notifications for reminders, while the app is open. A desktop browser cannot wake a closed page, so a reminder
 * that comes while Jotter is closed is only shown if it came a few minutes before it was opened.
 */
export function useReminderNotifications() {
  const router = useRouter();
  let timer: ReturnType<typeof setInterval> | undefined;

  const notifier = new ReminderNotifier({
    fetchUpcoming: getUpcomingReminders,
    permission: () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
    show: (reminder) => {
      const notification = new Notification(reminder.title, { body: reminder.project_title, tag: `${reminder.task_id}@${reminder.at}` });
      notification.onclick = () => {
        window.focus();
        void router.push({ name: 'board-task', params: { projectId: reminder.project_id, taskId: reminder.task_id } });
        notification.close();
      };
    },
    loadFired: () => {
      try {
        const stored = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]');
        return Array.isArray(stored) ? stored.filter((k): k is string => typeof k === 'string') : [];
      } catch {
        return [];
      }
    },
    saveFired: (keys) => {
      try {
        localStorage.setItem(FIRED_KEY, JSON.stringify(keys));
      } catch {
        // Not kept: a reminder may be shown twice after a reload
      }
    },
  });

  onMounted(() => {
    void notifier.check();
    timer = setInterval(() => void notifier.check(), CHECK_EVERY_MS);
  });
  onBeforeUnmount(() => clearInterval(timer));
}
