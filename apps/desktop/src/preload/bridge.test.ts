import { describe, expect, it, vi } from 'vitest';
import {
  type AgentEventEnvelope,
  type ApprovalRequestEnvelope,
  IpcChannel,
  IpcPush,
} from '../ipc/contract.js';
import { createPreloadBridge, type PreloadIpc } from './bridge.js';

type PushListener = (event: unknown, payload: unknown) => void;

function fakeIpc(invoke?: (channel: string, payload?: unknown) => Promise<unknown>) {
  const invokes: { channel: string; payload?: unknown }[] = [];
  const listeners = new Map<string, Set<PushListener>>();
  const ipc: PreloadIpc = {
    invoke: (channel, payload) => {
      invokes.push({ channel, payload });
      return invoke ? invoke(channel, payload) : Promise.resolve(undefined);
    },
    on: (channel, listener) => {
      (listeners.get(channel) ?? listeners.set(channel, new Set()).get(channel)!).add(listener);
    },
    removeListener: (channel, listener) => {
      listeners.get(channel)?.delete(listener);
    },
  };
  const emit = (channel: string, payload: unknown) => {
    for (const l of listeners.get(channel) ?? []) l(null, payload);
  };
  const listenerCount = (channel: string) => listeners.get(channel)?.size ?? 0;
  return { ipc, invokes, emit, listenerCount };
}

describe('createPreloadBridge', () => {
  it('maps each request method onto its invoke channel', async () => {
    const { ipc, invokes } = fakeIpc(async () => ({ runId: 'R1' }));
    const bridge = createPreloadBridge(ipc);

    const res = await bridge.runTask({ task: 't', workspacePath: '/w' });
    expect(res).toEqual({ runId: 'R1' });

    await bridge.cancelTask('R1');
    await bridge.respondApproval({ runId: 'R1', approvalId: 'apv-1', approved: true });
    await bridge.getSettings();
    await bridge.saveSettings({ provider: 'anthropic', model: 'm' });

    expect(invokes.map((i) => i.channel)).toEqual([
      IpcChannel.RunTask,
      IpcChannel.CancelTask,
      IpcChannel.RespondApproval,
      IpcChannel.GetSettings,
      IpcChannel.SaveSettings,
    ]);
    expect(invokes[0].payload).toEqual({ task: 't', workspacePath: '/w' });
    expect(invokes[1].payload).toBe('R1');
  });

  it('propagates a rejected saveSettings invoke (write failure → degrade)', async () => {
    const { ipc } = fakeIpc(async () => {
      throw new Error('Failed to persist settings');
    });
    const bridge = createPreloadBridge(ipc);
    await expect(bridge.saveSettings({ provider: 'anthropic', model: 'm' })).rejects.toThrow(
      /persist settings/,
    );
  });

  it('delivers pushed agent events to the subscriber', () => {
    const { ipc, emit } = fakeIpc();
    const bridge = createPreloadBridge(ipc);
    const seen: AgentEventEnvelope[] = [];
    bridge.onAgentEvent((env) => seen.push(env));

    const env: AgentEventEnvelope = { runId: 'R1', event: { type: 'planning_started' } };
    emit(IpcPush.AgentEvent, env);
    expect(seen).toEqual([env]);
  });

  it('delivers pushed approval requests to the subscriber', () => {
    const { ipc, emit } = fakeIpc();
    const bridge = createPreloadBridge(ipc);
    const seen: ApprovalRequestEnvelope[] = [];
    bridge.onApprovalRequested((env) => seen.push(env));

    const env = { runId: 'R1', request: { approvalId: 'apv-1' } } as ApprovalRequestEnvelope;
    emit(IpcPush.ApprovalRequested, env);
    expect(seen).toEqual([env]);
  });

  it('unsubscribe stops further delivery and removes the listener', () => {
    const { ipc, emit, listenerCount } = fakeIpc();
    const bridge = createPreloadBridge(ipc);
    const listener = vi.fn();
    const off = bridge.onAgentEvent(listener);
    expect(listenerCount(IpcPush.AgentEvent)).toBe(1);

    off();
    expect(listenerCount(IpcPush.AgentEvent)).toBe(0);
    emit(IpcPush.AgentEvent, { runId: 'R1', event: { type: 'planning_started' } });
    expect(listener).not.toHaveBeenCalled();
  });
});
