import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/journals',
  use: { baseURL: 'http://127.0.0.1:4180', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: process.env.JOURNAL_REUSE_SERVER === '1',
  },
});
