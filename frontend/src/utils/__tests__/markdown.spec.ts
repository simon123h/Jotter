import { describe, it, expect } from 'vitest';
import { toggleChecklistItemInMarkdown, extractAllChecklistItems } from '../markdown';

describe('markdown utilities', () => {
  describe('toggleChecklistItemInMarkdown', () => {
    it('toggles unchecked item to checked at target index', () => {
      const input = '- [ ] First task\n- [ ] Second task';
      const output = toggleChecklistItemInMarkdown(input, 1, true);
      expect(output).toBe('- [ ] First task\n- [x] Second task');
    });

    it('toggles checked item to unchecked at target index', () => {
      const input = '- [x] Completed task\n- [ ] Pending task';
      const output = toggleChecklistItemInMarkdown(input, 0, false);
      expect(output).toBe('- [ ] Completed task\n- [ ] Pending task');
    });
  });

  describe('extractAllChecklistItems', () => {
    it('extracts all checklist items and removes them from markdown body', () => {
      const input = `# Implementation Plan

Here are initial thoughts.

- [ ] Write unit tests for extraction
- [x] Fix database sync issues
* [ ] Update documentation

End of notes.`;

      const result = extractAllChecklistItems(input);
      expect(result.items).toEqual([
        { title: 'Write unit tests for extraction', checked: false },
        { title: 'Fix database sync issues', checked: true },
        { title: 'Update documentation', checked: false },
      ]);
      expect(result.cleanedBody).toBe(`# Implementation Plan

Here are initial thoughts.

End of notes.`);
    });

    it('handles empty or checklist-free body gracefully', () => {
      const result = extractAllChecklistItems('Just regular paragraph text without lists.');
      expect(result.items).toEqual([]);
      expect(result.cleanedBody).toBe('Just regular paragraph text without lists.');
    });
  });
});
