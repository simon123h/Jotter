import { describe, it, expect } from 'vitest';
import { parseTags } from '@jotter/task-filter';
import { sanitizeTags, sanitizeTagInputString, lastTagToken } from '../tagUtils';

// parseTags is shared with the mobile app: what a tag is does not depend on the app
describe('parseTags', () => {
  it('lower-cases tags and strips leading # characters', () => {
    expect(parseTags('#BugReport ###urgent')).toEqual(['bugreport', 'urgent']);
  });

  it('keeps a # inside a tag, as the vault format allows', () => {
    expect(parseTags('front#end')).toEqual(['front#end']);
  });

  it('splits on commas, semicolons, bars, line breaks and spaces, so that "foo bar" is two tags', () => {
    expect(parseTags('foo bar')).toEqual(['foo', 'bar']);
    expect(parseTags('#web dev,  backend   service')).toEqual(['web', 'dev', 'backend', 'service']);
    expect(parseTags('#alpha; #beta | #gamma\n#delta')).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('deduplicates in order, for text and for lists, and splits the items of a list too', () => {
    expect(parseTags('#bug, #feature, bug, #FEATURE')).toEqual(['bug', 'feature']);
    expect(parseTags(['#urgent', 'front end', '#URGENT', '  backend  '])).toEqual(['urgent', 'front', 'end', 'backend']);
  });

  it('handles empty input', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags('')).toEqual([]);
    expect(parseTags([])).toEqual([]);
    expect(parseTags(' , ; #')).toEqual([]);
  });
});

describe('tagUtils', () => {
  it('sanitizeTags is parseTags', () => {
    expect(sanitizeTags('#Foo bar')).toEqual(['foo', 'bar']);
  });

  it('lastTagToken is what is being typed now', () => {
    expect(lastTagToken('bug, fro')).toBe('fro');
    expect(lastTagToken('bug fro')).toBe('fro');
    expect(lastTagToken('bug, ')).toBe('');
    expect(lastTagToken('')).toBe('');
  });

  describe('sanitizeTagInputString', () => {
    it('strips hash symbols while keeping text intact', () => {
      expect(sanitizeTagInputString('#foo, #bar')).toBe('foo, bar');
      expect(sanitizeTagInputString('test#tag')).toBe('testtag');
    });

    it('handles empty input', () => {
      expect(sanitizeTagInputString('')).toBe('');
    });
  });
});
