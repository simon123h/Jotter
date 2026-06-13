/**
 * Helper to update/toggle a checklist checkbox's checked state in a Markdown string at a specific index.
 * Matches any standard markdown list item checkboxes like '- [ ]', '* [x]', or '+ [X]'.
 *
 * @param body - The markdown body text containing checklist items
 * @param targetIndex - The index of the checkbox to toggle (0-based, counting matching checkbox lines from the top)
 * @param isChecked - The new boolean checked state
 * @returns The updated markdown body string
 */
export function toggleChecklistItemInMarkdown(body: string, targetIndex: number, isChecked: boolean): string {
  let currentIndex = 0;
  const regex = /(^|\n)(\s*[-*+]\s+\[)([ xX])(\])/g;

  return body.replace(regex, (match, p1, p2, _p3, p4) => {
    if (currentIndex === targetIndex) {
      currentIndex++;
      const newChar = isChecked ? 'x' : ' ';
      return p1 + p2 + newChar + p4;
    }
    currentIndex++;
    return match;
  });
}
