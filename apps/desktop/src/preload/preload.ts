/**
 * Electron preload. The thin glue the IPC seam (#333) was designed for: it
 * exposes the {@link FrontAgentBridge} on `window.frontagent` via `contextBridge`
 * by handing the IPC slice to `installPreloadBridge`. No logic lives here — all
 * behaviour is in `createPreloadBridge` / `installPreloadBridge`, both unit-tested.
 */
import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import type { PreloadIpc } from './bridge.js';
import { installPreloadBridge } from './install.js';

const ipc: PreloadIpc = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, listener) => {
    ipcRenderer.on(channel, listener as (event: IpcRendererEvent, ...args: unknown[]) => void);
  },
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(
      channel,
      listener as (event: IpcRendererEvent, ...args: unknown[]) => void,
    );
  },
};

installPreloadBridge({
  expose: (key, api) => contextBridge.exposeInMainWorld(key, api),
  ipc,
});
