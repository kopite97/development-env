import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Separate test server preserves original URLs without a production demo switch.
export default defineConfig({
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
