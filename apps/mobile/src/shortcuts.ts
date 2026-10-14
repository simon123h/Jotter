import { nextTick, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';

/** The scheme of the launcher shortcuts (android/app/src/main/res/xml/shortcuts.xml). */
export const SHORTCUT_SCHEME = 'jotter://';

export type ShortcutAction = 'new-task' | 'search' | 'planning' | 'share';

/** What a shortcut link asks for, or null when it is not one of ours. */
export function shortcutAction(url: string): ShortcutAction | null {
  if (!url.startsWith(SHORTCUT_SCHEME)) return null;
  const action = url.slice(SHORTCUT_SCHEME.length).replace(/[/?#].*$/, '');
  return action === 'new-task' || action === 'search' || action === 'planning' || action === 'share' ? action : null;
}

/**
 * The task a share link (jotter://share?title=..&text=..) stands for. MainActivity turns what other apps share into
 * such a link. A subject (a page title) is the title and the text (its address) the notes; text alone gives its first
 * line as the title and the rest as the notes. Null when nothing was shared.
 */
export function sharedDraft(url: string): { title: string; body?: string } | null {
  const params = new URLSearchParams(url.split('#')[0]!.split('?')[1] ?? '');
  const subject = params.get('title')?.trim() ?? '';
  const text = params.get('text')?.trim() ?? '';
  if (subject) return { title: subject, body: text || undefined };
  const [first = '', ...rest] = text.split(/\r?\n/);
  const body = rest.join('\n').trim();
  return first.trim() ? { title: first.trim(), body: body || undefined } : null;
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

/** Opens the task a reminder's notification stands for, in its project. A task that is gone opens nothing. */
export async function openReminder(ref: { projectId: string; taskId: string }): Promise<void> {
  const app = useAppStore();
  const ui = useUiStore();
  if (!(await whenReady(app))) return;
  if (app.projectId !== ref.projectId) await app.selectProject(ref.projectId);
  if (!app.taskById(ref.taskId)) return;
  ui.close();
  app.clearSelection();
  await nextTick();
  ui.open({ type: 'task', id: ref.taskId });
}

/** Does what a launcher shortcut asks for. Links that are not shortcuts, and shortcuts without a project, do nothing. */
export async function runShortcut(url: string): Promise<void> {
  const action = shortcutAction(url);
  const app = useAppStore();
  const ui = useUiStore();
  if (!action) return;
  const ready = await whenReady(app);
  if (!ready || !app.project) {
    // Shared text is not dropped without a word
    if (action === 'share' && sharedDraft(url)) ui.showToast(t('share.noProject'));
    return;
  }

  ui.close();
  app.clearSelection();
  if (action === 'share') {
    const draft = sharedDraft(url);
    // Closed first, so that quick add that is already open starts over with the shared text
    await nextTick();
    if (draft) ui.open({ type: 'quickadd', draft, inbox: true });
  } else if (action === 'new-task') ui.open({ type: 'quickadd', inbox: true });
  else if (action === 'search') ui.searching = true;
  else app.setView('planning');
}
