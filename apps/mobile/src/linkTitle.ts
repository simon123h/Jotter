import { CapacitorHttp } from '@capacitor/core';

/** How long a page may take before the task keeps its address as its title. */
const TIMEOUT_MS = 6000;
const MAX_CHARS = 512 * 1024;
const MAX_TITLE = 200;

/** The title of an HTML page: the open graph title when there is one, otherwise the title element. */
export function titleOfHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html.slice(0, MAX_CHARS), 'text/html');
  const meta = (name: string) => doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content') ?? '';
  const found = meta('og:title').trim() || doc.title.trim() || meta('twitter:title').trim();
  return found.replace(/\s+/g, ' ').slice(0, MAX_TITLE).trim() || null;
}

/** Loads the page through the device's own network stack, which is not held back by the browser's cross-origin rules. */
async function fetchFromDevice(url: string): Promise<string | null> {
  const response = await CapacitorHttp.get({
    url,
    // The title is at the top of a page: ask for its first 256 KB, so that a link to a big file is not downloaded in full
    headers: { Accept: 'text/html,application/xhtml+xml', Range: 'bytes=0-262143' },
    connectTimeout: TIMEOUT_MS,
    readTimeout: TIMEOUT_MS,
    responseType: 'text',
  });
  const type = String(response.headers?.['Content-Type'] ?? response.headers?.['content-type'] ?? '');
  if (response.status >= 400 || (type && !type.toLowerCase().includes('html')) || typeof response.data !== 'string') return null;
  return titleOfHtml(response.data);
}

/** Tests replace the port, so that no page is loaded. */
export const linkTitles = { port: fetchFromDevice };

/** The title of the page at an address, or null when it cannot be read in time: a failed look-up is not an error. */
export async function lookUpTitle(url: string): Promise<string | null> {
  try {
    return await Promise.race([linkTitles.port(url), new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS + 1000))]);
  } catch {
    return null;
  }
}
