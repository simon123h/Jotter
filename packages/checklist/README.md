# checklist

The checklists in the notes of a task (`- [ ] buy milk`), shared by the desktop app (`apps/web/`) and the mobile app
(`apps/mobile/`), so that a note shows the same progress on both.

- `parseChecklist(body)` gives the items: label, checked, index (0-based, in reading order) and indentation.
- `countChecklistItems`, `checklistProgress` count them.
- `toggleChecklistItem(body, index, checked?)` ticks or unticks one item and leaves the rest of the text exactly as it was.
- `appendChecklistItem(body, label)` adds an item at the end.
- `extractChecklistItems(body)` takes the items out of the body, for turning them into tasks.

An item is a list line (`-`, `*`, `+`, `1.` or `1)`, also inside a quote) with `[ ]` or `[x]` after the marker. Lines in fenced
code blocks are text. The index is the same as the number of the checkbox in the rendered note. The tests are in
`apps/web/src/utils/__tests__/checklist.spec.ts`.
