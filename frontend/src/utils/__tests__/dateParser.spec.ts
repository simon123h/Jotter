import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDateFromTitle, extractTagsFromTitle, parseTitleState } from '../dateParser';

describe('dateParser', () => {
  beforeEach(() => {
    // Mock system time to Wednesday, June 3, 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('English locale', () => {
    it('should parse "today" correctly', () => {
      const result = parseDateFromTitle('today buy groceries', 'en');
      expect(result.dueDate).toBe('2026-06-03');
      expect(result.cleanTitle).toBe('buy groceries');
      expect(result.matchedKeyword?.toLowerCase()).toBe('today');
    });

    it('should parse "tod" abbreviation correctly', () => {
      const result = parseDateFromTitle('buy groceries tod', 'en');
      expect(result.dueDate).toBe('2026-06-03');
      expect(result.cleanTitle).toBe('buy groceries');
      expect(result.matchedKeyword?.toLowerCase()).toBe('tod');
    });

    it('should parse "tomorrow" correctly', () => {
      const result = parseDateFromTitle('tomorrow call John', 'en');
      expect(result.dueDate).toBe('2026-06-04');
      expect(result.cleanTitle).toBe('call John');
    });

    it('should parse "tom" abbreviation correctly', () => {
      const result = parseDateFromTitle('call John tom', 'en');
      expect(result.dueDate).toBe('2026-06-04');
      expect(result.cleanTitle).toBe('call John');
    });

    it('should parse "next week" correctly', () => {
      const result = parseDateFromTitle('next week submit report', 'en');
      expect(result.dueDate).toBe('2026-06-10');
      expect(result.cleanTitle).toBe('submit report');
    });

    it('should parse "next month" correctly', () => {
      const result = parseDateFromTitle('submit report next month', 'en');
      expect(result.dueDate).toBe('2026-07-03');
      expect(result.cleanTitle).toBe('submit report');
    });

    it('should parse weekday "monday" correctly (should resolve to next Monday, June 8th)', () => {
      const result = parseDateFromTitle('monday meeting', 'en');
      expect(result.dueDate).toBe('2026-06-08');
      expect(result.cleanTitle).toBe('meeting');
    });

    it('should parse weekday abbreviation "mon" correctly', () => {
      const result = parseDateFromTitle('meeting mon', 'en');
      expect(result.dueDate).toBe('2026-06-08');
      expect(result.cleanTitle).toBe('meeting');
    });

    it('should parse explicit date MM/DD correctly', () => {
      const result = parseDateFromTitle('party 10/24', 'en');
      expect(result.dueDate).toBe('2026-10-24');
      expect(result.cleanTitle).toBe('party');
    });

    it('should shift explicit date MM/DD to next year if it has already passed in current year', () => {
      // May 21 has already passed on June 3, 2026, so it should resolve to 2027-05-21
      const result = parseDateFromTitle('old event 5/21', 'en');
      expect(result.dueDate).toBe('2027-05-21');
      expect(result.cleanTitle).toBe('old event');
    });

    it('should parse explicit date MM/DD/YYYY correctly', () => {
      const result = parseDateFromTitle('party 12/31/2028', 'en');
      expect(result.dueDate).toBe('2028-12-31');
      expect(result.cleanTitle).toBe('party');
    });
  });

  describe('German locale', () => {
    it('should parse "heute" correctly', () => {
      const result = parseDateFromTitle('heute einkaufen', 'de');
      expect(result.dueDate).toBe('2026-06-03');
      expect(result.cleanTitle).toBe('einkaufen');
    });

    it('should parse "heu" abbreviation correctly', () => {
      const result = parseDateFromTitle('einkaufen heu', 'de');
      expect(result.dueDate).toBe('2026-06-03');
      expect(result.cleanTitle).toBe('einkaufen');
    });

    it('should parse "morgen" correctly', () => {
      const result = parseDateFromTitle('morgen Hausaufgaben machen', 'de');
      expect(result.dueDate).toBe('2026-06-04');
      expect(result.cleanTitle).toBe('Hausaufgaben machen');
    });

    it('should parse "nächste woche" correctly', () => {
      const result = parseDateFromTitle('nächste Woche Bericht abgeben', 'de');
      expect(result.dueDate).toBe('2026-06-10');
      expect(result.cleanTitle).toBe('Bericht abgeben');
    });

    it('should parse weekday "montag" correctly', () => {
      const result = parseDateFromTitle('montag Meeting', 'de');
      expect(result.dueDate).toBe('2026-06-08');
      expect(result.cleanTitle).toBe('Meeting');
    });

    it('should parse explicit German date DD.MM. correctly', () => {
      const result = parseDateFromTitle('Geburtstag 24.10.', 'de');
      expect(result.dueDate).toBe('2026-10-24');
      expect(result.cleanTitle).toBe('Geburtstag');
    });

    it('should shift explicit German date DD.MM. to next year if it has already passed', () => {
      // May 21 has already passed on June 3, 2026
      const result = parseDateFromTitle('Event 21.5.', 'de');
      expect(result.dueDate).toBe('2027-05-21');
      expect(result.cleanTitle).toBe('Event');
    });

    it('should parse explicit German date DD.MM.YYYY correctly', () => {
      const result = parseDateFromTitle('Event 21.5.2028', 'de');
      expect(result.dueDate).toBe('2028-05-21');
      expect(result.cleanTitle).toBe('Event');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty or null titles', () => {
      const result = parseDateFromTitle('', 'en');
      expect(result.dueDate).toBeNull();
      expect(result.cleanTitle).toBe('');
    });

    it('should handle titles with no match', () => {
      const result = parseDateFromTitle('just standard task title', 'en');
      expect(result.dueDate).toBeNull();
      expect(result.cleanTitle).toBe('just standard task title');
    });
  });

  describe('Tag extraction', () => {
    it('should extract single hashtag correctly', () => {
      const result = extractTagsFromTitle('buy groceries #food');
      expect(result.tags).toEqual(['food']);
      expect(result.cleanTitle).toBe('buy groceries');
    });

    it('should extract multiple hashtags correctly', () => {
      const result = extractTagsFromTitle('#shopping buy groceries #food');
      expect(result.tags).toEqual(['shopping', 'food']);
      expect(result.cleanTitle).toBe('buy groceries');
    });

    it('should support German umlauts in tags', () => {
      const result = extractTagsFromTitle('einkaufen #küche #wichtig');
      expect(result.tags).toEqual(['küche', 'wichtig']);
      expect(result.cleanTitle).toBe('einkaufen');
    });
  });

  describe('Unified parseTitleState', () => {
    it('should extract both tags and dates correctly', () => {
      const result = parseTitleState('today buy groceries #food #shopping', 'en');
      expect(result.dueDate).toBe('2026-06-03');
      expect(result.tags).toEqual(['food', 'shopping']);
      expect(result.cleanTitle).toBe('buy groceries');
    });
  });
});
