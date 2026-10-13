import { describe, it, expect } from 'vitest';
import {
  appendChecklistItem,
  checklistProgress,
  countChecklistItems,
  extractChecklistItems,
  parseChecklist as parseItems,
  toggleChecklistItem,
} from '@jotter/checklist';
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

// The functions of packages/checklist, which the desktop and the mobile app both use
describe('checklist items of a body', () => {
  const source = '# Plan\n\n- [ ] first\n- [x] second\n  - [ ] nested\n1. [ ] numbered\n\n```\n- [ ] in a code block\n```\n\n- [ ] last\n';

  it('counts the items that render as checkboxes, not those in code blocks', () => {
    expect(countChecklistItems(source)).toBe(5);
    expect(parseItems(source).map((i) => i.label)).toEqual(['first', 'second', 'nested', 'numbered', 'last']);
  });

  it('knows items in quotes and with any list marker, and the indentation', () => {
    const items = parseItems('> - [ ] quoted\n* [X] star\n+ [ ] plus\n2) [ ] paren\n\t- [ ] tab');
    expect(items.map((i) => [i.label, i.checked, i.indent])).toEqual([
      ['quoted', false, 0],
      ['star', true, 0],
      ['plus', false, 0],
      ['paren', false, 0],
      ['tab', false, 1],
    ]);
    expect(parseItems('- plain bullet\n[ ] no marker\n-[ ] no space')).toEqual([]);
  });

  it('flips only the chosen item and leaves the rest of the text alone', () => {
    expect(toggleChecklistItem(source, 0)).toBe(source.replace('- [ ] first', '- [x] first'));
    expect(toggleChecklistItem(source, 1)).toBe(source.replace('- [x] second', '- [ ] second'));
    expect(toggleChecklistItem(source, 3)).toBe(source.replace('1. [ ] numbered', '1. [x] numbered'));
    // The item after the code block is number 4, the one inside the block is skipped
    expect(toggleChecklistItem(source, 4)).toBe(source.replace('- [ ] last', '- [x] last'));
    expect(toggleChecklistItem(source, 9)).toBe(source);
  });

  it('can set the state instead of flipping it, and keeps Windows line ends', () => {
    expect(toggleChecklistItem('- [ ] a\n- [x] b', 1, true)).toBe('- [ ] a\n- [x] b');
    expect(toggleChecklistItem('- [x] a\n- [ ] b', 0, false)).toBe('- [ ] a\n- [ ] b');
    expect(toggleChecklistItem('- [ ] a\r\n- [ ] b\r\n', 1)).toBe('- [ ] a\r\n- [x] b\r\n');
  });

  it('counts ticked and total items, ignoring code blocks', () => {
    expect(checklistProgress('Text only')).toBeNull();
    expect(checklistProgress('- [x] one\n- [ ] two\n  - [X] nested\n```\n- [ ] in code\n```\n')).toEqual({ checked: 2, total: 3 });
  });

  it('appends an item, next to the list it ends with', () => {
    expect(appendChecklistItem('', 'first')).toBe('- [ ] first\n');
    expect(appendChecklistItem('- [x] a\n', ' b  c ')).toBe('- [x] a\n- [ ] b c\n');
    expect(appendChecklistItem('Some notes\n', 'a')).toBe('Some notes\n\n- [ ] a\n');
  });

  it('takes the items out of a body and tidies the rest', () => {
    const input =
      '# Implementation Plan\n\nHere are initial thoughts.\n\n- [ ] Write unit tests\n- [x] Fix sync\n* [ ] Update documentation\n\nEnd of notes.';
    expect(extractChecklistItems(input)).toEqual({
      items: [
        { title: 'Write unit tests', checked: false },
        { title: 'Fix sync', checked: true },
        { title: 'Update documentation', checked: false },
      ],
      cleanedBody: '# Implementation Plan\n\nHere are initial thoughts.\n\nEnd of notes.',
    });
    expect(extractChecklistItems('Just text.')).toEqual({ items: [], cleanedBody: 'Just text.' });
    expect(extractChecklistItems('')).toEqual({ items: [], cleanedBody: '' });
    // Items in a code block stay where they are
    expect(extractChecklistItems('```\n- [ ] code\n```').items).toEqual([]);
  });
});
