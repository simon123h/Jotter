# Jotter (mobile)

The mobile app with Jotter's core feature set: vaults, projects, buckets and tasks, attachments, a board with
search and filters. See [ADR 0017](../docs/developer/adr/0017-mobile-app.md) for scope and decisions.

App id `io.github.simon123h.jotter_lite`. It reads and writes vaults through
[`@jotter/vault-format`](../packages/vault-format) and keeps what it does not understand (spec/FORMAT.md).

```
npm install
npm run dev        # browser, for layout work
npm test
npm run cap:sync   # build and copy into the Android project (after `npx cap add android`)
```
