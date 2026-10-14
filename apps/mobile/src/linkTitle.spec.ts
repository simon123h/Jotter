import { describe, it, expect, afterEach } from 'vitest';
import { linkTitles, lookUpTitle, titleOfHtml } from '@/linkTitle';

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
