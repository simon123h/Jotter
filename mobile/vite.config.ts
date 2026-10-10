import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// The same version the desktop app shows: the release tag, or `git describe`
function appVersion(): string {
  if (process.env.TAG) return process.env.TAG.replace(/^v/, '');
  try {
    return execSync('git describe --tags --always', { encoding: 'utf8' }).trim().replace(/^v/, '');
  } catch {
    return 'dev';
  }
}

const packages = fileURLToPath(new URL('../packages', import.meta.url));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [vue(), tailwindcss()],
  server: {
    // The shared packages live outside this project. Builds and tests read it freely, but the dev server only
    // serves files under the project root unless they are listed here.
    fs: { allow: ['.', packages] },
    // Gradle writes reports and build output under android/ all the time; none of it is part of the web app
    watch: { ignored: ['**/android/**'] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@jotter/title-parser': fileURLToPath(new URL('../packages/title-parser/index.ts', import.meta.url)),
      '@jotter/themes': fileURLToPath(new URL('../packages/themes/index.ts', import.meta.url)),
      '@jotter/vault-format': fileURLToPath(new URL('../packages/vault-format/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    exclude: ['node_modules', 'dist', '.git'],
  },
});
