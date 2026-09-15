import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'BACKEND_UPSTREAM');
  const target = env.BACKEND_UPSTREAM || 'http://127.0.0.1:8080';
  if (!/^https?:\/\/[^/]+$/.test(target))
    throw new Error('BACKEND_UPSTREAM must be an HTTP origin');
  return {
    plugins: [
      react(),
      {
        name: 'canonical-localhost-navigation',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const host = request.headers.host ?? '';
            const path = request.url ?? '/';
            if (
              !/^localhost(?::\d+)?$/i.test(host) ||
              !['GET', 'HEAD'].includes(request.method ?? '') ||
              !request.headers.accept?.includes('text/html') ||
              !path.startsWith('/') ||
              path.startsWith('//') ||
              /^\/(?:api|oauth2)(?:\/|\?|$)/i.test(path)
            ) {
              next();
              return;
            }
            const origin = new URL(`${server.config.server.https ? 'https' : 'http'}://${host}`);
            origin.hostname = '127.0.0.1';
            response.writeHead(302, {
              Location: origin.origin + path,
              'Cache-Control': 'no-store',
            });
            response.end();
          });
        },
      },
    ],
    server: {
      proxy: {
        '^/api(?:/|$)': { target, changeOrigin: false },
        '^/oauth2(?:/|$)': { target, changeOrigin: false },
      },
    },
    test: { include: ['src/**/*.test.ts'] },
  };
});
