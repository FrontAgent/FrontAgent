/**
 * Cross-process IPC contract for the FrontAgent desktop app.
 *
 * This is the load-bearing boundary between the Electron main process (which
 * owns the Node runtime spine, `@frontagent/runtime-node`) and the renderer
 * (the React UI). It is a graded contract surface: kept minimal and explicit
 * so the accidental contract stays small. The renderer never imports runtime
 * internals — it only speaks these types.
 *
 * Later PRs implement the preload bridge and the runtime wiring; this PR fixes
 * the shape both sides agree on.
 */
import type { AgentEvent, AgentExecutionResult } from '@frontagent/core';
import type { ApprovalRequest } from '@frontagent/shared';

export type { AgentEvent, AgentExecutionResult, ApprovalRequest };

/** Renderer -> Main request channels (invoke/handle). */
export const IpcChannel = {
  RunTask: 'fa:task:run',
  CancelTask: 'fa:task:cancel',
  RespondApproval: 'fa:approval:respond',
  GetSettings: 'fa:settings:get',
  SaveSettings: 'fa:settings:save',
} as const;
export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Main -> Renderer push channels (send/on). */
export const IpcPush = {
  AgentEvent: 'fa:agent:event',
  ApprovalRequested: 'fa:approval:requested',
} as const;
export type IpcPush = (typeof IpcPush)[keyof typeof IpcPush];

export interface RunTaskRequest {
  /** Natural-language task description the agent should plan and execute. */
  task: string;
  /** Absolute path of the workspace the agent operates on. */
  workspacePath: string;
  /** Optional files to attach as relevant context. */
  relevantFiles?: string[];
  /** Optional dev-server / page URL for browser awareness. */
  browserUrl?: string;
}

export interface RunTaskResponse {
  /** Identifier the renderer uses to correlate pushed events with this run. */
  runId: string;
}

export interface ApprovalDecisionInput {
  /**
   * Run the decision belongs to. Carried explicitly (symmetric with
   * {@link ApprovalRequestEnvelope}) so the main process can route the decision
   * to the right run's approval callback without an implicit approvalId->run
   * lookup — the renderer may have several runs in flight.
   */
  runId: string;
  /** The `approvalId` carried by the `ApprovalRequest` being answered. */
  approvalId: string;
  approved: boolean;
  /** Optional maintainer note recorded with the decision. */
  note?: string;
}

export interface DesktopSettings {
  provider: string;
  model: string;
  baseUrl?: string;
  defaultWorkspacePath?: string;
}

/** Envelope correlating a pushed agent event with its originating run. */
export interface AgentEventEnvelope {
  runId: string;
  event: AgentEvent;
}

/** Envelope correlating a pushed approval request with its originating run. */
export interface ApprovalRequestEnvelope {
  runId: string;
  request: ApprovalRequest;
}

/**
 * The typed surface exposed on `window.frontagent` by the preload script.
 * Renderer code depends only on this interface.
 */
export interface FrontAgentBridge {
  runTask(req: RunTaskRequest): Promise<RunTaskResponse>;
  cancelTask(runId: string): Promise<void>;
  respondApproval(input: ApprovalDecisionInput): Promise<void>;
  getSettings(): Promise<DesktopSettings>;
  saveSettings(settings: DesktopSettings): Promise<void>;
  /** Subscribe to agent events; returns an unsubscribe function. */
  onAgentEvent(listener: (envelope: AgentEventEnvelope) => void): () => void;
  /** Subscribe to approval requests; returns an unsubscribe function. */
  onApprovalRequested(listener: (envelope: ApprovalRequestEnvelope) => void): () => void;
}
