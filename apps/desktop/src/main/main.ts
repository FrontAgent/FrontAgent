/**
 * Electron main-process entry. Pure assembly (keel grade: wiring): it composes
 * the already-built, unit-tested pieces and owns no logic of its own —
 *
 *   runFrontAgentTask (the Node runtime spine)
 *     → createRuntimeBridge  (runtime → IPC envelopes, #330)
 *       → registerIpcHandlers (invoke channels → bridge + settings, #333)
 *         → createPreloadBridge on the renderer (exposed by preload.ts, #333)
 *
 * Everything testable lives in those modules; this file just starts the window
 * and connects them, so it carries no tests (it cannot run without Electron).
 */
import { join } from 'node:path';
import { runFrontAgentTask } from '@frontagent/runtime-node';
import { app, BrowserWindow, ipcMain } from 'electron';
import { registerIpcHandlers } from './ipcHandlers.js';
import { createRuntimeBridge, type RuntimeRunOptions } from './runtimeBridge.js';
import { createFileSettingsIO } from './runtimeIO.js';
import { loadSettings, saveSettings } from './settingsStore.js';

/** Set by `pnpm dev:app` so the window loads the live Vite server in development. */
const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;

function loadRenderer(win: BrowserWindow): void {
  if (RENDERER_DEV_URL) {
    // Vite may not be listening yet on first launch; retry until it is.
    win.loadURL(RENDERER_DEV_URL).catch(() => {
      setTimeout(() => loadRenderer(win), 400);
    });
    return;
  }
  win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0e1014',
    show: false,
    webPreferences: {
      // CommonJS preload (see electron.build.mjs) so the renderer stays
      // sandboxed; it reaches the main process only through the typed
      // `window.frontagent` bridge the preload exposes.
      preload: join(import.meta.dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  loadRenderer(win);
  mainWindow = win;
  return win;
}

app.whenReady().then(() => {
  const io = createFileSettingsIO(join(app.getPath('userData'), 'settings.json'));

  const bridge = createRuntimeBridge({
    run: (opts: RuntimeRunOptions) => {
      // Merge the persisted LLM settings into each run; the API key resolves
      // from the environment inside the runtime (PROVIDER_API_KEY / API_KEY).
      const s = loadSettings(io);
      return runFrontAgentTask({
        ...opts,
        provider: s.provider,
        model: s.model,
        baseUrl: s.baseUrl || undefined,
      });
    },
    send: (channel, payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
      }
    },
  });

  registerIpcHandlers({
    handle: (channel, listener) => ipcMain.handle(channel, listener),
    bridge,
    loadSettings: () => loadSettings(io),
    saveSettings: (settings) => saveSettings(io, settings),
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS apps conventionally stay alive until Cmd+Q.
  if (process.platform !== 'darwin') app.quit();
});
