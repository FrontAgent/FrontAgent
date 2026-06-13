/**
 * Main-process IPC handler registration. Maps the renderer's invoke channels
 * (see {@link IpcChannel}) onto the {@link RuntimeBridge} core and the settings
 * store. Dependency-injected and Electron-free — `handle` is a minimal slice of
 * `ipcMain.handle`, so the wiring is fully unit-testable; the thin Electron
 * `main.ts` that calls this with the real `ipcMain` lands in the next slice.
 */
import {
  type ApprovalDecisionInput,
  type DesktopSettings,
  IpcChannel,
  type RunTaskRequest,
  type RunTaskResponse,
} from '../ipc/contract.js';
import type { RuntimeBridge } from './runtimeBridge.js';

/** A registered invoke listener. The first arg is Electron's event (unused here). */
export type IpcInvokeListener = (event: unknown, payload?: unknown) => unknown;

/** The minimal slice of `ipcMain.handle` the registration depends on. */
export type IpcHandle = (channel: string, listener: IpcInvokeListener) => void;

export interface IpcHandlerDeps {
  handle: IpcHandle;
  bridge: RuntimeBridge;
  loadSettings: () => DesktopSettings;
  /** Persists settings; returns false on write failure (never throws). */
  saveSettings: (settings: DesktopSettings) => boolean;
}

export function registerIpcHandlers(deps: IpcHandlerDeps): void {
  const { handle, bridge, loadSettings, saveSettings } = deps;

  // RunTask returns the runId synchronously; `ipcMain.handle` resolves it to the
  // renderer as a promise before any pushed envelope — the timing contract the
  // store relies on (see contract.ts / runtimeBridge.ts).
  handle(
    IpcChannel.RunTask,
    (_event, payload): RunTaskResponse => bridge.runTask(payload as RunTaskRequest),
  );

  handle(IpcChannel.CancelTask, (_event, payload) => {
    bridge.cancelTask(payload as string);
  });

  handle(IpcChannel.RespondApproval, (_event, payload) => {
    bridge.respondApproval(payload as ApprovalDecisionInput);
  });

  handle(IpcChannel.GetSettings, (): DesktopSettings => loadSettings());

  // Reject on write failure so the renderer's `saveSettings` promise rejects and
  // the SettingsPanel can show a degraded state (the UI lands with the renderer
  // swap). A silent false here would strand the renderer believing it persisted.
  handle(IpcChannel.SaveSettings, (_event, payload) => {
    if (!saveSettings(payload as DesktopSettings)) {
      throw new Error('Failed to persist settings');
    }
  });
}
