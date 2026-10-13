import { parseChecklist as parseChecklistItems } from '@jotter/checklist';

export interface ChecklistItem {
  label: string;
  checked: boolean;
  /** Position among all checklist lines in the body, as used by toggleChecklistItem. */
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

/** The checklist of a task body: the items to show, limited to `maxNestingLevel` levels below the shallowest item. */
export function parseChecklist(body: string | null | undefined, maxNestingLevel = 0): ParsedChecklist {
  const all = parseChecklistItems(body);
  if (all.length === 0) return { items: [], stats: null };

  const minLevel = Math.min(...all.map((item) => item.indent));
  const items = all
    .filter((item) => item.indent <= minLevel + maxNestingLevel)
    .map((item) => ({ label: item.label, checked: item.checked, globalIndex: item.index, level: item.indent - minLevel }));

  return { items, stats: { checked: all.filter((item) => item.checked).length, total: all.length } };
}
