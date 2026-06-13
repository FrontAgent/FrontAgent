import { describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  ApprovalDecisionInput,
  ApprovalRequest,
  FrontAgentBridge,
} from '../../ipc/contract.js';
import { createConsoleStore } from './consoleStore.js';

/** Bridge whose envelopes are emitted by the test, so we can inject stale/interleaved runs. */
function createControllableBridge(runId: string) {
  const agentListeners = new Set<(e: { runId: string; event: AgentEvent }) => void>();
  const approvalListeners = new Set<(e: { runId: string; request: ApprovalRequest }) => void>();
  const responded: ApprovalDecisionInput[] = [];

  const bridge: FrontAgentBridge = {
    async runTask() {
      return { runId };
    },
    async cancelTask() {},
    async respondApproval(input) {
      responded.push(input);
    },
    async getSettings() {
      return { provider: 'anthropic', model: 'claude-opus-4-8' };
    },
    async saveSettings() {},
    onAgentEvent(listener) {
      agentListeners.add(listener);
      return () => agentListeners.delete(listener);
    },
    onApprovalRequested(listener) {
      approvalListeners.add(listener);
      return () => approvalListeners.delete(listener);
    },
  };

  return {
    bridge,
    responded,
    emitEvent(rid: string, event: AgentEvent) {
      for (const listener of agentListeners) listener({ runId: rid, event });
    },
    emitApproval(rid: string, request: ApprovalRequest) {
      for (const listener of approvalListeners) listener({ runId: rid, request });
    },
  };
}

function stepStarted(stepId: string, phase: string): AgentEvent {
  return {
    type: 'step_started',
    step: {
      stepId,
      description: `step ${stepId}`,
      action: 'write_file',
      tool: 'mcp-file',
      params: {},
      dependencies: [],
      validation: [],
      status: 'running',
      phase,
    },
  };
}

function approval(approvalId: string): ApprovalRequest {
  return {
    decision: 'ask',
    approvalId,
    createdAt: '2026-06-13T00:00:00Z',
    riskLevel: 'high',
    reasonCode: 'shell_ask',
    message: 'm',
    toolName: 'run_command',
    argsSummary: 'a',
    provenance: [],
  };
}

describe('consoleStore run isolation', () => {
  it('ignores agent events from a run that is not the active one', async () => {
    const ctl = createControllableBridge('R1');
    const store = createConsoleStore(ctl.bridge);
    await store.runTask({ task: 't', workspacePath: '/w' });

    ctl.emitEvent('OLD', stepStarted('s9', '旧阶段'));
    expect(store.getState().phases).toHaveLength(0); // stale event dropped

    ctl.emitEvent('R1', stepStarted('s1', '实现'));
    expect(store.getState().phases.map((p) => p.name)).toEqual(['实现']); // active event folded
    store.dispose();
  });

  it('ignores approval requests from a stale run and does not repoint the active run', async () => {
    const ctl = createControllableBridge('R1');
    const store = createConsoleStore(ctl.bridge);
    await store.runTask({ task: 't', workspacePath: '/w' });

    ctl.emitApproval('OLD', approval('old-apv'));
    expect(store.getState().pendingApprovals).toHaveLength(0); // stale approval dropped

    ctl.emitApproval('R1', approval('apv-1'));
    expect(store.getState().pendingApprovals.map((a) => a.approvalId)).toEqual(['apv-1']);
    store.dispose();
  });

  it('routes respondApproval to the active run even after interleaved stale envelopes', async () => {
    const ctl = createControllableBridge('R1');
    const store = createConsoleStore(ctl.bridge);
    await store.runTask({ task: 't', workspacePath: '/w' });

    ctl.emitApproval('R1', approval('apv-1'));
    // A late envelope from a previous run arrives in between.
    ctl.emitApproval('OLD', approval('old-apv'));
    ctl.emitEvent('OLD', stepStarted('s9', '旧阶段'));

    await store.respondApproval('apv-1', true);

    expect(ctl.responded).toHaveLength(1);
    expect(ctl.responded[0]).toMatchObject({ runId: 'R1', approvalId: 'apv-1', approved: true });
    expect(store.getState().pendingApprovals).toHaveLength(0);
    store.dispose();
  });
});
