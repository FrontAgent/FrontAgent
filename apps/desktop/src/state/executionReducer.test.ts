import type { AgentEvent, AgentExecutionResult } from '@frontagent/core';
import type { AgentTask, ApprovalRequest, ExecutionPlan, ExecutionStep } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import {
  addApprovalRequest,
  type ConsoleState,
  consoleReducer,
  initialConsoleState,
  reduceEvents,
  resolveApproval,
  UNGROUPED_PHASE,
} from './executionReducer.js';

function task(description = '给登录页加深色模式'): AgentTask {
  return { id: 't1', type: 'modify', description };
}

function step(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 's1',
    description: '编辑 theme.css',
    action: 'write_file',
    tool: 'mcp-file',
    params: {},
    dependencies: [],
    validation: [],
    status: 'pending',
    ...overrides,
  };
}

function plan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  return {
    taskId: 't1',
    summary: '两步：编辑样式并验证',
    steps: [step()],
    rollbackStrategy: {
      enabled: true,
      snapshotBeforeExecution: true,
      rollbackOnFailure: true,
      maxRollbackSteps: 5,
    },
    ...overrides,
  };
}

function result(overrides: Partial<AgentExecutionResult> = {}): AgentExecutionResult {
  return {
    success: true,
    taskId: 't1',
    executedSteps: [],
    duration: 0,
    validations: [],
    ...overrides,
  };
}

describe('consoleReducer', () => {
  it('starts a task and resets prior state', () => {
    const dirty: ConsoleState = {
      ...initialConsoleState,
      status: 'failed',
      error: 'old',
      logSeq: 9,
    };
    const next = consoleReducer(dirty, { type: 'task_started', task: task() });

    expect(next.status).toBe('planning');
    expect(next.task).toBe('给登录页加深色模式');
    expect(next.error).toBeUndefined();
    expect(next.log).toHaveLength(1);
    expect(next.log[0].text).toContain('任务开始');
  });

  it('seeds phases from the plan and moves to running', () => {
    const next = consoleReducer(
      { ...initialConsoleState, status: 'planning' },
      {
        type: 'planning_completed',
        plan: plan({
          phases: [{ phaseId: 'p1', name: '实现', description: '', stepIndices: [0, 1] }],
        }),
      },
    );

    expect(next.status).toBe('running');
    expect(next.planSummary).toBe('两步：编辑样式并验证');
    expect(next.phases).toHaveLength(1);
    expect(next.phases[0]).toMatchObject({ name: '实现', status: 'pending', expectedSteps: 2 });
  });

  it('tracks a step through started -> completed and clears the active step', () => {
    let state = consoleReducer(initialConsoleState, {
      type: 'phase_started',
      phase: '实现',
      stepCount: 1,
    });
    state = consoleReducer(state, { type: 'step_started', step: step({ phase: '实现' }) });

    expect(state.activeStepId).toBe('s1');
    expect(state.phases[0].steps[0]).toMatchObject({ status: 'running', tool: 'mcp-file' });

    state = consoleReducer(state, {
      type: 'step_completed',
      step: step({ phase: '实现' }),
      result: { success: true, duration: 10 },
    });

    expect(state.activeStepId).toBeUndefined();
    expect(state.phases[0].steps[0].status).toBe('completed');
    expect(state.phases[0].steps).toHaveLength(1); // upsert, not duplicate
  });

  it('records step failures with the error message', () => {
    const state = consoleReducer(initialConsoleState, {
      type: 'step_failed',
      step: step({ phase: '实现' }),
      error: '路径不存在',
    });

    expect(state.phases[0].steps[0]).toMatchObject({ status: 'failed', error: '路径不存在' });
    expect(state.log.at(-1)).toMatchObject({ level: 'error' });
  });

  it('groups steps without a phase under the active phase, else the ungrouped fallback', () => {
    const active = consoleReducer(
      consoleReducer(initialConsoleState, { type: 'phase_started', phase: '实现', stepCount: 1 }),
      { type: 'step_started', step: step() }, // no phase field
    );
    expect(active.phases[0].steps[0].phase).toBe('实现');

    const orphan = consoleReducer(initialConsoleState, { type: 'step_started', step: step() });
    expect(orphan.phases[0].name).toBe(UNGROUPED_PHASE);
  });

  it('accumulates streamed tokens per step without logging', () => {
    let state = consoleReducer(initialConsoleState, {
      type: 'stream_token',
      token: 'Hel',
      stepId: 's1',
    });
    state = consoleReducer(state, { type: 'stream_token', token: 'lo', stepId: 's1' });

    expect(state.tokensByStep.s1).toBe('Hello');
    expect(state.log).toHaveLength(0);
  });

  it('surfaces security decisions in the log with the right level', () => {
    const denied = consoleReducer(initialConsoleState, {
      type: 'security_decision',
      decision: {
        decision: 'deny',
        riskLevel: 'high',
        reasonCode: 'shell_blocked',
        message: 'rm -rf 被拦截',
        toolName: 'run_command',
        argsSummary: 'rm -rf /',
        provenance: [],
      },
    });
    expect(denied.log.at(-1)).toMatchObject({ level: 'error' });
    expect(denied.log.at(-1)?.text).toContain('run_command');
  });

  it('completes and fails the run terminally', () => {
    const done = consoleReducer(
      { ...initialConsoleState, status: 'running', activeStepId: 's1' },
      {
        type: 'task_completed',
        result: result({ success: true }),
      },
    );
    expect(done.status).toBe('completed');
    expect(done.activeStepId).toBeUndefined();
    expect(done.result?.success).toBe(true);

    const failed = consoleReducer(
      { ...initialConsoleState, status: 'running' },
      {
        type: 'task_failed',
        error: 'LLM 超时',
      },
    );
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('LLM 超时');
  });

  it('marks a phase completed and flags failures in the summary', () => {
    let state = consoleReducer(initialConsoleState, {
      type: 'phase_started',
      phase: '验证',
      stepCount: 2,
    });
    state = consoleReducer(state, {
      type: 'phase_completed',
      phase: '验证',
      successCount: 1,
      failureCount: 1,
    });
    expect(state.phases[0].status).toBe('completed');
    expect(state.log.at(-1)).toMatchObject({ level: 'warn' });
  });

  it('reduces a full happy-path sequence deterministically', () => {
    const events: AgentEvent[] = [
      { type: 'task_started', task: task() },
      { type: 'planning_started' },
      {
        type: 'planning_completed',
        plan: plan({
          phases: [{ phaseId: 'p1', name: '实现', description: '', stepIndices: [0] }],
        }),
      },
      { type: 'phase_started', phase: '实现', stepCount: 1 },
      { type: 'step_started', step: step({ phase: '实现' }) },
      { type: 'stream_token', token: 'done', stepId: 's1' },
      {
        type: 'step_completed',
        step: step({ phase: '实现' }),
        result: { success: true, duration: 5 },
      },
      { type: 'phase_completed', phase: '实现', successCount: 1, failureCount: 0 },
      { type: 'task_completed', result: result({ success: true }) },
    ];

    const final = reduceEvents(events);

    expect(final.status).toBe('completed');
    expect(final.phases).toHaveLength(1);
    expect(final.phases[0].status).toBe('completed');
    expect(final.phases[0].steps[0].status).toBe('completed');
    expect(final.tokensByStep.s1).toBe('done');
    expect(final.activeStepId).toBeUndefined();
    // log keys are unique and monotonic
    expect(new Set(final.log.map((line) => line.seq)).size).toBe(final.log.length);
  });

  it('does not mutate the input state', () => {
    const before = { ...initialConsoleState };
    const frozen = Object.freeze({ ...initialConsoleState, phases: Object.freeze([]) as never });
    expect(() => consoleReducer(frozen, { type: 'planning_started' })).not.toThrow();
    expect(initialConsoleState).toEqual(before);
  });

  it('terminalizes a step left running when the task fails', () => {
    let state = consoleReducer(initialConsoleState, {
      type: 'phase_started',
      phase: '实现',
      stepCount: 1,
    });
    state = consoleReducer(state, { type: 'step_started', step: step({ phase: '实现' }) });
    expect(state.phases[0].steps[0].status).toBe('running');

    state = consoleReducer(state, { type: 'task_failed', error: 'LLM 超时' });

    expect(state.status).toBe('failed');
    expect(state.phases[0].steps[0].status).toBe('failed');
    expect(state.phases[0].steps[0].error).toContain('任务失败时中断');
    expect(state.phases[0].status).toBe('completed'); // active phase lane is closed out
    expect(state.activeStepId).toBeUndefined();
  });

  it('terminalizes a dangling running step when the task completes', () => {
    let state = consoleReducer(initialConsoleState, {
      type: 'phase_started',
      phase: '实现',
      stepCount: 1,
    });
    state = consoleReducer(state, { type: 'step_started', step: step({ phase: '实现' }) });
    state = consoleReducer(state, { type: 'task_completed', result: result({ success: true }) });

    expect(state.phases[0].steps[0].status).toBe('completed');
    expect(state.phases[0].status).toBe('completed'); // active phase lane is closed out
  });

  it('routes task_completed status by result.success so a failed run is never shown as completed', () => {
    let state = consoleReducer(initialConsoleState, {
      type: 'phase_started',
      phase: '实现',
      stepCount: 1,
    });
    state = consoleReducer(state, { type: 'step_started', step: step({ phase: '实现' }) });
    state = consoleReducer(state, {
      type: 'task_completed',
      result: result({ success: false, error: '验证未通过' }),
    });

    expect(state.status).toBe('failed');
    expect(state.error).toBe('验证未通过');
    expect(state.phases[0].steps[0].status).toBe('failed');
  });
});

describe('approval actions', () => {
  function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
    return {
      decision: 'ask',
      approvalId: 'a1',
      createdAt: '2026-06-13T00:00:00Z',
      riskLevel: 'high',
      reasonCode: 'shell_ask',
      message: '执行 npm install',
      toolName: 'run_command',
      argsSummary: 'npm install',
      provenance: [],
      ...overrides,
    };
  }

  it('queues an approval request in the same state model and de-duplicates', () => {
    const queued = addApprovalRequest(initialConsoleState, approval());
    expect(queued.pendingApprovals).toHaveLength(1);
    expect(queued.log.at(-1)).toMatchObject({ level: 'warn' });

    const again = addApprovalRequest(queued, approval());
    expect(again.pendingApprovals).toHaveLength(1); // deduped on approvalId
  });

  it('removes an approval from the queue once resolved', () => {
    const queued = addApprovalRequest(initialConsoleState, approval());
    const approved = resolveApproval(queued, 'a1', true);

    expect(approved.pendingApprovals).toHaveLength(0);
    expect(approved.log.at(-1)?.text).toContain('审批通过');
  });

  it('ignores resolving an unknown approval id', () => {
    const queued = addApprovalRequest(initialConsoleState, approval());
    const unchanged = resolveApproval(queued, 'nope', false);
    expect(unchanged).toBe(queued);
  });
});
