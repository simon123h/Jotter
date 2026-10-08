import { onBeforeUnmount, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

/** How often the vault is scanned for changes made by other apps. Mutable so that tests can shorten it. */
export const autoRefresh = { intervalMs: 60_000 };

/**
 * Rescans the vault regularly while the app is on screen, and whenever it comes back to the foreground, like the
 * desktop app does once a minute. A scan only reads files whose size or modification time changed, so it is cheap.
 * It waits while a task is open or a card is being dragged, so that nothing changes under the user's hands.
 */
export function useAutoRefresh() {
  const app = useAppStore();
  const ui = useUiStore();
  let timer: ReturnType<typeof setInterval> | undefined;

  async function scanNow() {
    if (document.hidden || app.status !== 'ready' || ui.dragging || ui.sheet?.type === 'task') return;
    try {
      await app.refresh();
    } catch {
      // A failed background scan is not worth a message; the next one tries again
    }
  }

  const onVisible = () => {
    if (!document.hidden) void scanNow();
  };

  onMounted(() => {
    timer = setInterval(scanNow, autoRefresh.intervalMs);
    document.addEventListener('visibilitychange', onVisible);
  });

  onBeforeUnmount(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  });

  return { scanNow };
}
