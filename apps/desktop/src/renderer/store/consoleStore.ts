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

  // Bridge subscription is attached lazily on the first `subscribe` and torn
  // down on the last unsubscribe — NOT at construction. Constructing the store
  // is side-effect-free, so a render discarded by React StrictMode (whose
  // effects/cleanup never run) cannot leak bridge listeners.
  let detachBridge: (() => void) | null = null;
  const attachBridge = () => {
    if (detachBridge) return;
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
    detachBridge = () => {
      offEvent();
      offApproval();
      detachBridge = null;
    };
  };

  return {
    getState: () => state,
    isLaunching: () => launching,
    subscribe(listener) {
      if (listeners.size === 0) attachBridge();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) detachBridge?.();
      };
    },
    async runTask(req) {
      // Busy when a launch is in flight OR a run has started and not yet
      // terminated — including the window after `runId` resolves but before the
      // first event arrives. Reject re-entry so the single-active-run model
      // can't fan out into multiple real backend tasks on a fast double-click.
      const hasActiveRun =
        currentRunId !== undefined && state.status !== 'completed' && state.status !== 'failed';
      if (launching || hasActiveRun) return;
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
        // Enter 'planning' immediately so the composer stays disabled through
        // the window between runId resolution and the first agent event.
        set({ ...initialConsoleState, status: 'planning' });
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
      // Only act on an approval still in the queue, so a double-click or a
      // stale handler can't resend the same decision.
      if (!pending) return;
      const decisionRunId = currentRunId;
      // Optimistically clear the approval from the queue, then notify main.
      set(resolveApproval(state, approvalId, approved));
      try {
        await bridge.respondApproval({ runId: decisionRunId, approvalId, approved, note });
      } catch {
        // The decision did not reach main — restore the approval so the user
        // can retry. Only if we're still on the same run: a new run may have
        // started during the await, and we must not leak a stale approval into it.
        if (currentRunId === decisionRunId) set(addApprovalRequest(state, pending));
      }
    },
    dispose() {
      detachBridge?.();
      listeners.clear();
    },
  };
}

function launchError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `任务启动失败: ${detail}`;
}
