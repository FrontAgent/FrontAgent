/**
 * The preload's one job, made testable: expose a working {@link FrontAgentBridge}
 * on the renderer global under a fixed key. Kept separate from `preload.ts` (which
 * can only import the real `electron` at runtime) so a unit test can assert the
 * bridge is actually injected — and wired to IPC, not a stub — without launching
 * Electron.
 */
import { createPreloadBridge, type PreloadIpc } from './bridge.js';

/** The global key the renderer reads as `window.frontagent`. */
export const FRONTAGENT_BRIDGE_KEY = 'frontagent';

export interface PreloadHost {
  /** `contextBridge.exposeInMainWorld` in `preload.ts`. */
  expose: (key: string, api: unknown) => void;
  ipc: PreloadIpc;
}

export function installPreloadBridge(host: PreloadHost): void {
  host.expose(FRONTAGENT_BRIDGE_KEY, createPreloadBridge(host.ipc));
}
