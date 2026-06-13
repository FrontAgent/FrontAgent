import type { FrontAgentBridge } from '../ipc/contract.js';

declare global {
  interface Window {
    /** Exposed by the Electron preload (`preload.ts`); absent under plain `vite dev`. */
    frontagent?: FrontAgentBridge;
  }
}
