import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** One checklist line: optional quote marks, a list marker, then `[ ]` or `[x]`. */
const CHECKLIST = /^((?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;
const FENCE = /^\s*(```|~~~)/;

/** Applies `visit` to every line outside fenced code blocks, which render as text and have no checkboxes. */
function mapOutsideFences(source: string, visit: (line: string) => string): string {
  let fence: string | null = null;
  return source
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (marker && (fence === null || fence === marker)) {
        fence = fence === null ? marker : null;
        return line;
      }
      return fence === null ? visit(line) : line;
    })
    .join('\n');
}

/** How many checklist items the markdown source holds. */
export function countChecklistItems(source: string): number {
  let count = 0;
  mapOutsideFences(source, (line) => {
    if (CHECKLIST.test(line)) count++;
    return line;
  });
  return count;
}

/** Flips the `index`th checklist item (0-based, in reading order). The rest of the text is left exactly as it was. */
export function toggleChecklistItem(source: string, index: number): string {
  let seen = 0;
  return mapOutsideFences(source, (line) =>
    line.replace(CHECKLIST, (match, before: string, mark: string, after: string) => {
      const mine = seen++ === index;
      return mine ? `${before}${mark === ' ' ? 'x' : ' '}${after}` : match;
    })
  );
}

/** The ticked and total checklist items of a body, or null when there are none (what the checkboxes in the notes show). */
export function checklistProgress(source: string): { checked: number; total: number } | null {
  let total = 0;
  let checked = 0;
  mapOutsideFences(source, (line) => {
    const mark = CHECKLIST.exec(line)?.[2];
    if (mark === undefined) return line;
    total++;
    if (mark !== ' ') checked++;
    return line;
  });
  return total ? { checked, total } : null;
}

/** Adds an unchecked item at the end of the body, right after the last checklist line when that is where the body ends. */
export function appendChecklistItem(source: string, label: string): string {
  const item = `- [ ] ${label.trim().replace(/\s+/g, ' ')}`;
  const body = source.replace(/\s+$/, '');
  if (!body) return `${item}\n`;
  const lastLine = body.slice(body.lastIndexOf('\n') + 1);
  return `${body}${CHECKLIST.test(lastLine) ? '\n' : '\n\n'}${item}\n`;
}

// Links open outside the app; checkboxes stay, every other form control goes
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') node.remove();
});

/**
 * Markdown to safe HTML. Notes can come from files someone else wrote, so the output is sanitised, and images are
 * dropped: opening a note must never make the phone fetch something from the network.
 */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { gfm: true, breaks: true, async: false });
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'picture', 'source', 'video', 'audio', 'style', 'form', 'button', 'select', 'textarea', 'option'],
    FORBID_ATTR: ['style'],
    RETURN_DOM_FRAGMENT: true,
  });
  // Checkboxes become tappable and know their place in the text
  clean.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box, i) => {
    box.removeAttribute('disabled');
    box.setAttribute('data-check', String(i));
  });
  const holder = document.createElement('div');
  holder.appendChild(clean);
  return holder.innerHTML;
}
