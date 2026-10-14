/**
 * The links in a task: bookmarks are tasks whose title or notes hold an address. Nothing is stored apart from the text,
 * so the link of a task is whatever the first address in its title or body is (spec/FORMAT.md, "Body").
 */

const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;
const TRAILING = /[.,;:!?'"*_]+$/;
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_eid|igshid|ref_src)$/i;

const OPENING: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
const count = (text: string, char: string) => text.split(char).length - 1;

/** Takes the punctuation of a sentence, and a closing bracket without an opening one, off the end of a match. */
function trimUrl(raw: string): string {
  let url = raw.replace(TRAILING, "");
  for (;;) {
    const last = url.slice(-1);
    const open = OPENING[last];
    if (!open || count(url, open) >= count(url, last)) return url;
    url = url.slice(0, -1).replace(TRAILING, "");
  }
}

/** Every web address in a text, in reading order. */
export function urlsIn(text: string): string[] {
  return (text.match(URL_PATTERN) ?? [])
    .map(trimUrl)
    .filter(
      (url) =>
        /^https?:\/\/[^/?#.]+\./i.test(url) ||
        /^https?:\/\/localhost\b/i.test(url),
    );
}

/** The first web address of a task: in its title, otherwise in its notes. */
export function taskUrl(task: {
  title?: string;
  body?: string;
}): string | null {
  return urlsIn(task.title ?? "")[0] ?? urlsIn(task.body ?? "")[0] ?? null;
}

/** The text is nothing but one web address. */
export function isBareUrl(text: string): boolean {
  const trimmed = text.trim();
  const found = urlsIn(trimmed);
  return found.length === 1 && found[0] === trimmed;
}

/** The host of an address without `www.`, as the chip on a card shows it. Null when it is not an address. */
export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

/** Two addresses of the same page compare equal: no `www.`, fragment, trailing slash, tracking parameters or case in the host. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()])
      if (TRACKING.test(key)) parsed.searchParams.delete(key);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "");
    const query = parsed.searchParams.toString();
    return `${host}${parsed.port ? `:${parsed.port}` : ""}${path}${query ? `?${query}` : ""}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
