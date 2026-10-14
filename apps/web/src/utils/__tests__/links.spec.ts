import { describe, it, expect } from 'vitest';
import { domainOf, isBareUrl, normalizeUrl, taskUrl, urlsIn } from '@jotter/links';

describe('urlsIn', () => {
  it('finds the addresses of a text in reading order', () => {
    expect(urlsIn('first https://a.example/x then http://b.example')).toEqual(['https://a.example/x', 'http://b.example']);
    expect(urlsIn('no link here, only www.example.com and ftp://x.y')).toEqual([]);
  });

  it('leaves the punctuation of a sentence and unmatched brackets out', () => {
    expect(urlsIn('see https://a.example/path.')).toEqual(['https://a.example/path']);
    expect(urlsIn('(https://a.example/path)')).toEqual(['https://a.example/path']);
    expect(urlsIn('[a title](https://a.example/p?q=1)')).toEqual(['https://a.example/p?q=1']);
    expect(urlsIn('"https://a.example/p", and more')).toEqual(['https://a.example/p']);
  });

  it('keeps brackets that belong to the address', () => {
    expect(urlsIn('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
    expect(urlsIn('(https://en.wikipedia.org/wiki/Foo_(bar))')).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)']);
  });
});

describe('taskUrl', () => {
  it('prefers the title, then the notes', () => {
    expect(taskUrl({ title: 'Read https://t.example', body: 'https://b.example' })).toBe('https://t.example');
    expect(taskUrl({ title: 'Read later', body: 'Saw it at\nhttps://b.example/article' })).toBe('https://b.example/article');
    expect(taskUrl({ title: 'Plain', body: 'nothing' })).toBeNull();
    expect(taskUrl({})).toBeNull();
  });
});

describe('isBareUrl', () => {
  it('is true for a text that is only one address', () => {
    expect(isBareUrl(' https://a.example/x ')).toBe(true);
    expect(isBareUrl('https://a.example/x and more')).toBe(false);
    expect(isBareUrl('two https://a.example https://b.example')).toBe(false);
    expect(isBareUrl('plain')).toBe(false);
  });
});

describe('domainOf', () => {
  it('gives the host without www', () => {
    expect(domainOf('https://www.example.com/a?b')).toBe('example.com');
    expect(domainOf('http://news.example.org:8080/')).toBe('news.example.org');
    expect(domainOf('not a url')).toBeNull();
  });
});

describe('normalizeUrl', () => {
  it('makes the addresses of one page equal', () => {
    const same = [
      'https://www.Example.com/post/',
      'http://example.com/post',
      'https://example.com/post#comments',
      'https://example.com/post?utm_source=feed&fbclid=1',
    ].map(normalizeUrl);
    expect(new Set(same).size).toBe(1);
  });

  it('keeps what makes pages differ', () => {
    expect(normalizeUrl('https://example.com/a?id=1')).not.toBe(normalizeUrl('https://example.com/a?id=2'));
    expect(normalizeUrl('https://example.com/a')).not.toBe(normalizeUrl('https://example.com/b'));
    expect(normalizeUrl('https://example.com:8080/a')).not.toBe(normalizeUrl('https://example.com/a'));
  });
});
