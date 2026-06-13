/**
 * Renderer-facing bridge factory. Builds the {@link FrontAgentBridge} contract
 * surface (see contract.ts) over a minimal slice of `ipcRenderer`: request
 * methods map onto `invoke`, push subscriptions onto `on`/`removeListener`.
 *
 * Dependency-injected and Electron-free so it is unit-testable; the thin
 * `preload.ts` that exposes `createPreloadBridge(ipcRenderer)` on
 * `window.frontagent` via `contextBridge` lands in the next slice.
 */
import {
  type AgentEventEnvelope,
  type ApprovalDecisionInput,
  type ApprovalRequestEnvelope,
  type DesktopSettings,
  type FrontAgentBridge,
  IpcChannel,
  IpcPush,
  type RunTaskRequest,
  type RunTaskResponse,
} from '../ipc/contract.js';

/** A push listener as registered on `ipcRenderer` (first arg is Electron's event). */
type PushListener = (event: unknown, payload: unknown) => void;

/** The minimal slice of `ipcRenderer` the bridge depends on. */
export interface PreloadIpc {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
  on(channel: string, listener: PushListener): void;
  removeListener(channel: string, listener: PushListener): void;
}

export function createPreloadBridge(ipc: PreloadIpc): FrontAgentBridge {
  return {
    runTask: (req: RunTaskRequest) =>
      ipc.invoke(IpcChannel.RunTask, req) as Promise<RunTaskResponse>,
    cancelTask: (runId: string) => ipc.invoke(IpcChannel.CancelTask, runId) as Promise<void>,
    respondApproval: (input: ApprovalDecisionInput) =>
      ipc.invoke(IpcChannel.RespondApproval, input) as Promise<void>,
    getSettings: () => ipc.invoke(IpcChannel.GetSettings) as Promise<DesktopSettings>,
    // Rejects when the main handler rejects (write failure) — the SettingsPanel
    // relies on this to surface a degraded state.
    saveSettings: (settings: DesktopSettings) =>
      ipc.invoke(IpcChannel.SaveSettings, settings) as Promise<void>,
    onAgentEvent: (listener) => subscribe<AgentEventEnvelope>(ipc, IpcPush.AgentEvent, listener),
    onApprovalRequested: (listener) =>
      subscribe<ApprovalRequestEnvelope>(ipc, IpcPush.ApprovalRequested, listener),
  };
}

/** Wire a push channel to a typed listener; returns an unsubscribe function. */
function subscribe<T>(
  ipc: PreloadIpc,
  channel: string,
  listener: (envelope: T) => void,
): () => void {
  const handler: PushListener = (_event, payload) => listener(payload as T);
  ipc.on(channel, handler);
  return () => ipc.removeListener(channel, handler);
}
