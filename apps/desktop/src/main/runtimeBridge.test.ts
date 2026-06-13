import type { AgentEvent } from '@frontagent/core';
import type { ApprovalRequest } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import { createRuntimeBridge, type RuntimeRunner } from './runtimeBridge.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function approval(approvalId = 'apv-1'): ApprovalRequest {
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

interface Sent {
  channel: string;
  payload: { runId: string; event?: AgentEvent; request?: ApprovalRequest };
}

function harness(run: RuntimeRunner, runId = 'R1') {
  const sent: Sent[] = [];
  const bridge = createRuntimeBridge({
    run,
    send: (channel, payload) => sent.push({ channel, payload: payload as Sent['payload'] }),
    generateRunId: () => runId,
  });
  return { bridge, sent };
}

describe('createRuntimeBridge', () => {
  it('returns the runId before any event is forwarded (timing contract)', async () => {
    const { bridge, sent } = harness(async ({ onEvent }) => {
      onEvent?.({ type: 'planning_started' });
    });

    const res = bridge.runTask({ task: 't', workspacePath: '/w' });
    expect(res.runId).toBe('R1');
    expect(sent).toHaveLength(0); // run deferred — no events emitted synchronously

    await tick();
    expect(sent[0]).toMatchObject({
      channel: 'fa:agent:event',
      payload: { runId: 'R1', event: { type: 'planning_started' } },
    });
  });

  it('maps the request and forwards events as envelopes', async () => {
    let received: { task: string; projectRoot: string; files?: string[]; url?: string } | undefined;
    const { bridge, sent } = harness(async (opts) => {
      received = {
        task: opts.task,
        projectRoot: opts.projectRoot,
        files: opts.files,
        url: opts.url,
      };
      opts.onEvent?.({ type: 'phase_started', phase: '实现', stepCount: 1 });
    });

    bridge.runTask({
      task: '加深色模式',
      workspacePath: '/proj',
      relevantFiles: ['a.ts'],
      browserUrl: 'http://x',
    });
    await tick();

    expect(received).toEqual({
      task: '加深色模式',
      projectRoot: '/proj',
      files: ['a.ts'],
      url: 'http://x',
    });
    expect(sent.at(-1)?.payload.event).toMatchObject({ type: 'phase_started', phase: '实现' });
  });

  it('round-trips an approval: respondApproval resolves the runtime promise', async () => {
    let approved: boolean | undefined;
    const { bridge, sent } = harness(async ({ onApprovalRequest }) => {
      approved = await onApprovalRequest?.(approval('apv-1'));
    });

    bridge.runTask({ task: 't', workspacePath: '/w' });
    await tick();
    expect(sent.some((s) => s.channel === 'fa:approval:requested')).toBe(true);
    expect(bridge.activeRunCount()).toBe(1);

    bridge.respondApproval({ runId: 'R1', approvalId: 'apv-1', approved: true });
    await tick();

    expect(approved).toBe(true);
    expect(bridge.activeRunCount()).toBe(0); // run finished and was dropped
  });

  it('ignores a stale or unknown approval id', async () => {
    let approved: boolean | undefined;
    const { bridge } = harness(async ({ onApprovalRequest }) => {
      approved = await onApprovalRequest?.(approval('apv-1'));
    });

    bridge.runTask({ task: 't', workspacePath: '/w' });
    await tick();

    bridge.respondApproval({ runId: 'R1', approvalId: 'wrong', approved: true });
    bridge.respondApproval({ runId: 'OTHER', approvalId: 'apv-1', approved: true });
    await tick();

    expect(approved).toBeUndefined(); // still pending
    expect(bridge.activeRunCount()).toBe(1);
  });

  it('aborts the run signal on cancelTask', async () => {
    let signal: AbortSignal | undefined;
    const { bridge } = harness(
      ({ signal: s }) =>
        new Promise<void>((resolve) => {
          signal = s;
          s?.addEventListener('abort', () => resolve());
        }),
    );

    bridge.runTask({ task: 't', workspacePath: '/w' });
    await tick();
    expect(signal?.aborted).toBe(false);

    bridge.cancelTask('R1');
    await tick();
    expect(signal?.aborted).toBe(true);
    expect(bridge.activeRunCount()).toBe(0);
  });

  it('forwards a task_failed event when the runtime throws', async () => {
    const { bridge, sent } = harness(async () => {
      throw new Error('boom');
    });

    bridge.runTask({ task: 't', workspacePath: '/w' });
    await tick();

    const failed = sent.find((s) => s.payload.event?.type === 'task_failed');
    expect(failed?.payload.event).toMatchObject({ type: 'task_failed' });
    expect((failed?.payload.event as { error: string }).error).toContain('boom');
    expect(bridge.activeRunCount()).toBe(0);
  });
});
