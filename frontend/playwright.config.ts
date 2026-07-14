import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

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
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'go run ../main_server.go ../shared_assets.go',
      port: 58273,
      reuseExistingServer: !process.env.CI,
      env: {
        JOTTER_PORT: '58273',
        JOTTER_DATA_DIR: path.resolve('./tests/e2e/temp_data'),
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
