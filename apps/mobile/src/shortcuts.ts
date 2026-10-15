import { nextTick, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { t } from '@/i18n';
import { urlsIn } from '@jotter/links';

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
 * line as the title and the rest as the notes. A first line that holds an address next to words (`Headline – https://…`)
 * gives the words as the title and the address, with the rest, as the notes; a line that is only an address stays the
 * title. Null when nothing was shared.
 */
export function sharedDraft(url: string): { title: string; body?: string } | null {
  const params = new URLSearchParams(url.split('#')[0]!.split('?')[1] ?? '');
  const subject = params.get('title')?.trim() ?? '';
  const text = params.get('text')?.trim() ?? '';
  if (subject) return { title: subject, body: text || undefined };
  const [first = '', ...rest] = text.split(/\r?\n/);
  const words = first
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/^[\s\-–—:|·•]+|[\s\-–—:|·•]+$/g, '')
    .replace(/\s+/g, ' ');
  // Words next to an address: the words are the title, and the address stays in the notes
  if (words && words !== first.trim() && urlsIn(first).length) {
    const body = [urlsIn(first).join('\n'), ...rest].join('\n').trim();
    return { title: words, body: body || undefined };
  }
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

/** Does what a launcher shortcut asks for. Links that are not shortcuts, and shortcuts without a project, do nothing. A new task or shared text goes to the project chosen for quick capture, else to the one that is open. */
export async function runShortcut(url: string): Promise<void> {
  const action = shortcutAction(url);
  const app = useAppStore();
  const ui = useUiStore();
  if (!action) return;
  const ready = await whenReady(app);
  // What comes from outside goes to the project chosen for quick capture, and the app opens there. Shared text that
  // is empty opens nothing, so it does not switch the project either.
  const capture = action === 'new-task' || (action === 'share' && sharedDraft(url)) ? app.captureProject : null;
  if (ready && capture && capture.id !== app.projectId) await app.selectProject(capture.id);
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
