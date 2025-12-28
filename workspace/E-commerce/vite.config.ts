import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

type ProxyTarget = string | undefined;

const toUrlString = (value: ProxyTarget): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export default defineConfig(({ mode }) => {
  const apiProxyTarget = toUrlString(process.env.VITE_API_PROXY_TARGET);

  const apiProxy: ProxyOptions | undefined = apiProxyTarget
    ? {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      }
    : undefined;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    envPrefix: ['VITE_'],
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: apiProxy
        ? {
            '/api': apiProxy,
          }
        : undefined,
    },
    build: {
      outDir: 'dist',
    },
  };
});