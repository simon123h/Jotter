# ADR 0023: Link Titles Are Looked Up Only on Request

- **Status**: Accepted
- **Date**: 2026-10-15
- **Related**: [ADR 0017](./0017-mobile-app.md), `docs/developer/features.md`, `docs/user/links.md`

## Context

A bookmark is a task whose title or notes hold a web address, with no extra data in the vault format. When a bare address is added, its title is the address itself, which is hard to read and to search. The page's own title would be better, but reading it means contacting a website. Jotter is local-first: until now it made no outbound requests of its own.

## Decision

Reading the title of a page is an **optional setting that is off by default**, on both clients, and it only runs when the task being added is nothing but one web address.

- **Mobile**: the app loads the page through the device's network stack (`CapacitorHttp`, which has no cross-origin limit) and reads the title (`og:title`, otherwise `<title>`) in `src/linkTitle.ts`. The switch is a device preference.
- **Desktop**: the browser cannot load other sites (cross-origin rules), so the backend does it: `POST /api/links/title` in `features/links`. The switch is `lookUpLinkTitles` in the vault's `settings.json`, and **the endpoint checks it** itself, so a client cannot make the server fetch while it is off.
- **The server fetch is bounded.** Only `http` and `https`; no host that resolves to a loopback, private, link-local or otherwise non-public address, also after every redirect (a task title can come from anywhere, so the address is not trusted); six seconds in all; at most 512 KB; HTML only. It uses the standard library, so no new dependency.
- **A failure is silent.** An unreachable, slow or title-less page leaves the address as the title. A title edited while the look-up runs is never replaced.
- The address moves into the notes (`body`), so the task still links to its page. Nothing about the vault format changes.

## Consequences

- With the setting on, the address of every bare link added is sent to its website (from the phone, or from the machine running the server). The settings page says so.
- The check of the host happens before the connection, so a DNS answer that changes in between could still pass it (DNS rebinding). The server is a single-user local app and the response is only read for a title, so we accept that.
- The static demo has no server and never looks anything up.
- Page archiving, thumbnails and favicons are out of scope: they would need storage and background work that a vault of small Markdown files does not suit.
