import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled (not loaded from a remote CDN) so the packaged desktop app
// works offline and needs no third-party network requests.
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import type { FrontAgentBridge } from '../ipc/contract.js';
import { App } from './App.js';
import { createMockBridge } from './mock/mockBridge.js';
import { selectBridge } from './selectBridge.js';
import './theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

// Prefer the real preload bridge (`window.frontagent`); fall back to the mock
// only in a plain browser. A missing bridge *inside Electron* is a hard failure
// (the real runtime wiring broke) — surfaced as a visible startup error rather
// than a silent downgrade to the mock. See selectBridge.ts.
let bridge: FrontAgentBridge;
try {
  bridge = selectBridge({
    frontagent: window.frontagent,
    userAgent: navigator.userAgent,
    createMock: createMockBridge,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `<div role="alert" style="font-family:'IBM Plex Mono',monospace;color:#ff6b6b;background:#0e1014;padding:2rem;min-height:100vh;box-sizing:border-box"><h1 style="font-family:'Chakra Petch',sans-serif;letter-spacing:.04em">启动失败 · STARTUP FAILED</h1><p style="color:#c9d1d9;max-width:60ch;line-height:1.6">${message}</p></div>`;
  throw error;
}

createRoot(root).render(
  <StrictMode>
    <App bridge={bridge} />
  </StrictMode>,
);
