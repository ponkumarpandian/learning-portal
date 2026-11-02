import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173', timezoneId: 'Asia/Kolkata' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true, browserName: 'chromium' },
    },
  ],
});
