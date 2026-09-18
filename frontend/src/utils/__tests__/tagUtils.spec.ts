import { describe, it, expect } from 'vitest';
import { sanitizeTag, sanitizeTags, sanitizeTagInputString } from '../tagUtils';

describe('tagUtils', () => {
  describe('sanitizeTag', () => {
    it('strips leading # characters', () => {
      expect(sanitizeTag('#frontend')).toBe('frontend');
      expect(sanitizeTag('###urgent')).toBe('urgent');
    });

    it('strips inline # characters', () => {
      expect(sanitizeTag('front#end')).toBe('frontend');
    });

    it('converts uppercase to lowercase', () => {
      expect(sanitizeTag('#BugReport')).toBe('bugreport');
    });

    it('replaces spaces with dashes', () => {
      expect(sanitizeTag('#web dev')).toBe('web-dev');
      expect(sanitizeTag('  backend   service  ')).toBe('backend-service');
    });

    it('handles null and undefined', () => {
      expect(sanitizeTag(null)).toBe('');
      expect(sanitizeTag(undefined)).toBe('');
      expect(sanitizeTag('')).toBe('');
    });
  });

  describe('sanitizeTags', () => {
    it('sanitizes and deduplicates string input with commas', () => {
      expect(sanitizeTags('#bug, #feature, bug, #FEATURE')).toEqual(['bug', 'feature']);
    });

    it('sanitizes and deduplicates array input', () => {
      expect(sanitizeTags(['#urgent', 'frontend', '#URGENT', '  backend  '])).toEqual(['urgent', 'frontend', 'backend']);
    });

    it('handles semicolon, pipe, and newline separators', () => {
      expect(sanitizeTags('#alpha; #beta | #gamma\n#delta')).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    });

    it('handles empty or null inputs', () => {
      expect(sanitizeTags(null)).toEqual([]);
      expect(sanitizeTags('')).toEqual([]);
      expect(sanitizeTags([])).toEqual([]);
    });
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
