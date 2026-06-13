/**
 * Main-process runtime bridge core. Drives `@frontagent/runtime-node`'s
 * `runFrontAgentTask` and maps its callbacks onto the IPC envelopes the
 * renderer consumes. Kept dependency-injected and Electron-free so it is fully
 * unit-testable; PR4 wires it to `ipcMain` / `BrowserWindow` / preload.
 */
import type { AgentEvent } from '@frontagent/core';
import type { ApprovalRequest } from '@frontagent/shared';
import {
  type AgentEventEnvelope,
  type ApprovalDecisionInput,
  type ApprovalRequestEnvelope,
  IpcPush,
  type RunTaskRequest,
  type RunTaskResponse,
} from '../ipc/contract.js';

/** The subset of `RunFrontAgentTaskOptions` the bridge drives (injected for testing). */
export interface RuntimeRunOptions {
  task: string;
  projectRoot: string;
  files?: string[];
  url?: string;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
  onApprovalRequest?: (request: ApprovalRequest) => Promise<boolean>;
}

export type RuntimeRunner = (options: RuntimeRunOptions) => Promise<unknown>;

export interface RuntimeBridgeDeps {
  /** Injectable `runFrontAgentTask`. */
  run: RuntimeRunner;
  /** Posts an envelope to the renderer (PR4: `webContents.send`). */
  send: (channel: string, payload: AgentEventEnvelope | ApprovalRequestEnvelope) => void;
  /** Overridable run-id generator (tests pass a deterministic one). */
  generateRunId?: () => string;
}

export interface RuntimeBridge {
  runTask(req: RunTaskRequest): RunTaskResponse;
  respondApproval(input: ApprovalDecisionInput): void;
  cancelTask(runId: string): void;
  /** Number of runs currently in flight — for diagnostics/tests. */
  activeRunCount(): number;
}

interface ActiveRun {
  controller: AbortController;
  pendingApprovals: Map<string, (approved: boolean) => void>;
}

export function createRuntimeBridge(deps: RuntimeBridgeDeps): RuntimeBridge {
  const runs = new Map<string, ActiveRun>();
  let counter = 0;
  const genId = deps.generateRunId ?? (() => `run-${Date.now()}-${(counter += 1)}`);

  return {
    runTask(req) {
      const runId = genId();
      const active: ActiveRun = {
        controller: new AbortController(),
        pendingApprovals: new Map(),
      };
      runs.set(runId, active);

      // Start the run on the next microtask so `runTask` returns the runId
      // before any event is forwarded — the FrontAgentBridge.runTask timing
      // contract the renderer store relies on (see contract.ts).
      queueMicrotask(() => {
        void deps
          .run({
            task: req.task,
            projectRoot: req.workspacePath,
            files: req.relevantFiles,
            url: req.browserUrl,
            signal: active.controller.signal,
            onEvent: (event) => deps.send(IpcPush.AgentEvent, { runId, event }),
            onApprovalRequest: (request) =>
              new Promise<boolean>((resolve) => {
                active.pendingApprovals.set(request.approvalId, resolve);
                deps.send(IpcPush.ApprovalRequested, { runId, request });
              }),
          })
          .catch((error) => {
            deps.send(IpcPush.AgentEvent, {
              runId,
              event: {
                type: 'task_failed',
                error: error instanceof Error ? error.message : String(error),
              },
            });
          })
          .finally(() => {
            // Resolve any approvals still pending (run ended) as denied so the
            // runtime promise never hangs, then drop the run.
            for (const resolve of active.pendingApprovals.values()) resolve(false);
            runs.delete(runId);
          });
      });

      return { runId };
    },

    respondApproval(input) {
      const active = runs.get(input.runId);
      const resolve = active?.pendingApprovals.get(input.approvalId);
      if (!active || !resolve) return; // unknown run or stale/already-handled approval
      active.pendingApprovals.delete(input.approvalId);
      resolve(input.approved);
    },

    cancelTask(runId) {
      runs.get(runId)?.controller.abort();
    },

    activeRunCount: () => runs.size,
  };
}
