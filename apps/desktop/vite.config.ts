import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Renderer build for the desktop app. In the packaged app the renderer is loaded
// from disk by the Electron main process; under plain `vite dev` it runs in a
// browser against the mock bridge so the UI is reviewable on its own.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  // Surface the real package version to the renderer (App.tsx footer) instead of
  // a hardcoded string that drifts.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
});
