import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/dashboard',
  use: { baseURL: 'http://127.0.0.1:4183', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 4183 --strictPort',
    url: 'http://127.0.0.1:4183',
    reuseExistingServer: process.env.DASHBOARD_REUSE_SERVER === '1',
  },
});
