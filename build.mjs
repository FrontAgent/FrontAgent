import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await build({
  entryPoints: [resolve(__dirname, 'apps/cli/src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: resolve(__dirname, 'dist/index.cjs'),
  external: [
    'playwright',  // Playwright has binaries, keep it external
  ],
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: false,
  sourcemap: true,
});

await build({
  entryPoints: [resolve(__dirname, 'packages/core/src/sub-agents/code-quality-subagent-worker.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: resolve(__dirname, 'dist/code-quality-subagent-worker.cjs'),
  sourcemap: true,
});

console.log('✅ CLI bundled successfully');
