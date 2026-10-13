import { marked } from 'marked';
import DOMPurify from 'dompurify';

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
