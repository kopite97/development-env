import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/links',
  use: { baseURL: 'http://127.0.0.1:4182', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 4182 --strictPort',
    url: 'http://127.0.0.1:4182',
    reuseExistingServer: process.env.LINK_REUSE_SERVER === '1',
  },
});
