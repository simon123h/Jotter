import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

function getAppVersion(): string {
  if (process.env.TAG) {
    return process.env.TAG.replace(/^v/, '');
  }
  if (process.env.SETUPTOOLS_SCM_PRETEND_VERSION) {
    return process.env.SETUPTOOLS_SCM_PRETEND_VERSION;
  }
  try {
    const gitTag = execSync('git describe --tags --always', { encoding: 'utf8' }).trim();
    return gitTag.replace(/^v/, '');
  } catch {
    return '3.9.2';
  }
}

const appVersion = getAppVersion();

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.JOTTER_PORT || '58271'}`,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    exclude: ['node_modules', 'dist', '.git', '.cache', 'tests/e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: ['src/api.demo.ts'],
    },
  },
})
