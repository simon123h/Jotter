import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@jotter/task-filter': fileURLToPath(new URL('../task-filter/index.ts', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: { reporter: ['text-summary', 'lcov'], include: ['src/**'], exclude: ['src/**/*.spec.ts'] },
  },
});
