import type { AgentTask, ExecutionStep } from '@frontagent/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutorOutput } from '../types.js';
import { executeStepsWithErrorFeedbackViaLangGraph } from './step-feedback-runner.js';
import type { ExecutorCollectedContext, PhaseExecutionGroup } from './types.js';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Test step',
    action: 'create_file',
    tool: 'create_file',
    params: { path: 'src/a.ts', content: 'export {}' },
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makeOutput(stepId: string): ExecutorOutput {
  return {
    stepResult: { success: true, duration: 10, output: { stepId } },
    validation: { pass: true, results: [] },
    needsRollback: false,
  };
}

function makeContext() {
  return {
    task: { id: 't1', type: 'create' as const, description: 'test' } as AgentTask,
    collectedContext: {
      files: new Map<string, string>(),
    } as ExecutorCollectedContext,
  };
}

describe('executeStepsWithErrorFeedbackViaLangGraph', () => {
  it('delegates each ordered phase group and returns accumulated results', async () => {
    const step1 = makeStep({ stepId: 's1', phase: 'build' });
    const step2 = makeStep({ stepId: 's2', phase: 'build' });
    const context = makeContext();
    const signal = new AbortController().signal;
    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();
    const onPhaseStart = vi.fn();
    const onPhaseError = vi.fn();
    const onPhaseComplete = vi.fn();
    const executeSinglePhaseWithRecovery = vi.fn(
      async (
        phaseGroup: PhaseExecutionGroup,
        receivedContext: typeof context,
        completedStepIds: Set<string>,
        allResults: ExecutorOutput[],
        callbacks: {
          onStepStart?: (step: ExecutionStep) => void;
          onStepComplete?: (step: ExecutionStep, output: ExecutorOutput) => void;
          onPhaseStart?: (phase: string, stepCount: number) => void;
          onPhaseError?: (
            phase: string,
            errors: Array<{ step: ExecutionStep; error: string }>,
          ) => Promise<ExecutionStep[]>;
          onPhaseComplete?: (
            phase: string,
            results: ExecutorOutput[],
          ) => Promise<Array<{ step: ExecutionStep; error: string }>>;
          signal?: AbortSignal;
        },
      ) => {
        expect(receivedContext).toBe(context);
        expect(phaseGroup.phase).toBe('build');
        expect(phaseGroup.steps.map((step) => step.stepId)).toEqual(['s1', 's2']);
        expect(phaseGroup.dependencies).toBeInstanceOf(Set);
        expect(callbacks).toEqual({
          onStepStart,
          onStepComplete,
          onPhaseStart,
          onPhaseError,
          onPhaseComplete,
          signal,
        });

        completedStepIds.add('s1');
        completedStepIds.add('s2');
        allResults.push(makeOutput('s1'), makeOutput('s2'));
      },
    );

    const results = await executeStepsWithErrorFeedbackViaLangGraph({
      steps: [step1, step2],
      context,
      executeSinglePhaseWithRecovery,
      debugWarn: vi.fn(),
      langGraph: { enabled: true },
      callbacks: {
        onStepStart,
        onStepComplete,
        onPhaseStart,
        onPhaseError,
        onPhaseComplete,
        signal,
      },
    });

    expect(executeSinglePhaseWithRecovery).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.stepResult.output)).toEqual([
      { stepId: 's1' },
      { stepId: 's2' },
    ]);
  });
});
