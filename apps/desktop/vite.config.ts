import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Renderer-only build for the desktop app. The Electron main/preload bundle
// is wired in a later PR; for now the renderer runs in a browser against the
// mock bridge so the UI is reviewable on its own.
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
});
