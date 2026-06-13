/**
 * Framework-free console store. Subscribes to a {@link FrontAgentBridge},
 * folds the agent event stream through the pure `consoleReducer`, and applies
 * approval requests/decisions to the same `ConsoleState`. Kept out of React so
 * it can be unit-tested against the mock bridge with no DOM.
 *
 * The React layer consumes this through `useSyncExternalStore`.
 */
import type { FrontAgentBridge, RunTaskRequest } from '../../ipc/contract.js';
import {
  addApprovalRequest,
  type ConsoleState,
  consoleReducer,
  initialConsoleState,
  resolveApproval,
} from '../../state/executionReducer.js';

export interface ConsoleStore {
  getState(): ConsoleState;
  /** True between calling `runTask` and the bridge resolving the new run id. */
  isLaunching(): boolean;
  subscribe(listener: () => void): () => void;
  runTask(req: RunTaskRequest): Promise<void>;
  /**
   * Answer the current pending approval. `runId` is tracked internally from the
   * active run (the desktop drives one run), so the UI only supplies the decision.
   */
  respondApproval(approvalId: string, approved: boolean, note?: string): Promise<void>;
  /** Detach the bridge subscriptions. */
  dispose(): void;
}

export function createConsoleStore(bridge: FrontAgentBridge): ConsoleStore {
  let state = initialConsoleState;
  let currentRunId: string | undefined;
  let launching = false;
  // Monotonic launch token: guards against a slower earlier `runTask` resolving
  // after a newer launch and clobbering the active run id.
  let launchSeq = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const set = (next: ConsoleState) => {
    if (next === state) return;
    state = next;
    emit();
  };

  const setLaunching = (value: boolean) => {
    if (value === launching) return;
    launching = value;
    emit();
  };

  // Listeners fold only envelopes for the active run, so a previous/cancelled
  // run's late events or approvals can never pollute the current console.
  const offEvent = bridge.onAgentEvent(({ runId, event }) => {
    if (runId !== currentRunId) return;
    set(consoleReducer(state, event));
  });
  const offApproval = bridge.onApprovalRequested(({ runId, request }) => {
    if (runId !== currentRunId) return;
    set(addApprovalRequest(state, request));
  });

  return {
    getState: () => state,
    isLaunching: () => launching,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async runTask(req) {
      // Reject re-entrant launches: the composer is disabled while launching,
      // but guard here too so a fast double-click can't start two runs.
      if (launching) return;
      const seq = ++launchSeq;
      // Atomically invalidate the old run BEFORE clearing state, so a late
      // envelope from the previous run can't slip through the `runId` gate and
      // pollute the freshly-cleared console during the await window.
      currentRunId = undefined;
      set(initialConsoleState);
      setLaunching(true);
      try {
        const { runId } = await bridge.runTask(req);
        if (seq !== launchSeq) return; // superseded by a newer launch
        currentRunId = runId;
      } catch (error) {
        if (seq === launchSeq) {
          // Leave the UI in an explainable failed state; the old run stays
          // invalidated (currentRunId === undefined) so nothing else folds in.
          set(
            consoleReducer(initialConsoleState, { type: 'task_failed', error: launchError(error) }),
          );
        }
      } finally {
        if (seq === launchSeq) setLaunching(false);
      }
    },
    async respondApproval(approvalId, approved, note) {
      if (!currentRunId) return;
      const pending = state.pendingApprovals.find((a) => a.approvalId === approvalId);
      // Optimistically clear the approval from the queue, then notify main.
      set(resolveApproval(state, approvalId, approved));
      try {
        await bridge.respondApproval({ runId: currentRunId, approvalId, approved, note });
      } catch {
        // The decision did not reach main — restore the approval so the user
        // can retry instead of losing a pending gate.
        if (pending) set(addApprovalRequest(state, pending));
      }
    },
    dispose() {
      offEvent();
      offApproval();
      listeners.clear();
    },
  };
}

function launchError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `任务启动失败: ${detail}`;
}
