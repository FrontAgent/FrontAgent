import { describe, expect, it } from 'vitest';
import { createStore } from './store.js';

describe('approval store coordination', () => {
  it('resolves only the active approval request', () => {
    const store = createStore();
    const decisions: boolean[] = [];

    store.setState({
      approval: {
        approvalId: 'approval-current',
        toolName: 'run_command',
        riskLevel: 'high',
        reasonCode: 'shell_redirect',
        message: 'Redirect requires approval.',
        argsSummary: 'run_command: echo hi >> file',
        resolve: (approved) => decisions.push(approved),
      },
    });

    expect(store.resolveApproval('approval-stale', true)).toBe(false);
    expect(store.getState().approval?.approvalId).toBe('approval-current');
    expect(decisions).toEqual([]);

    expect(store.resolveApproval('approval-current', false)).toBe(true);
    expect(store.getState().approval).toBeNull();
    expect(decisions).toEqual([false]);
  });
});
