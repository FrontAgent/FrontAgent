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
  format: 'esm',
  outfile: resolve(__dirname, 'dist/index.mjs'),
  external: [
    'playwright',
  ],
  jsx: 'automatic',
  plugins: [{
    name: 'stub-react-devtools',
    setup(build) {
      build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
        namespace: 'stub',
        path: 'react-devtools-core',
      }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export default {};',
        loader: 'js',
      }));
    },
  }],
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire as __createRequire } from "module";',
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  minify: false,
  sourcemap: true,
  loader: { '.tsx': 'tsx', '.jsx': 'jsx' },
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
