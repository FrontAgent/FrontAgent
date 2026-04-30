import { describe, expect, it } from 'vitest';
import { createInitialViewState, reduceAgentEvent } from './state.js';
import type { AgentEvent } from '@frontagent/runtime-node';

describe('VSCode view state reducer', () => {
  it('builds phases and updates step status from agent events', () => {
    let state = createInitialViewState();
    const plan = {
      steps: [
        {
          stepId: 's1',
          description: 'Read package',
          action: 'read_file',
          tool: 'read_file',
          params: { path: 'package.json' },
          dependencies: [],
          validation: [],
          status: 'pending' as const,
          phase: '分析',
        },
      ],
    };

    state = reduceAgentEvent(state, {
      type: 'planning_completed',
      plan,
    } as AgentEvent);
    expect(state.status).toBe('executing');
    expect(state.phases).toHaveLength(1);

    state = reduceAgentEvent(state, {
      type: 'phase_started',
      phase: '分析',
      stepCount: 1,
    });
    state = reduceAgentEvent(state, {
      type: 'step_started',
      step: plan.steps[0],
    });
    expect(state.currentStepId).toBe('s1');
    expect(state.phases[0].steps[0].status).toBe('running');

    state = reduceAgentEvent(state, {
      type: 'step_completed',
      step: plan.steps[0],
      result: {
        success: true,
        output: {},
        duration: 1,
      },
    });
    expect(state.currentStepId).toBeNull();
    expect(state.phases[0].steps[0].status).toBe('completed');
  });

  it('caps streamed text to keep webview messages bounded', () => {
    let state = createInitialViewState();
    state = reduceAgentEvent(state, {
      type: 'stream_token',
      stepId: 's1',
      token: 'x'.repeat(13000),
    });
    expect(state.streamText).toHaveLength(12000);
  });
});
