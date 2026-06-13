import { describe, expect, it, vi } from 'vitest';
import type { DesktopSettings, FrontAgentBridge } from '../../ipc/contract.js';
import { createSettingsController } from './settingsController.js';

const stored: DesktopSettings = { provider: 'openai', model: 'gpt-x', baseUrl: '' };

/** Minimal bridge with overridable getSettings/saveSettings; rest unused here. */
function fakeBridge(over: Partial<FrontAgentBridge> = {}): FrontAgentBridge {
  return {
    runTask: vi.fn(),
    cancelTask: vi.fn(),
    respondApproval: vi.fn(),
    getSettings: vi.fn(async () => stored),
    saveSettings: vi.fn(async () => {}),
    onAgentEvent: vi.fn(() => () => {}),
    onApprovalRequested: vi.fn(() => () => {}),
    ...over,
  } as FrontAgentBridge;
}

describe('settingsController', () => {
  it('loads settings into the ready state', async () => {
    const c = createSettingsController(fakeBridge());
    expect(c.getState().status).toBe('loading');
    await c.load();
    expect(c.getState()).toMatchObject({ status: 'ready', settings: stored, error: null });
  });

  it('surfaces a retryable load-error when getSettings rejects', async () => {
    let calls = 0;
    const bridge = fakeBridge({
      getSettings: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error('IPC down');
        return stored;
      }),
    });
    const c = createSettingsController(bridge);
    await c.load();
    expect(c.getState()).toMatchObject({ status: 'load-error', settings: null, error: 'IPC down' });

    await c.load(); // retry succeeds
    expect(c.getState()).toMatchObject({ status: 'ready', settings: stored });
  });

  it('clears the saved flag on edit', async () => {
    const c = createSettingsController(fakeBridge());
    await c.load();
    await c.save();
    expect(c.getState().saved).toBe(true);
    c.update('model', 'gpt-y');
    expect(c.getState()).toMatchObject({ status: 'ready', saved: false });
    expect(c.getState().settings?.model).toBe('gpt-y');
  });

  it('marks saved on a successful save', async () => {
    const save = vi.fn(async () => {});
    const c = createSettingsController(fakeBridge({ saveSettings: save }));
    await c.load();
    await c.save();
    expect(save).toHaveBeenCalledWith(stored);
    expect(c.getState()).toMatchObject({ status: 'ready', saved: true });
  });

  it('surfaces a retryable save-error when saveSettings rejects, preserving edits', async () => {
    let calls = 0;
    const bridge = fakeBridge({
      saveSettings: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error('disk full');
      }),
    });
    const c = createSettingsController(bridge);
    await c.load();
    c.update('model', 'gpt-y');
    await c.save();
    expect(c.getState()).toMatchObject({ status: 'save-error', saved: false, error: 'disk full' });
    expect(c.getState().settings?.model).toBe('gpt-y'); // edits preserved for retry

    await c.save(); // retry succeeds
    expect(c.getState()).toMatchObject({ status: 'ready', saved: true });
  });

  it('notifies subscribers on state changes', async () => {
    const c = createSettingsController(fakeBridge());
    const listener = vi.fn();
    const off = c.subscribe(listener);
    await c.load();
    expect(listener).toHaveBeenCalled();
    off();
    const before = listener.mock.calls.length;
    c.update('provider', 'anthropic');
    expect(listener.mock.calls.length).toBe(before); // no longer notified
  });
});
