import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'BACKEND_UPSTREAM');
  const target = env.BACKEND_UPSTREAM || 'http://127.0.0.1:8080';
  if (!/^https?:\/\/[^/]+$/.test(target))
    throw new Error('BACKEND_UPSTREAM must be an HTTP origin');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '^/api(?:/|$)': { target, changeOrigin: false },
        '^/oauth2(?:/|$)': { target, changeOrigin: false },
      },
    },
    test: { include: ['src/**/*.test.ts'] },
  };
});
