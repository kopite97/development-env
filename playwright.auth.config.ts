import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/auth',
  use: { baseURL: 'http://127.0.0.1:4176', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
  },
});
