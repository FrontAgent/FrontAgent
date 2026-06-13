import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { createMockBridge } from './mock/mockBridge.js';
import './theme.css';

// PR 2 runs the renderer against the in-browser mock bridge. PR 3 swaps this
// for the preload bridge exposed by the Electron main process over IPC.
const bridge = createMockBridge();

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <App bridge={bridge} />
  </StrictMode>,
);
