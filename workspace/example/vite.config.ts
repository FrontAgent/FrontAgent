import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2018',
    sourcemap: mode !== 'production',
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
    reportCompressedSize: true,
    emptyOutDir: true,
  },
}));