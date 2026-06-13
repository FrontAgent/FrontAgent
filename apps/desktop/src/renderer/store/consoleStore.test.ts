import { describe, expect, it } from 'vitest';
import type {
  AgentEvent,
  ApprovalDecisionInput,
  ApprovalRequest,
  FrontAgentBridge,
} from '../../ipc/contract.js';
import { createConsoleStore } from './consoleStore.js';

/**
 * Bridge whose envelopes are emitted by the test, so we can inject
 * stale/interleaved runs. `runTask` can be deferred so the launch window
 * (before the new run id resolves) is observable.
 */
function createControllableBridge(
  runId: string,
  opts: { defer?: boolean; deferRespond?: boolean } = {},
) {
  const agentListeners = new Set<(e: { runId: string; event: AgentEvent }) => void>();
  const approvalListeners = new Set<(e: { runId: string; request: ApprovalRequest }) => void>();
  const responded: ApprovalDecisionInput[] = [];
  let activeRunId = runId;
  let runTaskCalls = 0;
  let settle: () => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const gate = new Promise<void>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  let failRespondGate: (error: unknown) => void = () => {};
  const respondGate = new Promise<void>((_, reject) => {
    failRespondGate = reject;
  });

  const bridge: FrontAgentBridge = {
    async runTask() {
      runTaskCalls += 1;
      if (opts.defer) await gate;
      return { runId: activeRunId };
    },
    async cancelTask() {},
    async respondApproval(input) {
      if (opts.deferRespond) await respondGate; // rejected by failRespond()
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
    activeListenerCount: () => agentListeners.size + approvalListeners.size,
    setRunId: (id: string) => {
      activeRunId = id;
    },
    failRespond: (error: unknown) => failRespondGate(error),
    runTaskCalls: () => runTaskCalls,
    settleRun: () => settle(),
    failRun: (error: unknown) => fail(error),
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
    store.subscribe(() => {});
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
    store.subscribe(() => {});
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
    store.subscribe(() => {});
    await store.runTask({ task: 't', workspacePath: '/w' });

    ctl.emitApproval('R1', approval('apv-1'));
    ctl.emitApproval('OLD', approval('old-apv'));
    ctl.emitEvent('OLD', stepStarted('s9', '旧阶段'));

    await store.respondApproval('apv-1', true);

    expect(ctl.responded).toHaveLength(1);
    expect(ctl.responded[0]).toMatchObject({ runId: 'R1', approvalId: 'apv-1', approved: true });
    expect(store.getState().pendingApprovals).toHaveLength(0);
    store.dispose();
  });

  it('drops late envelopes from a prior run during the launch window (before runTask resolves)', async () => {
    const ctl = createControllableBridge('R2', { defer: true });
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});

    const launch = store.runTask({ task: 't', workspacePath: '/w' });
    expect(store.isLaunching()).toBe(true);

    // While the new run id has not resolved yet, a late envelope from the prior
    // run (or any run) must be ignored — the old run was invalidated.
    ctl.emitEvent('R1', stepStarted('s9', '旧阶段'));
    ctl.emitApproval('R1', approval('old-apv'));
    expect(store.getState().phases).toHaveLength(0);
    expect(store.getState().pendingApprovals).toHaveLength(0);

    ctl.settleRun();
    await launch;
    expect(store.isLaunching()).toBe(false);

    ctl.emitEvent('R2', stepStarted('s1', '实现'));
    expect(store.getState().phases.map((p) => p.name)).toEqual(['实现']);
    store.dispose();
  });

  it('does not start a second run while a launch is in flight', async () => {
    const ctl = createControllableBridge('R1', { defer: true });
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});

    const first = store.runTask({ task: 't', workspacePath: '/w' });
    const second = store.runTask({ task: 't again', workspacePath: '/w' }); // re-entrant click
    expect(ctl.runTaskCalls()).toBe(1); // second call short-circuited

    ctl.settleRun();
    await Promise.all([first, second]);
    expect(ctl.runTaskCalls()).toBe(1);
    store.dispose();
  });

  it('restores the pending approval when respondApproval fails to reach main', async () => {
    const ctl = createControllableBridge('R1', { deferRespond: true });
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});
    await store.runTask({ task: 't', workspacePath: '/w' });
    ctl.emitApproval('R1', approval('apv-1'));
    expect(store.getState().pendingApprovals).toHaveLength(1);

    const pending = store.respondApproval('apv-1', true);
    expect(store.getState().pendingApprovals).toHaveLength(0); // optimistic clear
    ctl.failRespond(new Error('IPC down'));
    await pending;

    // Same run, so the cleared approval is rolled back for the user to retry.
    expect(store.getState().pendingApprovals.map((a) => a.approvalId)).toEqual(['apv-1']);
    store.dispose();
  });

  it('does not send a decision for an approval that is not pending (idempotent on double click)', async () => {
    const ctl = createControllableBridge('R1');
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});
    await store.runTask({ task: 't', workspacePath: '/w' });
    ctl.emitApproval('R1', approval('apv-1'));

    await store.respondApproval('apv-1', true);
    await store.respondApproval('apv-1', true); // stale double-click
    await store.respondApproval('missing', false); // unknown id

    expect(ctl.responded).toHaveLength(1); // only the first, real decision was sent
    store.dispose();
  });

  it('does not restore a stale approval into a new run when the failed send resolves late', async () => {
    const ctl = createControllableBridge('R1', { deferRespond: true });
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});
    await store.runTask({ task: 't', workspacePath: '/w' });
    ctl.emitApproval('R1', approval('apv-1'));

    const pending = store.respondApproval('apv-1', true); // decisionRunId = R1, awaits gate

    // A new run starts before the (doomed) approval send settles.
    ctl.setRunId('R2');
    await store.runTask({ task: 'again', workspacePath: '/w' });

    ctl.failRespond(new Error('IPC down'));
    await pending;

    // The R1 approval must not leak back into the R2 run's state.
    expect(store.getState().pendingApprovals).toHaveLength(0);
    store.dispose();
  });

  it('returns to an explainable failed state and stops accepting envelopes when runTask rejects', async () => {
    const ctl = createControllableBridge('R1', { defer: true });
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});

    const launch = store.runTask({ task: 't', workspacePath: '/w' });
    ctl.failRun(new Error('IPC down'));
    await launch;

    const state = store.getState();
    expect(state.status).toBe('failed');
    expect(state.error).toContain('任务启动失败');
    expect(store.isLaunching()).toBe(false);

    // The old run was invalidated; nothing folds in afterwards.
    ctl.emitEvent('R1', stepStarted('s1', '实现'));
    expect(store.getState().phases).toHaveLength(0);
    store.dispose();
  });
});

describe('consoleStore bridge-listener lifecycle', () => {
  it('does not subscribe to the bridge until the first subscribe (StrictMode-safe construction)', () => {
    const ctl = createControllableBridge('R1');
    // Constructing the store must be side-effect-free: a render discarded by
    // React StrictMode (whose effect cleanup never runs) must not leak listeners.
    const store = createConsoleStore(ctl.bridge);
    expect(ctl.activeListenerCount()).toBe(0);

    const unsubscribe = store.subscribe(() => {});
    expect(ctl.activeListenerCount()).toBeGreaterThan(0); // attached lazily on first subscribe

    unsubscribe();
    expect(ctl.activeListenerCount()).toBe(0); // detached on last unsubscribe
  });

  it('leaves no bridge listeners after a subscribe/dispose cycle', () => {
    const ctl = createControllableBridge('R1');
    const store = createConsoleStore(ctl.bridge);
    store.subscribe(() => {});
    store.dispose();
    expect(ctl.activeListenerCount()).toBe(0);
  });
});
