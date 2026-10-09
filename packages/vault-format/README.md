# @jotter/vault-format

Reads and writes the Jotter vault format ([`spec/FORMAT.md`](../../spec/FORMAT.md)): task files and project
manifests. It is the TypeScript implementation of the format and is shared by the mobile apps. The Python
backend implements the same spec separately.

The shared fixtures in `spec/fixtures` are run against it by `src/formatConformance.spec.ts`:

```
npm test
```

It has no build step. Apps import the TypeScript source through an alias (`@jotter/vault-format`).
