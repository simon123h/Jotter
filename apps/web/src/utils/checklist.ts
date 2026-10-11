export interface ChecklistItem {
  label: string;
  checked: boolean;
  /** Position among all checklist lines in the body, as used by toggleChecklistItemInMarkdown. */
  globalIndex: number;
  /** Nesting depth relative to the least-indented item. */
  level: number;
}

export interface ChecklistStats {
  checked: number;
  total: number;
}

export interface ParsedChecklist {
  /** Items to display, limited to maxNestingLevel levels below the shallowest item. */
  items: ChecklistItem[];
  /** Counts over every checklist item, including ones hidden by the nesting limit; null when there are none. */
  stats: ChecklistStats | null;
}

const CHECKLIST_LINE = /^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/;

/** Parse the markdown checklist lines of a task body (any indentation; a tab counts as two spaces). */
export function parseChecklist(body: string | null | undefined, maxNestingLevel = 0): ParsedChecklist {
  if (!body) return { items: [], stats: null };

  const raw: ChecklistItem[] = [];
  let minLevel = Infinity;
  let checkedCount = 0;

  for (const line of body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const match = line.match(CHECKLIST_LINE);
    if (!match) continue;

    const level = Math.floor(match[1].replace(/\t/g, '  ').length / 2);
    const checked = match[2].toLowerCase() === 'x';
    if (checked) checkedCount++;
    if (level < minLevel) minLevel = level;
    raw.push({ label: match[3].trim(), checked, globalIndex: raw.length, level });
  }

  if (raw.length === 0) return { items: [], stats: null };

  const effectiveMax = minLevel + maxNestingLevel;
  const items = raw.filter((item) => item.level <= effectiveMax).map((item) => ({ ...item, level: item.level - minLevel }));

  return { items, stats: { checked: checkedCount, total: raw.length } };
}
