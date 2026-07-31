import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['line']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'tsx api/server.ts',
      port: 3071,
      reuseExistingServer: true,
      cwd: 'apps/playground',
    },
    {
      command: 'vite preview --port 5173',
      port: 5173,
      reuseExistingServer: true,
      cwd: 'apps/playground',
    },
  ],
});
