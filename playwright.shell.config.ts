import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/shell',
  outputDir: './test-results/shell',
  use: { baseURL: 'http://127.0.0.1:4185', browserName: 'chromium' },
  webServer: [
    {
      command: 'npm run dev -- --port 4185 --strictPort',
      url: 'http://127.0.0.1:4185',
    },
    {
      command: 'npm run dev -- --config tests/legacy/vite.config.ts --port 4186 --strictPort',
      url: 'http://127.0.0.1:4186',
    },
  ],
});
