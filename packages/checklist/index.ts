/**
 * The checklists in the notes of a task: Markdown lines like `- [ ] buy milk` (spec/FORMAT.md, "Body").
 *
 * Both apps read, count and tick them with these functions, so that a note shows the same progress on the desktop and on
 * the phone. An item is a list line (`-`, `*`, `+`, `1.` or `1)`, also inside a quote) with `[ ]` or `[x]` after the
 * marker. Lines inside fenced code blocks are text, as they are in the rendered note. Items are numbered from 0 in
 * reading order; that number is what `toggleChecklistItem` and the checkboxes of a rendered note refer to.
 */

export interface ChecklistItem {
  label: string;
  checked: boolean;
  /** Position among all items of the body. */
  index: number;
  /** Indentation in levels of two spaces (a tab counts as two spaces), not yet relative to other items. */
  indent: number;
}

/** quote marks, indentation, list marker, spacing, `[`, the mark, `]`, the rest of the line */
const ITEM = /^((?:\s*>)*)(\s*)([-*+]|\d+[.)])(\s+\[)([ xX])(\])([\s\S]*)$/;
const FENCE = /^\s*(```|~~~)/;

/** Applies `visit` to every line outside fenced code blocks, in order. Lines of the blocks are kept as they are. */
function mapOutsideFences(
  source: string,
  visit: (line: string) => string,
): string {
  let fence: string | null = null;
  return source
    .split("\n")
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (marker && (fence === null || fence === marker)) {
        fence = fence === null ? marker : null;
        return line;
      }
      return fence === null ? visit(line) : line;
    })
    .join("\n");
}

/** The checklist items of a body. */
export function parseChecklist(
  source: string | null | undefined,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (!source) return items;
  mapOutsideFences(source.replace(/\r\n?/g, "\n"), (line) => {
    const match = ITEM.exec(line);
    if (match) {
      items.push({
        label: match[7]!.trim(),
        checked: match[5] !== " ",
        index: items.length,
        indent: Math.floor(match[2]!.replace(/\t/g, "  ").length / 2),
      });
    }
    return line;
  });
  return items;
}

/** How many checklist items the body holds. */
export function countChecklistItems(source: string): number {
  return parseChecklist(source).length;
}

/** The ticked and total items of a body, or null when there are none. */
export function checklistProgress(
  source: string | null | undefined,
): { checked: number; total: number } | null {
  const items = parseChecklist(source);
  return items.length
    ? {
        checked: items.filter((item) => item.checked).length,
        total: items.length,
      }
    : null;
}

/** Ticks or unticks the `index`th item (`checked` undefined: the other state). The rest of the text stays exactly as it was. */
export function toggleChecklistItem(
  source: string,
  index: number,
  checked?: boolean,
): string {
  let seen = 0;
  return mapOutsideFences(source, (line) => {
    const match = ITEM.exec(line);
    if (!match || seen++ !== index) return line;
    const mark =
      checked === undefined
        ? match[5] === " "
          ? "x"
          : " "
        : checked
          ? "x"
          : " ";
    return `${match[1]}${match[2]}${match[3]}${match[4]}${mark}${match[6]}${match[7]}`;
  });
}

/** Adds an unchecked item at the end of the body, right after the last item when that is where the body ends. */
export function appendChecklistItem(source: string, label: string): string {
  const item = `- [ ] ${label.trim().replace(/\s+/g, " ")}`;
  const body = source.replace(/\s+$/, "");
  if (!body) return `${item}\n`;
  const lastLine = body.slice(body.lastIndexOf("\n") + 1);
  return `${body}${ITEM.test(lastLine) ? "\n" : "\n\n"}${item}\n`;
}

/** Takes every item out of the body: the items with a label, and the body without their lines (and without extra blank lines). */
export function extractChecklistItems(source: string | null | undefined): {
  items: Array<{ title: string; checked: boolean }>;
  cleanedBody: string;
} {
  if (!source) return { items: [], cleanedBody: "" };
  const items: Array<{ title: string; checked: boolean }> = [];
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of source.split("\n")) {
    const marker = FENCE.exec(line)?.[1];
    if (marker && (fence === null || fence === marker)) {
      fence = fence === null ? marker : null;
      kept.push(line);
      continue;
    }
    const match = fence === null ? ITEM.exec(line) : null;
    if (!match) {
      kept.push(line);
      continue;
    }
    const title = match[7]!.trim();
    if (title) items.push({ title, checked: match[5] !== " " });
  }
  return {
    items,
    cleanedBody: kept
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}
