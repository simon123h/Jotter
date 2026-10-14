import { describe, it, expect, afterEach, vi } from 'vitest';
import { CapacitorHttp } from '@capacitor/core';
import { linkTitles, lookUpTitle, titleOfHtml } from '@/linkTitle';

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  CapacitorHttp: { get: vi.fn() },
}));

const realPort = linkTitles.port;
afterEach(() => (linkTitles.port = realPort));

describe('titleOfHtml', () => {
  it('prefers the open graph title and tidies the text', () => {
    const html = '<head><meta property="og:title" content="The &amp; real title"><title>Site - The real title</title></head>';
    expect(titleOfHtml(html)).toBe('The & real title');
    expect(titleOfHtml('<title>\n  Just   the\ttitle \n</title>')).toBe('Just the title');
    expect(titleOfHtml('<meta name="twitter:title" content="Tweeted"><p>x</p>')).toBe('Tweeted');
  });

  it('gives nothing for a page without a title, and cuts a very long one', () => {
    expect(titleOfHtml('<p>no title</p>')).toBeNull();
    expect(titleOfHtml('<title>   </title>')).toBeNull();
    expect(titleOfHtml(`<title>${'x'.repeat(500)}</title>`)).toHaveLength(200);
  });

  it('does not run scripts or load anything from the page', () => {
    (window as unknown as { ran?: boolean }).ran = false;
    titleOfHtml('<title>t</title><script>window.ran = true</script><img src="https://example.com/x.png" onerror="window.ran = true">');
    expect((window as unknown as { ran?: boolean }).ran).toBe(false);
  });
});

describe('lookUpTitle', () => {
  it('gives the title the port finds, and null when it fails', async () => {
    linkTitles.port = async () => 'Found';
    expect(await lookUpTitle('https://example.com')).toBe('Found');
    linkTitles.port = async () => {
      throw new Error('offline');
    };
    expect(await lookUpTitle('https://example.com')).toBeNull();
  });
});

describe('the request', () => {
  it('asks for the top of the page only, so that a link to a big file is not downloaded in full', async () => {
    const get = vi.mocked(CapacitorHttp.get).mockResolvedValue({
      status: 206,
      headers: { 'content-type': 'text/html' },
      data: '<title>Partial</title>',
      url: 'https://example.com',
    });
    expect(await lookUpTitle('https://example.com/a')).toBe('Partial');
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ headers: expect.objectContaining({ Range: 'bytes=0-262143' }) }));
  });
});
