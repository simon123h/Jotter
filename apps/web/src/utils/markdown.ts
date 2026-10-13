import { marked, Renderer } from 'marked';

/** True for http(s) links that leave this Jotter instance. Relative, hash and same-origin links stay in the tab. */
function isExternalLink(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** A marked renderer that opens external links in a new tab and leaves everything else to marked's defaults. */
export function createMarkdownRenderer(): Renderer {
  const renderer = new Renderer();
  renderer.link = function (token) {
    const html = Renderer.prototype.link.call(this, token);
    return isExternalLink(token.href) ? html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ') : html;
  };
  return renderer;
}

/** Renders Markdown to HTML, with external links opening in a new tab. */
export function renderMarkdown(src: string): string {
  return marked.parse(src, { renderer: createMarkdownRenderer() }) as string;
}

export interface TaskToConsolidate {
  title: string;
  body?: string | null;
}

/**
 * Combines multiple tasks into a single Markdown checklist string.
 * If any of the tasks have detailed markdown descriptions, they are preserved under a "Details" section.
 *
 * @param tasks - The list of tasks to consolidate
 * @returns Markdown string with checklist items and preserved notes
 */
export function consolidateTasksIntoChecklist(tasks: TaskToConsolidate[]): string {
  if (!tasks.length) return '';

  const checklistLines = tasks.map((t) => `- [ ] ${t.title.trim()}`);
  const detailedNotes: string[] = [];

  for (const t of tasks) {
    if (t.body && t.body.trim()) {
      detailedNotes.push(`#### ${t.title.trim()}\n${t.body.trim()}`);
    }
  }

  if (detailedNotes.length > 0) {
    return `${checklistLines.join('\n')}\n\n### Details\n\n${detailedNotes.join('\n\n')}`;
  }

  return checklistLines.join('\n');
}
