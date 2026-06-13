import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConsoleStore } from '../store/consoleStore.js';
import { createMockBridge } from './mockBridge.js';

describe('mock bridge driving the console store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('replays the scripted run into phase lanes and pauses on an approval', async () => {
    const store = createConsoleStore(createMockBridge());

    await store.runTask({ task: 'demo', workspacePath: '/tmp/demo' });
    await vi.advanceTimersByTimeAsync(12_000);

    const state = store.getState();
    expect(state.task).toContain('深色模式');
    expect(state.phases.map((p) => p.name)).toEqual(['实现', '验证']);
    // The 实现 phase ran two steps to completion.
    const impl = state.phases.find((p) => p.name === '实现');
    expect(impl?.status).toBe('completed');
    expect(impl?.steps.every((s) => s.status === 'completed')).toBe(true);
    // The run is paused on a pending approval, not yet terminal.
    expect(state.pendingApprovals).toHaveLength(1);
    expect(state.status).toBe('running');

    store.dispose();
  });

  it('completes the run when the approval is granted', async () => {
    const store = createConsoleStore(createMockBridge());
    await store.runTask({ task: 'demo', workspacePath: '/tmp/demo' });
    await vi.advanceTimersByTimeAsync(12_000);

    const approvalId = store.getState().pendingApprovals[0]?.approvalId;
    expect(approvalId).toBeTruthy();

    await store.respondApproval(approvalId as string, true);
    await vi.advanceTimersByTimeAsync(4_000);

    const state = store.getState();
    expect(state.pendingApprovals).toHaveLength(0);
    expect(state.status).toBe('completed');
    expect(state.result?.success).toBe(true);
    store.dispose();
  });

  it('fails the run when the approval is rejected', async () => {
    const store = createConsoleStore(createMockBridge());
    await store.runTask({ task: 'demo', workspacePath: '/tmp/demo' });
    await vi.advanceTimersByTimeAsync(12_000);

    const approvalId = store.getState().pendingApprovals[0]?.approvalId as string;
    await store.respondApproval(approvalId, false);
    await vi.advanceTimersByTimeAsync(4_000);

    const state = store.getState();
    expect(state.status).toBe('failed');
    expect(state.pendingApprovals).toHaveLength(0);
    store.dispose();
  });
});
