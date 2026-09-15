import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Separate test server preserves original URLs without a production demo switch.
export default defineConfig({
  // Concurrent original/authenticated visual servers must not rewrite one optimizer cache.
  cacheDir: 'node_modules/.vite-legacy',
  plugins: [
    react(),
    {
      name: 'legacy-test-entry',
      transformIndexHtml(html) {
        return html.replace('/src/main.tsx', '/tests/legacy/main.tsx');
      },
    },
  ],
});
