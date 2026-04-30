import { describe, expect, it } from 'vitest';
import {
  applyPrefill,
  beginChatRun,
  completeChatRun,
  createInitialViewState,
  reduceAgentEvent,
  setDetailsCollapsed,
} from './state.js';
import type { AgentEvent } from '@frontagent/runtime-node';

describe('VS Code view state reducer', () => {
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

  it('tracks chat prefill, user message, and final assistant answer', () => {
    let state = createInitialViewState();
    state = applyPrefill(state, {
      mode: 'modify',
      files: ['src/App.tsx'],
      selectionPreview: 'const value = 1;',
    });
    expect(state.mode).toBe('modify');
    expect(state.contextFiles).toEqual(['src/App.tsx']);
    expect(state.selectionPreview).toContain('value');

    state = beginChatRun(state, {
      task: 'Refactor this component',
      mode: 'modify',
      files: ['src/App.tsx'],
      url: 'http://localhost:5173',
    });
    expect(state.messages[0]).toMatchObject({
      role: 'user',
      text: 'Refactor this component',
      mode: 'modify',
      files: ['src/App.tsx'],
      url: 'http://localhost:5173',
    });
    expect(state.isRunning).toBe(true);
    expect(state.composer).toBe('');

    state = completeChatRun(state, {
      success: true,
      taskId: 't1',
      executedSteps: [],
      output: 'Done',
      duration: 1,
      validations: [],
    });
    expect(state.messages.at(-1)).toMatchObject({ role: 'assistant', text: 'Done' });
    expect(state.status).toBe('done');
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

  it('stores details collapsed state', () => {
    let state = createInitialViewState();
    expect(state.detailsCollapsed).toBe(true);
    state = setDetailsCollapsed(state, false);
    expect(state.detailsCollapsed).toBe(false);
  });
});
