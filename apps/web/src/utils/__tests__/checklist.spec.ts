import { describe, it, expect } from 'vitest';
import { parseChecklist } from '../checklist';

describe('parseChecklist', () => {
  it('returns nothing for an empty body or a body without checklists', () => {
    expect(parseChecklist('')).toEqual({ items: [], stats: null });
    expect(parseChecklist(undefined)).toEqual({ items: [], stats: null });
    expect(parseChecklist('just text\n- plain bullet')).toEqual({ items: [], stats: null });
  });

  it('parses items with checked state and a stable global index', () => {
    const { items, stats } = parseChecklist('- [ ] one\ntext\n* [x] two\n+ [X] three');
    expect(items.map((i) => [i.label, i.checked, i.globalIndex])).toEqual([
      ['one', false, 0],
      ['two', true, 1],
      ['three', true, 2],
    ]);
    expect(stats).toEqual({ checked: 2, total: 3 });
  });

  it('hides nested items beyond maxNestingLevel but still counts them in the stats', () => {
    const body = '- [ ] top\n  - [x] child\n    - [ ] grandchild';
    const level0 = parseChecklist(body, 0);
    expect(level0.items.map((i) => i.label)).toEqual(['top']);
    expect(level0.stats).toEqual({ checked: 1, total: 3 });

    expect(parseChecklist(body, 1).items.map((i) => [i.label, i.level])).toEqual([
      ['top', 0],
      ['child', 1],
    ]);
  });

  it('normalizes levels relative to the shallowest item and treats a tab as two spaces', () => {
    const { items } = parseChecklist('    - [ ] a\n\t\t- [ ] b', 1);
    expect(items.map((i) => i.level)).toEqual([0, 0]);
  });

  it('handles CRLF line endings', () => {
    expect(parseChecklist('- [ ] a\r\n- [x] b').stats).toEqual({ checked: 1, total: 2 });
  });
});
