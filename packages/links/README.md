# links

The web addresses in a task, shared by the desktop app (`apps/web/`) and the mobile app (`apps/mobile/`). A bookmark is a task
whose title or notes hold an address; nothing else is stored.

- `urlsIn(text)` gives the addresses of a text. The punctuation of a sentence and a closing bracket that has no opening one are not part of
  the address, so `see (https://a.b/c).` gives `https://a.b/c`.
- `taskUrl(task)` is the first address of the title, otherwise of the notes.
- `isBareUrl(text)` tells whether the text is only an address (a shared link, a pasted one).
- `domainOf(url)` is the host without `www.`, what the chip on a card shows.
- `normalizeUrl(url)` makes two addresses of the same page equal: no `www.`, fragment, trailing slash or tracking parameters (`utm_*`, `fbclid`, ...).

The tests are in `apps/web/src/utils/__tests__/links.spec.ts`.
