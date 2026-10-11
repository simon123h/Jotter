import { computed, ref, type Ref } from 'vue';
import { parseTitleState, getKeywordMatches } from '@jotter/title-parser';
import { locale, t, type MessageKey } from '@/i18n';
import { plannedLabel } from '@/planned';

/** One thing found in a title: a date, a priority, a tag or a column. */
export interface Hint {
  id: string;
  kind: 'date' | 'priority' | 'tag' | 'column';
  label: string;
  /** What the user typed, so that it can be told to stay plain text. */
  keyword: string;
}

export interface Resolved {
  /** The title without what was found in it. */
  title: string;
  bucket: string | null;
  tags: string[];
  due_date: string | null;
  planned_date: string | null;
  priority: string | null;
  /** Anything was found. */
  found: boolean;
}

/**
 * Reads dates (`tomorrow`, `fri`), priorities (`p1`), tags (`#tag`) and columns (`/todo`) out of a title, as the
 * desktop app does. What the user dismisses stays in the title as plain text.
 */
export function useSmartTitle(title: Ref<string>, buckets: () => Array<{ name: string; title: string }>) {
  const ignored = ref<string[]>([]);
  const names = () => buckets().map((b) => b.name);

  const parsed = computed(() => parseTitleState(title.value, locale.value, names(), ignored.value));

  const hints = computed<Hint[]>(() => {
    const p = parsed.value;
    const matches = getKeywordMatches(title.value, locale.value, names(), new Set(ignored.value));
    const keywordOf = (kind: 'priority' | 'bucket') => matches.find((m) => m.type === kind)?.keyword ?? '';
    const list: Hint[] = [];
    if (p.matchedKeyword) {
      const label = p.dueDate ?? (p.plannedDate ? plannedLabel(p.plannedDate) : p.matchedKeyword);
      list.push({ id: 'date', kind: 'date', label, keyword: p.matchedKeyword.toLowerCase() });
    }
    if (p.priority) {
      list.push({ id: 'priority', kind: 'priority', label: t(`priority.${p.priority}` as MessageKey), keyword: keywordOf('priority') });
    }
    if (p.bucket) {
      const column = buckets().find((b) => b.name === p.bucket);
      list.push({ id: 'column', kind: 'column', label: column?.title ?? p.bucket, keyword: keywordOf('bucket') });
    }
    for (const tag of p.tags) list.push({ id: `tag:${tag}`, kind: 'tag', label: `#${tag}`, keyword: `#${tag}` });
    return list.filter((h) => h.keyword);
  });

  function resolve(): Resolved {
    const p = parsed.value;
    return {
      title: p.cleanTitle,
      bucket: p.bucket,
      tags: p.tags,
      due_date: p.matchedKeyword ? p.dueDate : null,
      planned_date: p.matchedKeyword ? p.plannedDate : null,
      priority: p.priority,
      found: hints.value.length > 0,
    };
  }

  /**
   * Backspace right after a recognised keyword takes back the recognition instead of deleting a letter, as on the
   * desktop. It listens to `beforeinput`, which soft keyboards send reliably where `keydown` often says "Unidentified".
   */
  function onBeforeInput(event: InputEvent) {
    const field = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (event.inputType !== 'deleteContentBackward' || !field || field.selectionStart !== field.selectionEnd) return;
    const caret = field.selectionStart;
    const match = getKeywordMatches(title.value, locale.value, names(), new Set(ignored.value)).find((m) => m.end === caret);
    if (!match) return;
    event.preventDefault();
    ignore(match.keyword);
  }

  const ignore = (keyword: string) => {
    if (!ignored.value.includes(keyword)) ignored.value = [...ignored.value, keyword];
  };
  const reset = () => (ignored.value = []);

  return { hints, resolve, ignore, reset, onBeforeInput };
}
