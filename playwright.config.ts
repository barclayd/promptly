import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2, // 2 retries everywhere for flaky tests
  workers: process.env.CI ? 1 : 4, // Limit workers to reduce race conditions
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60000, // Increase overall timeout
  expect: {
    timeout: 10000, // Increase assertion timeout for slower operations
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000, // Timeout for clicks, fills, etc.
    navigationTimeout: 30000, // Timeout for page navigations
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 min for cold start
  },
});
