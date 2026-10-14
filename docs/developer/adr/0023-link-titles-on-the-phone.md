# ADR 0023: Link Titles Are Looked Up on the Phone Only

- **Status**: Accepted
- **Date**: 2026-10-15
- **Related**: [ADR 0017](./0017-mobile-app.md), `docs/developer/features.md`, `docs/user/links.md`

## Context

A bookmark is a task whose title or notes hold a web address, with no extra data in the vault format. When a bare address is added, its title is the address itself, which is hard to read and to search. The page's own title would be better, but reading it means contacting a website. Jotter is local-first: the desktop makes no outbound requests of its own.

A first version looked titles up on both clients, behind an opt-in setting. On the desktop the browser cannot load other sites (cross-origin rules), so the backend had to fetch arbitrary addresses from the user's machine. That needs a guarded fetcher (public hosts only, also after redirects, size and time limits) with known gaps (DNS rebinding), a new backend slice, and a setting, for about 330 lines of code that mostly defend against what the fetch makes possible. The gain is one saved step when adding a link.

## Decision

The title of a page is read **on the phone only**, whenever the task being added is nothing but one web address that **arrives at once**: shared from another app, or pasted (also the clipboard suggestion of the keyboard). An address typed letter by letter is never looked up, because on the way it passes through addresses that are no site the user chose (`https://example.co` on the way to `.com`). It is on by default and has no setting.

- The app loads the page through the device's network stack (`CapacitorHttp`, which has no cross-origin limit) and reads the title (`og:title`, otherwise `<title>`) in `src/linkTitle.ts`. The address is the only thing sent, and it goes to the site it points to; the user has just chosen to save that address.
- **The desktop looks nothing up.** No endpoint, no setting, no outbound request.
- **The request asks for the first 256 KB** (`Range`), because a title is at the top of a page. A server that ignores `Range` sends the whole body, and the plugin cannot stop a download once it has started: the six seconds only decide when the app stops waiting. A link to a big file on such a server can therefore still be downloaded in the background. We accept that: it needs a bare link to a large file on a server that ignores `Range`, and the user has just chosen to save it.
- **A failure is silent.** An unreachable, slow (six seconds) or title-less page leaves the address as the title. A title edited while the look-up runs is never replaced.
- The address moves into the notes (`body`), so the task still links to its page. Nothing about the vault format changes.

## Consequences

- No opt-in: adding a bare link on the phone contacts that link's website. `docs/user/links.md` says so. A user who does not want that types a word next to the address, because only a title that is nothing but the address is looked up.
- The phone has no private-host check. The request goes out from the phone's own network position, and a user can already open any address in the browser.
- Android blocks unencrypted `http` addresses for apps by default, so in practice only `https` pages are read.
- Desktop users add titles by hand or paste a title with the address. The domain chip and the "already saved" hint work on both clients.
- If a desktop look-up is wanted later, it should be a new decision: it needs the guarded fetcher this ADR left out.
