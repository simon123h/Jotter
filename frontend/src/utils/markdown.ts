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

/**
 * Extracts all checklist items (both open and completed) from a Markdown string,
 * returning the list of items and the remaining body with the checklist items removed.
 *
 * @param body - The markdown body text
 * @returns Object with the extracted items and the cleaned remaining body
 */
export function extractAllChecklistItems(body: string): {
  items: Array<{ title: string; checked: boolean }>;
  cleanedBody: string;
} {
  if (!body) return { items: [], cleanedBody: '' };

  const lines = body.split('\n');
  const items: Array<{ title: string; checked: boolean }> = [];
  const remainingLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/);
    if (match) {
      const title = match[3].trim();
      if (title) {
        items.push({
          title,
          checked: match[2].toLowerCase() === 'x',
        });
      }
    } else {
      remainingLines.push(line);
    }
  }

  const cleaned = remainingLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    items,
    cleanedBody: cleaned,
  };
}
