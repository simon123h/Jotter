#!/usr/bin/env node
// Makes the paths in an lcov report relative to the repository root, as Codecov expects them.
// The apps run their tests from their own folder, so their reports say `src/App.vue` and, for the shared
// packages, `../../packages/themes/index.ts`.
//
//   node scripts/lcov-paths.mjs apps/web apps/web/coverage/lcov.info
import { readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';

const [folder, file] = process.argv.slice(2);
if (!folder || !file) {
  console.error('usage: lcov-paths.mjs <folder the tests ran in> <lcov file>');
  process.exit(1);
}

const fixed = readFileSync(file, 'utf8')
  .split('\n')
  .map((line) => (line.startsWith('SF:') ? `SF:${posix.normalize(posix.join(folder, line.slice(3)))}` : line))
  .join('\n');
writeFileSync(file, fixed);
