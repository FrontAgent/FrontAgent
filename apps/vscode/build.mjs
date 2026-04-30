import { build } from 'esbuild';
import { resolve } from 'node:path';

await build({
  entryPoints: [resolve('src/extension.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: resolve('dist/extension.js'),
  external: ['vscode', 'playwright'],
  sourcemap: true,
  minify: false,
});

console.log('VSCode extension bundled successfully');
