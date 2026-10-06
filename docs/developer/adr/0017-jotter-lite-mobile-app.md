# ADR 0017: Jotter Lite, a Separate Mobile App with a Core Feature Set

- **Status**: Accepted
- **Date**: 2026-10-06
- **Related**: [ADR 0006](./0006-dual-runtime-architecture.md), [ADR 0013](./0013-frontend-feature-slices.md), `spec/FORMAT.md`

## Context

The Android app is the desktop frontend running on a Capacitor adapter ([ADR 0006](./0006-dual-runtime-architecture.md)). That has two costs:

- **It does not feel mobile.** The components, layouts and navigation are desktop shaped and bent to fit a phone with responsive classes.
- **Mobile is defined by what it switches off.** Hiding time blocking, the canvas, Git and the like needed `isNativeMobile` checks across about ten files. Every desktop feature adds more of them, and the Tailwind classes that make a layout work on both sizes get harder to follow.

Meanwhile Jotter's core is small: markdown backed kanban boards in vaults, with a set of attributes per task. Most of the desktop app's size is features around that core. The vault format is now specified (`spec/FORMAT.md`) and checked by shared fixtures that both the Python backend and the TypeScript parser must pass, so independent implementations can share vaults safely.

## Decision

Build **Jotter Lite**, a separate mobile app that implements only the core, in a new `mobile/` project in this repository.

- **Identity**: app id `io.github.simon123h.jotter-lite`, name "Jotter Lite". It installs next to the existing Android app, so the two can coexist during the transition.
- **Stack**: Vue 3, Pinia, Tailwind and Capacitor, as in the desktop frontend. Reuse is the point; the UI itself is designed for touch from the start and may look quite different.
- **Scope (version 1)**:
  - vaults: add, switch, remove
  - projects, buckets, and tasks with all their attributes
  - attachments
  - a board view, search and filters, quick add
  - themes and translations
- **Out of scope**: list view and the other views, canvas, time blocking, Git and the Time Machine, the MCP server, iOS, and a browser build. Anything not listed needs an explicit decision before it is added.
- **The vault format is the contract.** Lite and the desktop app agree on the files, not on code. Lite MUST keep what it does not understand: unknown frontmatter keys, unknown files and attachments (`spec/FORMAT.md`, section 5).
- **One shared piece of code.** The markdown parser is the implementation of that contract, so it lives in `packages/vault-format` and is used by both apps. It is covered by the shared fixtures. Everything else is copied into `mobile/` first and extracted later only if it proves identical in both apps.

### Transition

The existing Android build stays until Lite covers the core scope. Then the Android platform, the Capacitor adapter and the mobile branches (`isNativeMobile`, the capability flags for mobile, mobile only settings) are removed from `frontend/`. That removal is the payoff of the split.

## Rationale

- A small scope is the cure for the feature switch spaghetti, and it keeps the code readable.
- A separate app can use mobile navigation and touch patterns without negotiating with desktop components.
- The TypeScript data layer (parser, Capacitor filesystem adapter, Dexie cache) already only exists for mobile, so most of the hard part exists and is covered by tests.
- Sharing only the parser avoids a wrong abstraction, while the fixtures stop the two implementations drifting.

## Consequences

- Two frontends to maintain. Features that exist in both (translations, task rules) are implemented twice until something is proven common and extracted.
- A change to the format must update `spec/FORMAT.md` and the fixtures, and pass in the Python backend and `packages/vault-format`. That is the intended friction.
- Releases gain a second APK. CI builds and tests `mobile/` separately.

## Alternatives Considered

- **Keep one app and add platform shells.** Lowest effort, and the capability flags already centralise feature switches. But the shells would still sit inside the desktop app's build, state and styles, which is the coupling this decision removes.
- **A fork of the desktop frontend.** Fast, but two codebases that drift, with all the desktop code carried along.
- **A native Android app or Flutter.** More native feel, but a new language, no reuse, and a third implementation of everything. It can be revisited if the Capacitor app cannot reach the quality wanted.
- **Split desktop into core and extra backends.** Does not help mobile, which has no Python backend.
- **A web build of Lite.** A browser has no direct file access outside Chromium. Left as a separate experiment; the storage layer stays behind an interface so it can be added.
