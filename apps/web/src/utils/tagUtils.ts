/**
 * Tag helpers of the web app. What a tag is (lower case, no leading `#`, no spaces) is decided by `parseTags` in
 * packages/task-filter, which the mobile app uses as well.
 */
import { parseTags } from '@jotter/task-filter';

/** The tags in a text or a list; a space separates tags like a comma does. */
export const sanitizeTags = (tagsInput: string | string[] | null | undefined): string[] => parseTags(tagsInput);

/** The part of a tag field after the last separator: what is being typed now (a tag, or nothing after a separator). */
export function lastTagToken(input: string): string {
  return /[^,;|\s]*$/.exec(input)?.[0] ?? '';
}

/**
 * Normalizes a raw input string from tag input fields into a display string.
 * Strips '#' characters from user typing while maintaining separators.
 */
export function sanitizeTagInputString(input: string): string {
  if (!input) return '';
  return input.replace(/#/g, '');
}
