# @frontagent/desktop

Standalone Electron desktop client for FrontAgent. It reuses the same Node
runtime spine as the CLI (`runFrontAgentTask`) behind a sandboxed React UI:
a Task Console (launch tasks, live phase/step telemetry, approvals) and a
Settings panel (LLM provider/model/base URL).

See the root [README](../../README.md#desktop-app) for the user-facing download
and usage overview.

## Architecture

```
renderer (React, sandboxed)
  window.frontagent              ← exposed by the preload via contextBridge
    → IPC (typed channels)       ← src/ipc/contract.ts
      → main process bridge      ← src/main/runtimeBridge.ts + ipcHandlers.ts
        → runFrontAgentTask      ← @frontagent/runtime-node
```

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. The
  renderer reaches the main process only through the typed `window.frontagent`
  bridge.
- Build is esbuild (`electron.build.mjs`): ESM main (`main.mjs`) + CommonJS
  preload (`preload.cjs`), with node_modules kept external. The renderer is a
  Vite build (`dist/renderer`).
- Logic lives in dependency-injected, unit-tested modules (stores, reducer,
  bridge, settings, smoke probe); `main.ts` is pure assembly. There is no
  DOM/testing-library layer by design — UI logic is tested at the store layer.

## Scripts

| Script | What it does |
|--------|--------------|
| `dev` | Vite dev server + Electron against it |
| `dev:renderer` | renderer only, in a browser (mock bridge) |
| `build` | typecheck + Vite renderer build + esbuild main/preload |
| `package` | unsigned, host-platform unpacked app (`electron-builder --dir`) |
| `release` | unsigned per-platform distributable zip (`electron-builder`) |
| `test` / `typecheck` | Vitest / `tsc --noEmit` |

## Packaging & release

- `pnpm --filter @frontagent/desktop package` → `release/<os>-unpacked/` (used by
  CI's launch smoke).
- `pnpm --filter @frontagent/desktop run release` → `release/frontagent-desktop-${version}-${os}-${arch}.zip`.
- CI (`.github/workflows/release.yml`) builds the zip on ubuntu/macOS/windows and,
  on `v*` tags, attaches them to the GitHub Release.

Code signing, notarization, and native installers (dmg/nsis/AppImage) are planned
follow-ups; current archives are unsigned.
