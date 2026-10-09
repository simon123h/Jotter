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

const vaultFormat = fileURLToPath(new URL('../packages/vault-format', import.meta.url));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [vue(), tailwindcss()],
  server: {
    // The shared parser lives outside this project. Builds and tests read it freely, but the dev server only
    // serves files under the project root unless they are listed here.
    fs: { allow: ['.', vaultFormat] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
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
