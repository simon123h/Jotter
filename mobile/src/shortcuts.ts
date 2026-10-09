import { watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

/** The scheme of the launcher shortcuts (android/app/src/main/res/xml/shortcuts.xml). */
export const SHORTCUT_SCHEME = 'jotterlite://';

export type ShortcutAction = 'new-task' | 'search' | 'planning';

/** What a shortcut link asks for, or null when it is not one of ours. */
export function shortcutAction(url: string): ShortcutAction | null {
  if (!url.startsWith(SHORTCUT_SCHEME)) return null;
  const action = url.slice(SHORTCUT_SCHEME.length).replace(/[/?#].*$/, '');
  return action === 'new-task' || action === 'search' || action === 'planning' ? action : null;
}

/** Waits until the vault is open: a shortcut can start the app, which is still loading at that point. */
function whenReady(app: ReturnType<typeof useAppStore>): Promise<boolean> {
  return new Promise((resolve) => {
    const stop = watch(
      () => app.status,
      (status) => {
        if (status === 'loading') return;
        queueMicrotask(() => stop());
        resolve(status === 'ready');
      },
      { immediate: true }
    );
  });
}

/** Does what a launcher shortcut asks for. Links that are not shortcuts, and shortcuts without a project, do nothing. */
export async function runShortcut(url: string): Promise<void> {
  const action = shortcutAction(url);
  const app = useAppStore();
  const ui = useUiStore();
  if (!action || !(await whenReady(app)) || !app.project) return;

  ui.close();
  app.clearSelection();
  if (action === 'new-task') ui.open({ type: 'quickadd' });
  else if (action === 'search') ui.searching = true;
  else app.setView('planning');
}
