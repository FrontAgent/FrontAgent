import { describe, expect, it } from 'vitest';
import type { FrontAgentBridge } from '../ipc/contract.js';
import { IpcChannel } from '../ipc/contract.js';
import type { PreloadIpc } from './bridge.js';
import { FRONTAGENT_BRIDGE_KEY, installPreloadBridge } from './install.js';

function fakeIpc() {
  const invokes: { channel: string; payload?: unknown }[] = [];
  const ipc: PreloadIpc = {
    invoke: (channel, payload) => {
      invokes.push({ channel, payload });
      return Promise.resolve({ runId: 'R1' });
    },
    on: () => {},
    removeListener: () => {},
  };
  return { ipc, invokes };
}

describe('installPreloadBridge', () => {
  it('exposes a FrontAgentBridge under the frontagent key', () => {
    const { ipc } = fakeIpc();
    const exposed = new Map<string, unknown>();
    installPreloadBridge({ expose: (key, api) => exposed.set(key, api), ipc });

    expect(FRONTAGENT_BRIDGE_KEY).toBe('frontagent'); // the key the renderer reads
    expect(exposed.has(FRONTAGENT_BRIDGE_KEY)).toBe(true);

    const bridge = exposed.get(FRONTAGENT_BRIDGE_KEY) as FrontAgentBridge;
    expect(typeof bridge.runTask).toBe('function');
    expect(typeof bridge.cancelTask).toBe('function');
    expect(typeof bridge.respondApproval).toBe('function');
    expect(typeof bridge.getSettings).toBe('function');
    expect(typeof bridge.saveSettings).toBe('function');
    expect(typeof bridge.onAgentEvent).toBe('function');
    expect(typeof bridge.onApprovalRequested).toBe('function');
  });

  it('exposes a bridge wired to IPC, not a stub', async () => {
    const { ipc, invokes } = fakeIpc();
    const exposed = new Map<string, unknown>();
    installPreloadBridge({ expose: (key, api) => exposed.set(key, api), ipc });

    const bridge = exposed.get(FRONTAGENT_BRIDGE_KEY) as FrontAgentBridge;
    const res = await bridge.runTask({ task: 't', workspacePath: '/w' });
    expect(res).toEqual({ runId: 'R1' });
    expect(invokes[0].channel).toBe(IpcChannel.RunTask);
  });
});
