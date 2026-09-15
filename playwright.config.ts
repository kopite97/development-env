import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testIgnore: [
    '**/auth/**',
    '**/real/**',
    '**/projects/**',
    '**/tasks/**',
    '**/journals/**',
    '**/milestones/**',
    '**/links/**',
    '**/dashboard/**',
    '**/shell/**',
  ],
  use: { baseURL: 'http://127.0.0.1:4175', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --config tests/legacy/vite.config.ts --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
