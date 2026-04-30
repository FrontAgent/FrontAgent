import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@frontagent/core';
import type { ExecutionPlan, ExecutionStep } from '@frontagent/shared';
import { createEventBridge } from './bridge.js';
import { createStore, isRunPossiblyStalled } from './store.js';

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

function createStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: '读取 package.json',
    action: 'read_file',
    tool: 'read_file',
    params: { path: 'package.json' },
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: '阶段1',
    ...overrides,
  };
}

function createPlan(): ExecutionPlan {
  return {
    taskId: 'task-1',
    summary: 'demo',
    steps: [createStep()],
    rollbackStrategy: {
      enabled: false,
      snapshotBeforeExecution: false,
      rollbackOnFailure: false,
      maxRollbackSteps: 0,
    },
  };
}

describe('run activity state', () => {
  it('records status updates and detects stalled active runs', () => {
    const store = createStore();
    const bridge = createEventBridge(store);
    const startedAt = Date.now();

    store.setState({ status: 'executing', startTime: startedAt });
    bridge({ type: 'status_update', label: '生成最终回答', operation: 'LLM 合成' });

    expect(store.getState().lastActivityLabel).toBe('生成最终回答');
    expect(store.getState().currentOperation).toBe('LLM 合成');
    expect(isRunPossiblyStalled(store.getState(), store.getState().lastActivityAt + 29_999)).toBe(false);
    expect(isRunPossiblyStalled(store.getState(), store.getState().lastActivityAt + 30_000)).toBe(true);
  });

  it('upserts recovery steps that are not in the original plan', () => {
    const store = createStore();
    const bridge = createEventBridge(store);
    const plan = createPlan();
    const recoveryStep = createStep({
      stepId: 'recovery-1',
      description: '修复缺失依赖',
      action: 'run_command',
      tool: 'run_command',
      params: { command: 'npm install left-pad' },
      phase: '阶段1',
    });

    bridge({ type: 'planning_completed', plan });
    bridge({ type: 'phase_started', phase: '阶段1', stepCount: 1 });
    bridge({ type: 'step_started', step: recoveryStep } satisfies AgentEvent);
    bridge({
      type: 'step_completed',
      step: recoveryStep,
      result: { success: true, duration: 1 },
    } satisfies AgentEvent);

    const phase = store.getState().phases.find((p) => p.name === '阶段1');
    expect(phase?.steps.map((step) => step.stepId)).toContain('recovery-1');
    expect(phase?.steps.find((step) => step.stepId === 'recovery-1')?.status).toBe('completed');
  });
});
