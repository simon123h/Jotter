import { describe, it, expect } from 'vitest';
import { renderMarkdown, toggleChecklistItem, countChecklistItems } from './markdown';

describe('renderMarkdown', () => {
  it('renders common markdown and checklists', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text and `code`.\n\n- [x] done\n- [ ] open\n');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain('data-check="0"');
    expect(html).toContain('data-check="1"');
    expect(html).not.toContain('disabled');
  });

  it('removes scripts, event handlers and script URLs from untrusted notes', () => {
    const html = renderMarkdown(
      'Hello <script>alert(1)</script> <b onclick="steal()">x</b>\n\n[click](javascript:alert(1))\n\n<iframe src="https://evil.example"></iframe>\n\n<svg onload="x()"></svg>'
    );
    expect(html).not.toMatch(/<script|onclick|onload|javascript:|<iframe|<svg/i);
  });

  it('drops images so that opening a note never loads anything from the network', () => {
    const html = renderMarkdown('![tracker](https://tracker.example/pixel.png)\n\n<img src="https://tracker.example/x.png">');
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toContain('tracker.example');
  });

  it('opens links outside the app and removes form controls other than checkboxes', () => {
    const html = renderMarkdown('[site](https://example.com)\n\n<input type="text" value="x"><button>go</button>');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/type="text"|<button/);
  });
});

describe('checklist toggling', () => {
  const source = '# Plan\n\n- [ ] first\n- [x] second\n  - [ ] nested\n1. [ ] numbered\n\n```\n- [ ] in a code block\n```\n\n- [ ] last\n';

  it('counts the items that render as checkboxes, not those in code blocks', () => {
    expect(countChecklistItems(source)).toBe(5);
  });

  it('flips only the chosen item and leaves the rest of the text alone', () => {
    expect(toggleChecklistItem(source, 0)).toBe(source.replace('- [ ] first', '- [x] first'));
    expect(toggleChecklistItem(source, 1)).toBe(source.replace('- [x] second', '- [ ] second'));
    expect(toggleChecklistItem(source, 3)).toBe(source.replace('1. [ ] numbered', '1. [x] numbered'));
    // The item after the code block is number 4, the one inside the block is skipped
    expect(toggleChecklistItem(source, 4)).toBe(source.replace('- [ ] last', '- [x] last'));
  });

  it('does nothing for an index that does not exist', () => {
    expect(toggleChecklistItem(source, 9)).toBe(source);
  });
});
