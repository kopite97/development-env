import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/milestones',
  use: { baseURL: 'http://127.0.0.1:4181', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: process.env.MILESTONE_REUSE_SERVER === '1',
  },
});
