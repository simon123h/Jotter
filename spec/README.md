# Vault format spec and conformance fixtures

- [`FORMAT.md`](FORMAT.md): the vault format every Jotter implementation follows.
- [`fixtures/`](fixtures): sample files and the expected result of reading them.

## Fixtures

```
fixtures/tasks/<case>.md        a task file
fixtures/tasks/<case>.json      { description, context, expected }
fixtures/projects/<case>.md     an index.md manifest
fixtures/projects/<case>.json   { description, context, expected }
```

`context` holds what the parser needs besides the file content (`file_stem` and `default_project_id` for tasks,
`dir_name` for projects). `expected` is the normalized result. Timestamps (`created_at`, `updated_at`) are only
compared when `expected` contains them, because they default to "now".

Each implementation must pass two checks per case:

1. **Read**: parsing the `.md` file gives `expected`.
2. **Round trip**: writing that result back out and parsing it again still gives `expected`. This is what
   protects unknown frontmatter keys.

## Runners

| Implementation | Runner | Command |
| :-- | :-- | :-- |
| Python backend | `tests/test_format_conformance.py` | `pytest tests/test_format_conformance.py` |
| TypeScript parser (mobile) | `packages/vault-format/src/formatConformance.spec.ts` | `npm --prefix packages/vault-format test` |

A new implementation only needs a small runner that loads these files and compares the same normalized view.

## Adding a case

1. Write the `.md` file the way another tool or an older version might produce it.
2. Write the `.json` file with the result the spec asks for. Do not copy the output of an implementation, check
   `FORMAT.md` instead. If the spec is silent, decide, and add the rule to `FORMAT.md` in the same change.
3. Run all runners. A failure in one implementation is a bug to fix, or an entry in that runner's
   `KNOWN_DIVERGENCES` with a reason until it is fixed.
