/**
 * Packaged-app launch smoke probe (Issue #339).
 *
 * Run only when `FRONTAGENT_SMOKE` is set (CI's xvfb packaging step). It proves
 * the *packaged* Electron app does more than exist on disk: that it boots, the
 * renderer actually loads from the packaged `dist/renderer`, and the sandboxed
 * preload's `contextBridge` exposes a wired `window.frontagent`. Crucially, the
 * app only reaches `did-finish-load` if `main.mjs` successfully imported the
 * Node runtime spine at launch — so this also validates that electron-builder
 * packaged the symlinked `workspace:*` dependencies correctly (the main risk of
 * `packages: external` + pnpm), which a file-existence check cannot.
 *
 * Kept out of `main.ts` (which stays pure assembly) and dependency-injected so
 * the transitions are unit-tested against a fake window with no Electron.
 */

/** The slice of an Electron `BrowserWindow` the probe drives. */
export interface SmokeProbeWindow {
  webContents: {
    on(event: 'did-finish-load', listener: () => void): void;
    executeJavaScript(code: string): Promise<unknown>;
  };
}

export interface SmokeProbeDeps {
  /** Terminate the app with this code: 0 = bridge present, 1 = failure/timeout. */
  exit: (code: number) => void;
  /** Fail closed if the renderer never finishes loading. Default 30s. */
  timeoutMs?: number;
  log?: (message: string) => void;
}

/** True iff the contextBridge exposed a `frontagent` bridge with its methods. */
const BRIDGE_CHECK =
  'Boolean(window.frontagent' +
  ' && typeof window.frontagent.runTask === "function"' +
  ' && typeof window.frontagent.getSettings === "function")';

export function installSmokeProbe(win: SmokeProbeWindow, deps: SmokeProbeDeps): void {
  const { exit, timeoutMs = 30_000, log = () => {} } = deps;

  const timer = setTimeout(() => {
    log(`smoke: renderer did not finish loading within ${timeoutMs}ms`);
    exit(1);
  }, timeoutMs);

  win.webContents.on('did-finish-load', () => {
    win.webContents
      .executeJavaScript(BRIDGE_CHECK)
      .then((bridgeReady) => {
        clearTimeout(timer);
        if (bridgeReady === true) {
          log('smoke: window.frontagent bridge is wired');
          exit(0);
        } else {
          log(`smoke: window.frontagent bridge missing (check returned ${String(bridgeReady)})`);
          exit(1);
        }
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        log(`smoke: bridge probe threw ${error instanceof Error ? error.message : String(error)}`);
        exit(1);
      });
  });
}
