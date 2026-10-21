/**
 * The dates the keywords in the title stand for (a planned day, and a deadline with `!`), and taking them back. A field
 * keeps what it had before a keyword set it: the keyword going away restores that value, unless the date was changed by
 * hand in the meantime.
 */
export type DateField = 'dueDate' | 'plannedDate';

export function keywordDates(read: (field: DateField) => string, write: (field: DateField, value: string) => void) {
  let set: Array<{ field: DateField; value: string; before: string }> = [];

  const release = () => {
    for (const s of set) if (read(s.field) === s.value) write(s.field, s.before);
    set = [];
  };

  return {
    /** Keywords were found (or changed): each sets its own date and leaves the other as it is. */
    apply(result: { dueDate: string | null; plannedDate: string | null }) {
      release();
      for (const field of ['plannedDate', 'dueDate'] as const) {
        const value = result[field];
        if (!value) continue;
        set.push({ field, value, before: read(field) });
        write(field, value);
      }
    },
    /** The keywords are gone. */
    clear: release,
    /** The form starts again: forget what was set. */
    reset() {
      set = [];
    },
  };
}
