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
  subscribe(listener: () => void): () => void;
  runTask(req: RunTaskRequest): Promise<void>;
  /**
   * Answer the current pending approval. `runId` is tracked internally from the
   * live event/approval envelopes (the desktop drives one active run), so the
   * UI only supplies the decision.
   */
  respondApproval(approvalId: string, approved: boolean, note?: string): Promise<void>;
  /** Detach the bridge subscriptions. */
  dispose(): void;
}

export function createConsoleStore(bridge: FrontAgentBridge): ConsoleStore {
  let state = initialConsoleState;
  let currentRunId: string | undefined;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const set = (next: ConsoleState) => {
    if (next === state) return;
    state = next;
    emit();
  };

  const offEvent = bridge.onAgentEvent(({ runId, event }) => {
    currentRunId = runId;
    set(consoleReducer(state, event));
  });
  const offApproval = bridge.onApprovalRequested(({ runId, request }) => {
    currentRunId = runId;
    set(addApprovalRequest(state, request));
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async runTask(req) {
      const { runId } = await bridge.runTask(req);
      currentRunId = runId;
    },
    async respondApproval(approvalId, approved, note) {
      if (!currentRunId) return;
      // Optimistically clear the approval from the queue, then notify main.
      set(resolveApproval(state, approvalId, approved));
      await bridge.respondApproval({ runId: currentRunId, approvalId, approved, note });
    },
    dispose() {
      offEvent();
      offApproval();
      listeners.clear();
    },
  };
}
