/**
 * The file name (and so the id) of a new task, from its title (spec/FORMAT.md, "File names of new tasks").
 * The Python backend writes the same names (`src/jotter/shared/slug.py`); `spec/fixtures/filenames/slug.json` checks both.
 */

const SPELLED_OUT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd' };
const MAX_LENGTH = 60;
const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Not tasks (the manifest and a readme) or not usable as file names on Windows. */
export const RESERVED_TASK_NAMES = new Set([
  'index',
  'readme',
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/** The name before any suffix for a taken name. */
export function taskSlug(title: string): string {
  const spelled = Array.from(title.toLowerCase(), (c) => SPELLED_OUT[c] ?? c).join('');
  const text = spelled
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (text.length <= MAX_LENGTH) return text || 'task';
  const cut = text.slice(0, MAX_LENGTH + 1).lastIndexOf('-');
  return cut > 0 ? text.slice(0, cut) : text.slice(0, MAX_LENGTH);
}

/** The slug itself when it is free, otherwise the slug with `-` and four random characters, until one is free. */
export async function uniqueTaskName(slug: string, isTaken: (name: string) => Promise<boolean>): Promise<string> {
  let name = slug;
  while (RESERVED_TASK_NAMES.has(name) || (await isTaken(name))) {
    const random = crypto.getRandomValues(new Uint8Array(4));
    name = `${slug}-${Array.from(random, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('')}`;
  }
  return name;
}
