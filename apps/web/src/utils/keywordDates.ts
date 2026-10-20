/**
 * The date a keyword in the title stands for (a planned day, or a deadline with `!`), and taking it back. The field keeps
 * what it had before the keyword set it: the keyword going away restores that value, unless the date was changed by
 * hand in the meantime.
 */
export type DateField = 'dueDate' | 'plannedDate';

export function keywordDates(read: (field: DateField) => string, write: (field: DateField, value: string) => void) {
  let set: { field: DateField; value: string; before: string } | null = null;

  const release = () => {
    if (set && read(set.field) === set.value) write(set.field, set.before);
    set = null;
  };

  return {
    /** A keyword was found (or changed): it sets one of the two dates and leaves the other as it is. */
    apply(result: { dueDate: string | null; plannedDate: string | null }) {
      release();
      const field: DateField = result.dueDate ? 'dueDate' : 'plannedDate';
      const value = (result.dueDate || result.plannedDate) ?? '';
      set = { field, value, before: read(field) };
      write(field, value);
    },
    /** The keyword is gone. */
    clear: release,
    /** The form starts again: forget what was set. */
    reset() {
      set = null;
    },
  };
}
