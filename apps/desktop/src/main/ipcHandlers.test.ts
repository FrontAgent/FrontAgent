import { describe, expect, it } from 'vitest';
import {
  type ApprovalDecisionInput,
  type DesktopSettings,
  IpcChannel,
  type RunTaskRequest,
} from '../ipc/contract.js';
import { type IpcInvokeListener, registerIpcHandlers } from './ipcHandlers.js';
import type { RuntimeBridge } from './runtimeBridge.js';

const settings: DesktopSettings = { provider: 'anthropic', model: 'claude-opus-4-8' };

function harness(opts: { saveOk?: boolean } = {}) {
  const handlers = new Map<string, IpcInvokeListener>();
  const calls = {
    runTask: [] as RunTaskRequest[],
    cancelTask: [] as string[],
    respondApproval: [] as ApprovalDecisionInput[],
    saved: [] as DesktopSettings[],
  };
  const bridge: RuntimeBridge = {
    runTask: (req) => {
      calls.runTask.push(req);
      return { runId: 'R1' };
    },
    respondApproval: (input) => {
      calls.respondApproval.push(input);
    },
    cancelTask: (runId) => {
      calls.cancelTask.push(runId);
    },
    activeRunCount: () => 0,
  };
  registerIpcHandlers({
    handle: (channel, listener) => handlers.set(channel, listener),
    bridge,
    loadSettings: () => settings,
    saveSettings: (s) => {
      calls.saved.push(s);
      return opts.saveOk ?? true;
    },
  });
  // Invoke a channel as `ipcMain` would (event arg unused by handlers).
  const invoke = (channel: string, payload?: unknown) => handlers.get(channel)?.(null, payload);
  return { calls, invoke };
}

describe('registerIpcHandlers', () => {
  it('registers exactly the five invoke channels', () => {
    const handlers = new Map<string, IpcInvokeListener>();
    const bridge = {
      runTask: () => ({ runId: 'R1' }),
      respondApproval: () => {},
      cancelTask: () => {},
      activeRunCount: () => 0,
    } satisfies RuntimeBridge;
    registerIpcHandlers({
      handle: (channel, listener) => handlers.set(channel, listener),
      bridge,
      loadSettings: () => settings,
      saveSettings: () => true,
    });
    expect([...handlers.keys()].sort()).toEqual(
      [
        IpcChannel.RunTask,
        IpcChannel.CancelTask,
        IpcChannel.RespondApproval,
        IpcChannel.GetSettings,
        IpcChannel.SaveSettings,
      ].sort(),
    );
  });

  it('routes RunTask to the bridge and returns the runId', () => {
    const { calls, invoke } = harness();
    const req: RunTaskRequest = { task: 't', workspacePath: '/w' };
    const res = invoke(IpcChannel.RunTask, req);
    expect(res).toEqual({ runId: 'R1' });
    expect(calls.runTask).toEqual([req]);
  });

  it('routes CancelTask and RespondApproval to the bridge', () => {
    const { calls, invoke } = harness();
    invoke(IpcChannel.CancelTask, 'R1');
    const decision: ApprovalDecisionInput = { runId: 'R1', approvalId: 'apv-1', approved: true };
    invoke(IpcChannel.RespondApproval, decision);
    expect(calls.cancelTask).toEqual(['R1']);
    expect(calls.respondApproval).toEqual([decision]);
  });

  it('returns stored settings from GetSettings', () => {
    const { invoke } = harness();
    expect(invoke(IpcChannel.GetSettings)).toEqual(settings);
  });

  it('persists settings on SaveSettings success', () => {
    const { calls, invoke } = harness({ saveOk: true });
    expect(() => invoke(IpcChannel.SaveSettings, settings)).not.toThrow();
    expect(calls.saved).toEqual([settings]);
  });

  it('rejects (throws) SaveSettings when the write fails', () => {
    const { invoke } = harness({ saveOk: false });
    // Throwing here makes `ipcRenderer.invoke` reject so the renderer can degrade.
    expect(() => invoke(IpcChannel.SaveSettings, settings)).toThrow(/persist settings/);
  });
});
