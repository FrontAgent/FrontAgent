import { resolve } from 'node:path';
import { build } from 'esbuild';

await build({
  entryPoints: [resolve('src/extension.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: resolve('dist/extension.cjs'),
  external: ['vscode', 'playwright'],
  define: {
    'import.meta.url': '__frontAgentImportMetaUrl',
  },
  banner: {
    js: 'const __frontAgentImportMetaUrl = require("node:url").pathToFileURL(__filename).href;',
  },
  sourcemap: true,
  minify: false,
});

console.log('VSCode extension bundled successfully');
