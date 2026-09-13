import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/projects',
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
