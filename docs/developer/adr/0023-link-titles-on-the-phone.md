# ADR 0023: Link Titles Are Looked Up on the Phone Only

- **Status**: Accepted
- **Date**: 2026-10-15
- **Related**: [ADR 0017](./0017-mobile-app.md), `docs/developer/features.md`, `docs/user/links.md`

## Context

A bookmark is a task whose title or notes hold a web address, with no extra data in the vault format. When a bare address is added, its title is the address itself, which is hard to read and to search. The page's own title would be better, but reading it means contacting a website. Jotter is local-first: the desktop makes no outbound requests of its own.

A first version looked titles up on both clients, behind an opt-in setting. On the desktop the browser cannot load other sites (cross-origin rules), so the backend had to fetch arbitrary addresses from the user's machine. That needs a guarded fetcher (public hosts only, also after redirects, size and time limits) with known gaps (DNS rebinding), a new backend slice, and a setting, for about 330 lines of code that mostly defend against what the fetch makes possible. The gain is one saved step when adding a link.

## Decision

The title of a page is read **on the phone only**, whenever the task being added is nothing but one web address (typed, pasted or shared). It is on by default and has no setting.

- The app loads the page through the device's network stack (`CapacitorHttp`, which has no cross-origin limit) and reads the title (`og:title`, otherwise `<title>`) in `src/linkTitle.ts`. The address is the only thing sent, and it goes to the site it points to; the user has just chosen to save that address.
- **The desktop looks nothing up.** No endpoint, no setting, no outbound request.
- **A failure is silent.** An unreachable, slow (six seconds) or title-less page leaves the address as the title. A title edited while the look-up runs is never replaced.
- The address moves into the notes (`body`), so the task still links to its page. Nothing about the vault format changes.

## Consequences

- No opt-in: adding a bare link on the phone contacts that link's website. `docs/user/links.md` says so. A user who does not want that types a word next to the address, because only a title that is nothing but the address is looked up.
- The phone has no private-host check. The request goes out from the phone's own network position, and a user can already open any address in the browser.
- The download is not capped in size (the plugin returns the whole body); the six-second limit bounds it.
- Desktop users add titles by hand or paste a title with the address. The domain chip and the "already saved" hint work on both clients.
- If a desktop look-up is wanted later, it should be a new decision: it needs the guarded fetcher this ADR left out.
