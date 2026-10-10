/**
 * Utility functions for tag normalization and validation across the frontend.
 *
 * Ensures tags are clean, stripped of `#` prefixes/symbols, normalized to lowercase,
 * and safe for YAML frontmatter serialization without comment collisions or syntax issues.
 */

/**
 * Sanitizes a single tag string:
 * - Strips any leading '#' or '#' inside words
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips spaces within tags (or replaces them)
 */
export function sanitizeTag(tag: string | null | undefined): string {
  if (!tag) return '';
  return String(tag).trim().replace(/^#+/, '').replace(/#/g, '').replace(/\s+/g, '-').toLowerCase();
}

/**
 * Sanitizes a comma/separator-delimited string of tags or array of tags into a clean string array.
 * Deduplicates and removes empty entries.
 */
export function sanitizeTags(tagsInput: string | string[] | null | undefined): string[] {
  if (!tagsInput) return [];

  const rawTags = Array.isArray(tagsInput) ? tagsInput : String(tagsInput).split(/[,;|\n]+/);

  const resultSet = new Set<string>();
  for (const raw of rawTags) {
    const cleaned = sanitizeTag(raw);
    if (cleaned.length > 0) {
      resultSet.add(cleaned);
    }
  }

  return Array.from(resultSet);
}

/**
 * Normalizes a raw input string from tag input fields into a display string.
 * Strips '#' characters from user typing while maintaining comma separation.
 */
export function sanitizeTagInputString(input: string): string {
  if (!input) return '';
  return input.replace(/#/g, '');
}
