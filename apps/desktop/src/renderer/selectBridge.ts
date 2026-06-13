/**
 * Decides which {@link FrontAgentBridge} the renderer runs against. Pure and
 * unit-tested so the browser-review vs. Electron-runtime distinction is explicit
 * rather than an implicit `?? mock`: a missing preload bridge inside Electron is
 * a hard failure (the real runtime wiring broke), not a silent downgrade to the
 * mock. Only a plain browser (`vite dev`, no Electron) may use the mock.
 */
import type { FrontAgentBridge } from '../ipc/contract.js';

/** Electron stamps `Electron/<version>` into the renderer's user-agent. */
export function isElectronRuntime(userAgent: string): boolean {
  return /\bElectron\//i.test(userAgent);
}

export class MissingPreloadBridgeError extends Error {
  constructor() {
    super(
      'FrontAgent preload bridge unavailable: the Electron preload did not expose ' +
        'window.frontagent. Refusing to fall back to the mock bridge in a desktop ' +
        'runtime — check the preload build/path and contextBridge wiring.',
    );
    this.name = 'MissingPreloadBridgeError';
  }
}

export function selectBridge(opts: {
  frontagent: FrontAgentBridge | undefined;
  userAgent: string;
  createMock: () => FrontAgentBridge;
}): FrontAgentBridge {
  if (opts.frontagent) return opts.frontagent;
  if (isElectronRuntime(opts.userAgent)) throw new MissingPreloadBridgeError();
  return opts.createMock();
}
