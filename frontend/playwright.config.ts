import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// The e2e server gets its own home, config and data folders, so it never touches the developer's real vaults.
// Jotter picks its vault from vaults.json in the config folder, so these have to be redirected on every platform.
const e2eHome = path.resolve('./tests/e2e/temp_data');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'python3 ../run.py',
      port: 58273,
      reuseExistingServer: !process.env.CI,
      env: {
        JOTTER_PORT: '58273',
        HOME: e2eHome,
        USERPROFILE: e2eHome,
        APPDATA: e2eHome,
        XDG_CONFIG_HOME: path.join(e2eHome, 'config'),
        XDG_DATA_HOME: path.join(e2eHome, 'data'),
      },
    },
    {
      command: 'npm run dev -- --port 5174',
      port: 5174,
      reuseExistingServer: !process.env.CI,
      env: {
        JOTTER_PORT: '58273',
      },
    },
  ],
});
