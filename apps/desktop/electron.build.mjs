/**
 * Builds the Electron main + preload bundles with esbuild.
 *
 * Raw `tsc` fights this package's `"type": "module"` + workspace `exports` +
 * Electron's module-format rules; esbuild sidesteps all of it: it bundles only
 * our own source and keeps every node_modules package external so the heavy
 * runtime tree is resolved by Node at launch rather than inlined.
 *
 * The two bundles use different formats deliberately:
 * - main → ESM (`.mjs`): Electron 42 loads an ESM main, which gives us
 *   `import.meta.dirname` and native `import` of the ESM runtime spine.
 * - preload → CommonJS (`.cjs`): a *sandboxed* renderer (`sandbox: true`, the
 *   security posture the app requires) loads only a CJS preload. Bundled with
 *   deps external, the preload requires nothing but `electron` at runtime,
 *   which the sandbox preload loader allows.
 */
import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
};

await build({
  ...shared,
  format: 'esm',
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/electron/main.mjs',
});
await build({
  ...shared,
  format: 'cjs',
  entryPoints: ['src/preload/preload.ts'],
  outfile: 'dist/electron/preload.cjs',
});
